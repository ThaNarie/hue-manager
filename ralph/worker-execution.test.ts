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
    const exact = responses[key];
    if (exact) {
      return exact;
    }
    const prefixEntry = Object.entries(responses).find(
      ([pattern]) => pattern.endsWith("*") && key.startsWith(pattern.slice(0, -1)),
    );
    if (prefixEntry) {
      return prefixEntry[1];
    }
    return { status: 0, stdout: "", stderr: "" };
  };

  return { invocations, run };
}

describe("executeIssueWork", () => {
  test("runs cursor worker, quality gates, publish commit, and opens a PR", () => {
    const repoRoot = createTempRepoRoot();
    const runId = "issue-000025-run-0001";
    const worktreePath = resolve(repoRoot, ".ralph/worktrees", runId);
    const artifactPath = resolve(repoRoot, ".ralph/artifacts", runId);
    const containerName = "ralph-issue-000025-run-0001";

    const { invocations, run } = createRunner({
      "gh issue view 25 --repo thanarie/hue-manager --json number,title,body": {
        status: 0,
        stdout: JSON.stringify({
          number: 25,
          title: "Test issue title",
          body: "Test issue body",
        }),
        stderr: "",
      },
      [`git -C ${worktreePath} diff --cached --quiet`]: {
        status: 1,
        stdout: "",
        stderr: "",
      },
      [`git -C ${worktreePath} rev-parse HEAD`]: {
        status: 0,
        stdout: "abc123\n",
        stderr: "",
      },
      "gh pr list --repo thanarie/hue-manager --head ralph/issue-000025 --state open --json url": {
        status: 0,
        stdout: "[]",
        stderr: "",
      },
      "gh pr create --repo thanarie/hue-manager --base main --head ralph/issue-000025 --title Ralph: #25 Test issue title --body Automated Ralph run issue-000025-run-0001.\n\nCloses #25":
        {
          status: 0,
          stdout: "https://github.com/thanarie/hue-manager/pull/100\n",
          stderr: "",
        },
    });

    const result = executeIssueWork(
      {
        repo: "thanarie/hue-manager",
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
    expect(result.prUrl).toBe("https://github.com/thanarie/hue-manager/pull/100");
    const commands = invocations.map((entry) => `${entry.command} ${entry.args.join(" ")}`);
    expect(commands).toContain(
      "gh issue view 25 --repo thanarie/hue-manager --json number,title,body",
    );
    expect(commands).toContain(`git worktree add --detach ${worktreePath} main`);
    expect(commands).toContain(`git -C ${worktreePath} checkout -B ralph/issue-000025 main`);
    expect(
      commands.some(
        (command) =>
          command.startsWith(
            `docker run --name ${containerName} --entrypoint sh --workdir /workspace --volume ${worktreePath}:/workspace --volume ${artifactPath}:/artifacts`,
          ) &&
          command.includes(
            "agent -p --force --trust --workspace /workspace --model gpt-5.3-codex --output-format stream-json --stream-partial-output",
          ),
      ),
    ).toBe(true);
    expect(commands).toContain(`vp run build`);
    expect(commands).toContain(`vp test`);
    expect(commands).toContain(`vp check --fix`);
    expect(commands).toContain(`git -C ${worktreePath} add -A`);
    expect(commands).toContain(`git -C ${worktreePath} commit -m chore(ralph): implement #25`);
    expect(commands).toContain(`git -C ${worktreePath} push -u origin ralph/issue-000025`);

    expect(readFileSync(resolve(artifactPath, "worker.stdout.log"), "utf8")).toBe("");
    expect(readFileSync(resolve(artifactPath, "worker.stderr.log"), "utf8")).toBe("");
    expect(readFileSync(resolve(artifactPath, "cursor-prompt.md"), "utf8")).toContain(
      "Test issue title",
    );
    expect(JSON.parse(readFileSync(resolve(artifactPath, "result.json"), "utf8"))).toEqual({
      status: "succeeded",
      completedAt: expect.any(String),
    });
  });

  test("enforces worker timeout and still cleans up the container", () => {
    const repoRoot = createTempRepoRoot();
    const runId = "issue-000025-run-0001";
    const containerName = "ralph-issue-000025-run-0001";
    const timeoutError = new Error("timed out") as NodeJS.ErrnoException;
    timeoutError.code = "ETIMEDOUT";

    const { invocations, run } = createRunner({
      "gh issue view 25 --repo thanarie/hue-manager --json number,title,body": {
        status: 0,
        stdout: JSON.stringify({
          number: 25,
          title: "Timeout case",
          body: "",
        }),
        stderr: "",
      },
      "docker run *": {
        status: null,
        stdout: "",
        stderr: "",
        error: timeoutError,
      },
    });

    expect(() =>
      executeIssueWork(
        {
          repo: "thanarie/hue-manager",
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

  test("removes stale Ralph worktree already using issue branch", () => {
    const repoRoot = createTempRepoRoot();
    const runId = "issue-000025-run-0002";
    const stalePath = resolve(repoRoot, ".ralph/worktrees", "issue-000025-run-0001");
    const timeoutError = new Error("timed out") as NodeJS.ErrnoException;
    timeoutError.code = "ETIMEDOUT";

    const { invocations, run } = createRunner({
      "gh issue view 25 --repo thanarie/hue-manager --json number,title,body": {
        status: 0,
        stdout: JSON.stringify({
          number: 25,
          title: "Stale worktree cleanup",
          body: "",
        }),
        stderr: "",
      },
      "git worktree list --porcelain": {
        status: 0,
        stdout: [
          `worktree ${stalePath}`,
          "HEAD 4ad61de7c",
          "branch refs/heads/ralph/issue-000025",
          "",
        ].join("\n"),
        stderr: "",
      },
      "docker run *": {
        status: null,
        stdout: "",
        stderr: "",
        error: timeoutError,
      },
    });

    expect(() =>
      executeIssueWork(
        {
          repo: "thanarie/hue-manager",
          issueNumber: 25,
          runId,
          baseBranch: "main",
          workerImage: "node:22",
          workerTimeoutMs: 1000,
          repoRoot,
        },
        run,
      ),
    ).toThrow("worker timed out after 1000ms");

    const commands = invocations.map((entry) => `${entry.command} ${entry.args.join(" ")}`);
    expect(commands).toContain("git worktree list --porcelain");
    expect(commands).toContain(`git worktree remove --force ${stalePath}`);
  });
});
