import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { getCursorWorkerScript, getIssueContext, renderCursorPrompt } from "./worker-cursor.js";
import { commitFinalChanges, pushAndOpenOrReusePr, runQualityChecks } from "./worker-publish.js";

export type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: NodeJS.ErrnoException;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandOptions,
) => CommandResult;

export type CommandOptions = {
  cwd?: string;
  timeoutMs?: number;
};

export type ExecuteIssueWorkInput = {
  repo: string;
  issueNumber: number;
  runId: string;
  baseBranch: string;
  workerImage: string;
  workerTimeoutMs: number;
  repoRoot?: string;
};

export type ExecuteIssueWorkResult = {
  issueBranch: string;
  worktreePath: string;
  artifactPath: string;
  containerName: string;
  prUrl: string;
};

const defaultRunner: CommandRunner = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    cwd: options.cwd,
    timeout: options.timeoutMs,
  });

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
};

export function executeIssueWork(
  input: ExecuteIssueWorkInput,
  runCommand: CommandRunner = defaultRunner,
): ExecuteIssueWorkResult {
  const repoRoot = input.repoRoot ?? process.cwd();
  const issueBranch = formatIssueBranchName(input.issueNumber);
  const worktreePath = resolve(repoRoot, ".ralph/worktrees", input.runId);
  const artifactPath = resolve(repoRoot, ".ralph/artifacts", input.runId);
  const containerName = formatContainerName(input.runId);
  const startedAt = new Date().toISOString();
  const issueContext = getIssueContext(input.repo, input.issueNumber, runCommand);

  mkdirSync(artifactPath, { recursive: true });
  writeRunManifest(artifactPath, {
    repo: input.repo,
    issueNumber: input.issueNumber,
    runId: input.runId,
    issueBranch,
    baseBranch: input.baseBranch,
    workerImage: input.workerImage,
    workerTimeoutMs: input.workerTimeoutMs,
    startedAt,
  });
  writeFileSync(
    resolve(artifactPath, "cursor-prompt.md"),
    renderCursorPrompt(input, issueBranch, issueContext),
    "utf8",
  );

  if (existsSync(worktreePath)) {
    runCommand("git", ["worktree", "remove", "--force", worktreePath], { cwd: repoRoot });
    rmSync(worktreePath, { recursive: true, force: true });
  }

  runOrThrow(
    runCommand,
    "git",
    ["worktree", "add", "--detach", worktreePath, input.baseBranch],
    { cwd: repoRoot },
    "failed to create isolated git worktree",
  );
  runOrThrow(
    runCommand,
    "git",
    ["-C", worktreePath, "checkout", "-B", issueBranch, input.baseBranch],
    { cwd: repoRoot },
    "failed to provision deterministic issue branch",
  );

  let dockerRunOutput: CommandResult | undefined;
  try {
    dockerRunOutput = runCommand("docker", buildDockerRunArgs(input, worktreePath, artifactPath), {
      cwd: repoRoot,
      timeoutMs: input.workerTimeoutMs,
    });
    writeRunLogs(artifactPath, dockerRunOutput);

    if (dockerRunOutput.error) {
      if (dockerRunOutput.error.code === "ETIMEDOUT") {
        throw new Error(`worker timed out after ${input.workerTimeoutMs}ms`);
      }
      throw new Error(`failed to launch worker container: ${dockerRunOutput.error.message}`);
    }
    if (dockerRunOutput.status !== 0) {
      throw new Error(
        `worker container exited with status ${dockerRunOutput.status}: ${dockerRunOutput.stderr.trim()}`,
      );
    }
  } finally {
    runCommand("docker", ["rm", "-f", containerName], { cwd: repoRoot });
    writeFileSync(resolve(artifactPath, "cleanup.json"), JSON.stringify({ containerName }));
  }

  writeFileSync(
    resolve(artifactPath, "result.json"),
    JSON.stringify({ status: "succeeded", completedAt: new Date().toISOString() }),
  );

  runQualityChecks(worktreePath, runCommand);
  const commitSha = commitFinalChanges(input.issueNumber, worktreePath, runCommand);
  const prUrl = pushAndOpenOrReusePr(
    input,
    issueBranch,
    issueContext.title,
    worktreePath,
    runCommand,
    runOrThrow,
  );
  writeFileSync(resolve(artifactPath, "publish.json"), JSON.stringify({ commitSha, prUrl }));

  return { issueBranch, worktreePath, artifactPath, containerName, prUrl };
}

export function runOrThrow(
  runCommand: CommandRunner,
  command: string,
  args: string[],
  options: CommandOptions,
  errorPrefix: string,
): void {
  const result = runCommand(command, args, options);
  if (result.error) {
    throw new Error(`${errorPrefix}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${errorPrefix}: ${result.stderr.trim() || "unknown error"}`);
  }
}

function buildDockerRunArgs(
  input: ExecuteIssueWorkInput,
  worktreePath: string,
  artifactPath: string,
): string[] {
  const args = [
    "run",
    "--name",
    formatContainerName(input.runId),
    "--workdir",
    "/workspace",
    "--volume",
    `${worktreePath}:/workspace`,
    "--volume",
    `${artifactPath}:/artifacts`,
    "--env",
    `ISSUE_NUMBER=${input.issueNumber}`,
    "--env",
    `RUN_ID=${input.runId}`,
    "--env",
    `ISSUE_BRANCH=${formatIssueBranchName(input.issueNumber)}`,
    "--env",
    `BASE_BRANCH=${input.baseBranch}`,
  ];

  const githubToken = process.env.GITHUB_TOKEN;
  if (typeof githubToken === "string" && githubToken.length > 0) {
    args.push("--env", `GITHUB_TOKEN=${githubToken}`);
  }
  const cursorApiKey = process.env.CURSOR_API_KEY;
  if (typeof cursorApiKey === "string" && cursorApiKey.length > 0) {
    args.push("--env", `CURSOR_API_KEY=${cursorApiKey}`);
  }

  args.push(input.workerImage, "sh", "-lc", getCursorWorkerScript());
  return args;
}

function writeRunManifest(
  artifactPath: string,
  manifest: {
    repo: string;
    issueNumber: number;
    runId: string;
    issueBranch: string;
    baseBranch: string;
    workerImage: string;
    workerTimeoutMs: number;
    startedAt: string;
  },
): void {
  writeFileSync(resolve(artifactPath, "run-manifest.json"), JSON.stringify(manifest));
}

function writeRunLogs(artifactPath: string, output: CommandResult): void {
  writeFileSync(resolve(artifactPath, "worker.stdout.log"), output.stdout);
  writeFileSync(resolve(artifactPath, "worker.stderr.log"), output.stderr);
}

function formatIssueBranchName(issueNumber: number): string {
  return `ralph/issue-${String(issueNumber).padStart(6, "0")}`;
}

function formatContainerName(runId: string): string {
  return `ralph-${runId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}
