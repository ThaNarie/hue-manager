import { describe, expect, test } from "vite-plus/test";

import { pushAndOpenOrReusePr } from "./worker-publish.js";
import type { CommandResult, CommandRunner, ExecuteIssueWorkInput } from "./worker-execution.js";

type Invocation = {
  command: string;
  args: string[];
};

function createRunner(responses: Record<string, CommandResult>): {
  invocations: Invocation[];
  run: CommandRunner;
} {
  const invocations: Invocation[] = [];
  const run: CommandRunner = (command, args) => {
    invocations.push({ command, args: [...args] });
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

const input: ExecuteIssueWorkInput = {
  repo: "thanarie/hue-manager",
  issueNumber: 37,
  runId: "issue-000037-run-0001",
  baseBranch: "main",
  workerImage: "node:22",
  workerTimeoutMs: 900_000,
};

const finalOutput = [
  "1. What was implemented",
  "- Added final-output artifact persistence.",
  "",
  "2. Validation results",
  "- vp test",
  "",
  "3. Any blockers or follow-up needed",
  "- None.",
].join("\n");

const expectedPrBody = [
  "Automated Ralph run issue-000037-run-0001.",
  "",
  "Closes #37",
  "",
  "## Ralph final output",
  "",
  finalOutput,
  "",
  "Artifact: `.ralph/artifacts/issue-000037-run-0001/final-output.md`",
].join("\n");

describe("pushAndOpenOrReusePr", () => {
  test("embeds final output artifact content in newly created PR body", () => {
    const { run } = createRunner({
      "gh pr list --repo thanarie/hue-manager --head ralph/issue-000037 --state open --json url": {
        status: 0,
        stdout: "[]",
        stderr: "",
      },
      [`gh pr create --repo thanarie/hue-manager --base main --head ralph/issue-000037 --title Ralph: #37 Persist final output --body ${expectedPrBody}`]:
        {
          status: 0,
          stdout: "https://github.com/thanarie/hue-manager/pull/137\n",
          stderr: "",
        },
    });

    const prUrl = pushAndOpenOrReusePr(
      input,
      "ralph/issue-000037",
      "Persist final output",
      "/tmp/worktree",
      finalOutput,
      run,
      (runner, command, args, options, errorPrefix) => {
        const result = runner(command, args, options);
        if (result.error || result.status !== 0) {
          throw new Error(`${errorPrefix}: ${result.stderr}`);
        }
      },
    );

    expect(prUrl).toBe("https://github.com/thanarie/hue-manager/pull/137");
  });

  test("posts final output summary comment when an open PR already exists", () => {
    const { invocations, run } = createRunner({
      "gh pr list --repo thanarie/hue-manager --head ralph/issue-000037 --state open --json url": {
        status: 0,
        stdout: JSON.stringify([{ url: "https://github.com/thanarie/hue-manager/pull/137" }]),
        stderr: "",
      },
    });

    const prUrl = pushAndOpenOrReusePr(
      input,
      "ralph/issue-000037",
      "Persist final output",
      "/tmp/worktree",
      finalOutput,
      run,
      (runner, command, args, options, errorPrefix) => {
        const result = runner(command, args, options);
        if (result.error || result.status !== 0) {
          throw new Error(`${errorPrefix}: ${result.stderr}`);
        }
      },
    );

    expect(prUrl).toBe("https://github.com/thanarie/hue-manager/pull/137");
    expect(invocations.map((entry) => `${entry.command} ${entry.args.join(" ")}`)).toContain(
      `gh pr comment https://github.com/thanarie/hue-manager/pull/137 --repo thanarie/hue-manager --body Ralph rerun summary for \`issue-000037-run-0001\`:\n\n## Ralph final output\n\n${finalOutput}\n\nArtifact: \`.ralph/artifacts/issue-000037-run-0001/final-output.md\``,
    );
  });
});
