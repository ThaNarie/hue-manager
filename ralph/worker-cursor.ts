import type { CommandRunner, ExecuteIssueWorkInput } from "./worker-execution.js";

export type IssueContext = {
  title: string;
  body: string;
};

export function getIssueContext(
  repo: string,
  issueNumber: number,
  runCommand: CommandRunner,
): IssueContext {
  const result = runCommand(
    "gh",
    ["issue", "view", String(issueNumber), "--repo", repo, "--json", "number,title,body"],
    {},
  );
  if (result.error) {
    throw new Error(`failed to load issue context from GitHub: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`failed to load issue context from GitHub: ${result.stderr.trim()}`);
  }

  const payload = JSON.parse(result.stdout) as { title?: string; body?: string };
  return {
    title: payload.title ?? "(untitled)",
    body: payload.body ?? "",
  };
}

export function renderCursorPrompt(
  input: ExecuteIssueWorkInput,
  issueBranch: string,
  context: IssueContext,
): string {
  return [
    `Implement GitHub issue #${input.issueNumber} in ${input.repo}.`,
    "",
    "Execution context:",
    `- Run ID: ${input.runId}`,
    `- Branch: ${issueBranch}`,
    "",
    `Issue title: ${context.title}`,
    "",
    "Issue body:",
    context.body,
    "",
    "Requirements:",
    "- Work only on this issue.",
    "- Keep changes minimal and deterministic.",
    "- Do not open multiple commits; leave one final publishable commit.",
  ].join("\n");
}

export function getCursorWorkerScript(): string {
  return [
    "set -euo pipefail",
    "if command -v cursor-agent >/dev/null 2>&1; then",
    '  cursor-agent --force --print --cwd /workspace "$(cat /artifacts/cursor-prompt.md)" 2>&1 | tee /artifacts/worker.log',
    "elif command -v cursor >/dev/null 2>&1; then",
    '  cursor --force --print --cwd /workspace "$(cat /artifacts/cursor-prompt.md)" 2>&1 | tee /artifacts/worker.log',
    "else",
    '  echo "Cursor CLI binary not found in worker image." >&2',
    "  exit 1",
    "fi",
  ].join("; ");
}
