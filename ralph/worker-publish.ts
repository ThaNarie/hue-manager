import type { CommandOptions, CommandRunner, ExecuteIssueWorkInput } from "./worker-execution.js";

type RunOrThrow = (
  runCommand: CommandRunner,
  command: string,
  args: string[],
  options: CommandOptions,
  errorPrefix: string,
) => void;

export function runQualityChecks(worktreePath: string, runCommand: CommandRunner): void {
  runOrThrowLocal(
    runCommand,
    "vp",
    ["run", "build"],
    { cwd: worktreePath },
    "quality check failed (vp run build)",
  );
  runOrThrowLocal(
    runCommand,
    "vp",
    ["test"],
    { cwd: worktreePath },
    "quality check failed (vp test)",
  );
  runOrThrowLocal(
    runCommand,
    "vp",
    ["check", "--fix"],
    { cwd: worktreePath },
    "quality check failed (vp check --fix)",
  );
}

export function commitFinalChanges(
  issueNumber: number,
  worktreePath: string,
  runCommand: CommandRunner,
): string {
  runOrThrowLocal(
    runCommand,
    "git",
    ["-C", worktreePath, "add", "-A"],
    {},
    "failed to stage worker output",
  );

  const hasStagedChanges = hasGitChangesStaged(worktreePath, runCommand);
  if (!hasStagedChanges) {
    throw new Error("worker produced no changes to publish");
  }

  runOrThrowLocal(
    runCommand,
    "git",
    ["-C", worktreePath, "commit", "-m", `chore(ralph): implement #${issueNumber}`],
    {},
    "failed to create final commit",
  );

  const shaResult = runCommand("git", ["-C", worktreePath, "rev-parse", "HEAD"], {});
  if (shaResult.error || shaResult.status !== 0) {
    throw new Error(
      `failed to read final commit sha: ${shaResult.error?.message ?? shaResult.stderr}`,
    );
  }
  return shaResult.stdout.trim();
}

export function pushAndOpenOrReusePr(
  input: ExecuteIssueWorkInput,
  issueBranch: string,
  issueTitle: string,
  worktreePath: string,
  finalOutput: string,
  runCommand: CommandRunner,
  runOrThrow: RunOrThrow,
): string {
  runOrThrow(
    runCommand,
    "git",
    ["-C", worktreePath, "push", "-u", "origin", issueBranch],
    {},
    "failed to push issue branch",
  );

  const existingPr = findExistingOpenPr(input.repo, issueBranch, runCommand);
  if (existingPr) {
    commentOnPr(input.repo, existingPr, buildPrComment(input.runId, finalOutput), runCommand);
    return existingPr;
  }

  const prBody = buildPrBody(input.issueNumber, input.runId, finalOutput);

  const prCreateResult = runCommand(
    "gh",
    [
      "pr",
      "create",
      "--repo",
      input.repo,
      "--base",
      input.baseBranch,
      "--head",
      issueBranch,
      "--title",
      `Ralph: #${input.issueNumber} ${issueTitle}`,
      "--body",
      prBody,
    ],
    {},
  );
  if (prCreateResult.error) {
    throw new Error(`failed to create pull request: ${prCreateResult.error.message}`);
  }
  if (prCreateResult.status !== 0) {
    throw new Error(`failed to create pull request: ${prCreateResult.stderr.trim()}`);
  }
  return prCreateResult.stdout.trim();
}

function buildPrBody(issueNumber: number, runId: string, finalOutput: string): string {
  return [
    `Automated Ralph run ${runId}.`,
    "",
    `Closes #${issueNumber}`,
    "",
    "## Ralph final output",
    "",
    truncateForGitHub(finalOutput),
    "",
    `Artifact: \`.ralph/artifacts/${runId}/final-output.md\``,
  ].join("\n");
}

function buildPrComment(runId: string, finalOutput: string): string {
  return [
    `Ralph rerun summary for \`${runId}\`:`,
    "",
    "## Ralph final output",
    "",
    truncateForGitHub(finalOutput),
    "",
    `Artifact: \`.ralph/artifacts/${runId}/final-output.md\``,
  ].join("\n");
}

function truncateForGitHub(markdown: string): string {
  const normalized = markdown.trim();
  const maxLength = 6500;
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}\n\n_(truncated for PR output; full text in artifact)_`;
}

function hasGitChangesStaged(worktreePath: string, runCommand: CommandRunner): boolean {
  const result = runCommand("git", ["-C", worktreePath, "diff", "--cached", "--quiet"], {});
  if (result.error) {
    throw new Error(`failed to inspect staged changes: ${result.error.message}`);
  }
  if (result.status === 1) {
    return true;
  }
  if (result.status === 0) {
    return false;
  }
  throw new Error(
    `failed to inspect staged changes: ${result.stderr.trim() || "unknown git error"}`,
  );
}

function findExistingOpenPr(
  repo: string,
  issueBranch: string,
  runCommand: CommandRunner,
): string | undefined {
  const result = runCommand(
    "gh",
    ["pr", "list", "--repo", repo, "--head", issueBranch, "--state", "open", "--json", "url"],
    {},
  );
  if (result.error || result.status !== 0) {
    return undefined;
  }

  const payload = JSON.parse(result.stdout) as Array<{ url?: string }>;
  const existing = payload.find((entry) => typeof entry.url === "string" && entry.url.length > 0);
  return existing?.url;
}

function commentOnPr(
  repo: string,
  prReference: string,
  body: string,
  runCommand: CommandRunner,
): void {
  runOrThrowLocal(
    runCommand,
    "gh",
    ["pr", "comment", prReference, "--repo", repo, "--body", body],
    {},
    "failed to publish final output summary comment",
  );
}

function runOrThrowLocal(
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
