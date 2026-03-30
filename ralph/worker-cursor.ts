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
  const acceptanceCriteria = extractSectionItems(context.body, "Acceptance criteria");
  const blockedBy = extractSectionItems(context.body, "Blocked by");
  const parentPrd = extractSectionItems(context.body, "Parent PRD");

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
    "You MUST satisfy every checklist item below before finishing.",
    "",
    "Hard requirements:",
    "- Scope: implement only this issue.",
    "- Keep changes minimal, deterministic, and aligned with existing project conventions.",
    "- Do not commit or push (the orchestrator handles publish).",
    "- If requirements conflict or dependency work is missing, stop and report a blocker clearly.",
    "",
    "Acceptance criteria checklist:",
    ...formatChecklist(acceptanceCriteria, "No explicit criteria found in issue body."),
    "",
    "Blocked-by dependencies:",
    ...formatChecklist(blockedBy, "No blocked-by entries listed."),
    "",
    "Parent PRD reference:",
    ...formatChecklist(parentPrd, "No parent PRD reference listed."),
    "",
    "Required validation commands (run from /workspace):",
    "- vp run build",
    "- vp test",
    "- vp check --fix",
    "",
    "Completion gate:",
    "- Do not finish until ALL acceptance criteria are either fully implemented and verified, or explicitly reported as blocked with reason.",
    "- If a validation command fails, fix the issue and re-run until passing, or report precise blocker details.",
    "",
    "Final response format (exact headings):",
    "1. What was implemented",
    "2. Validation results",
    "3. Any blockers or follow-up needed",
    "",
    "Final response rules:",
    "- Output markdown only (no preamble).",
    "- Include all three headings exactly once, in the exact order shown above.",
    "- Under each heading, provide concrete bullets with file paths/commands/results.",
  ].join("\n");
}

export function getCursorWorkerScript(): string {
  return [
    "set -eu",
    'export PATH="$HOME/.local/bin:$HOME/.cursor/bin:$PATH"',
    "if ! command -v agent >/dev/null 2>&1; then",
    "  if command -v apk >/dev/null 2>&1; then",
    "    apk add --no-cache bash curl >/dev/null",
    "  fi",
    "  if command -v curl >/dev/null 2>&1 && command -v bash >/dev/null 2>&1; then",
    "    curl https://cursor.com/install -fsS | bash",
    '    export PATH="$HOME/.local/bin:$HOME/.cursor/bin:$PATH"',
    "  else",
    '    echo "Cursor CLI is missing. Install prerequisites (curl, bash) and run: curl https://cursor.com/install -fsS | bash" >&2',
    "    exit 1",
    "  fi",
    "fi",
    "if ! command -v agent >/dev/null 2>&1; then",
    '  echo "Cursor CLI install completed, but `agent` was not found on PATH." >&2',
    "  exit 1",
    "fi",
    'agent -p --force --trust --workspace /workspace --model gpt-5.3-codex --output-format stream-json --stream-partial-output "$(cat /artifacts/cursor-prompt.md)" 2>&1 | tee /artifacts/worker.log',
  ].join("\n");
}

function extractSectionItems(body: string, sectionTitle: string): string[] {
  const lines = body.split("\n");
  const normalizedTarget = normalizeHeading(sectionTitle);

  let inSection = false;
  const items: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("## ")) {
      const heading = normalizeHeading(line.slice(3));
      if (inSection && heading !== normalizedTarget) {
        break;
      }
      inSection = heading === normalizedTarget;
      continue;
    }

    if (!inSection || line.length === 0) {
      continue;
    }

    const checkboxMatch = line.match(/^-\s*\[(?: |x|X)\]\s+(.*)$/);
    if (checkboxMatch) {
      items.push(checkboxMatch[1].trim());
      continue;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      items.push(bulletMatch[1].trim());
      continue;
    }
    items.push(line);
  }

  return items;
}

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatChecklist(items: string[], emptyMessage: string): string[] {
  if (items.length === 0) {
    return [`- ${emptyMessage}`];
  }
  return items.map((item) => `- ${item}`);
}
