import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { executeIssueWork, type CommandResult, type CommandRunner } from "./worker-execution.js";

type Invocation = {
  command: string;
  args: string[];
  cwd: string | undefined;
  timeoutMs: number | undefined;
};

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function createTempRepoRoot(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "ralph-worker-execution-"));
  tempPaths.push(tempDir);
  return tempDir;
}

function createRunner(responses: Record<string, CommandResult>): {
  invocations: Invocation[];
  run: CommandRunner;
} {
  const invocations: Invocation[] = [];
  const run: CommandRunner = (command, args, options) => {
    invocations.push({
      command,
      args: [...args],
      cwd: options?.cwd,
      timeoutMs: options?.timeoutMs,
    });
    const key = [command, ...args].join(" ");
    return responses[key] ?? { status: 0, stdout: "", stderr: "" };
  };

  return { invocations, run };
}

describe("executeIssueWork", () => {
  test("creates deterministic worktree and launches worker container with artifacts", () => {
    const repoRoot = createTempRepoRoot();
    const runId = "issue-000025-run-0001";
    const worktreePath = resolve(repoRoot, ".ralph/worktrees", runId);
    const artifactPath = resolve(repoRoot, ".ralph/artifacts", runId);
    const containerName = "ralph-issue-000025-run-0001";

    const { invocations, run } = createRunner({
      [`docker run --name ${containerName} --workdir /workspace --volume ${worktreePath}:/workspace --volume ${artifactPath}:/artifacts --env ISSUE_NUMBER=25 --env RUN_ID=${runId} --env ISSUE_BRANCH=ralph/issue-000025 --env BASE_BRANCH=main node:22-alpine sh -lc echo "Ralph worker bootstrap" | tee /artifacts/worker.log`]:
        {
          status: 0,
          stdout: "worker started\n",
          stderr: "",
        },
    });

    const result = executeIssueWork(
      {
        issueNumber: 25,
        runId,
        baseBranch: "main",
        workerImage: "node:22-alpine",
        workerTimeoutMs: 900_000,
        repoRoot,
      },
      run,
    );

    expect(result.issueBranch).toBe("ralph/issue-000025");
    expect(result.worktreePath).toBe(worktreePath);
    expect(result.artifactPath).toBe(artifactPath);
    expect(result.containerName).toBe(containerName);
    expect(invocations.map((entry) => `${entry.command} ${entry.args.join(" ")}`)).toEqual([
      `git worktree add --detach ${worktreePath} main`,
      `git -C ${worktreePath} checkout -B ralph/issue-000025 main`,
      `docker run --name ${containerName} --workdir /workspace --volume ${worktreePath}:/workspace --volume ${artifactPath}:/artifacts --env ISSUE_NUMBER=25 --env RUN_ID=${runId} --env ISSUE_BRANCH=ralph/issue-000025 --env BASE_BRANCH=main node:22-alpine sh -lc echo "Ralph worker bootstrap" | tee /artifacts/worker.log`,
      `docker rm -f ${containerName}`,
    ]);

    expect(readFileSync(resolve(artifactPath, "worker.stdout.log"), "utf8")).toBe(
      "worker started\n",
    );
    expect(readFileSync(resolve(artifactPath, "worker.stderr.log"), "utf8")).toBe("");
    expect(JSON.parse(readFileSync(resolve(artifactPath, "result.json"), "utf8"))).toEqual({
      status: "succeeded",
      completedAt: expect.any(String),
    });
  });

  test("enforces worker timeout and still cleans up the container", () => {
    const repoRoot = createTempRepoRoot();
    const runId = "issue-000025-run-0001";
    const worktreePath = resolve(repoRoot, ".ralph/worktrees", runId);
    const artifactPath = resolve(repoRoot, ".ralph/artifacts", runId);
    const containerName = "ralph-issue-000025-run-0001";
    const timeoutError = new Error("timed out") as NodeJS.ErrnoException;
    timeoutError.code = "ETIMEDOUT";

    const { invocations, run } = createRunner({
      [`docker run --name ${containerName} --workdir /workspace --volume ${worktreePath}:/workspace --volume ${artifactPath}:/artifacts --env ISSUE_NUMBER=25 --env RUN_ID=${runId} --env ISSUE_BRANCH=ralph/issue-000025 --env BASE_BRANCH=main node:22-alpine sh -lc echo "Ralph worker bootstrap" | tee /artifacts/worker.log`]:
        {
          status: null,
          stdout: "",
          stderr: "",
          error: timeoutError,
        },
    });

    expect(() =>
      executeIssueWork(
        {
          issueNumber: 25,
          runId,
          baseBranch: "main",
          workerImage: "node:22-alpine",
          workerTimeoutMs: 1000,
          repoRoot,
        },
        run,
      ),
    ).toThrow("worker timed out after 1000ms");

    expect(invocations.map((entry) => `${entry.command} ${entry.args.join(" ")}`)).toContain(
      `docker rm -f ${containerName}`,
    );
  });
});
