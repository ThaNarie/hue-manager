import { runGh } from "./github.js";

type GhIssue = {
  number: number;
  title: string;
  body?: string | null;
};

type GhIssueState = {
  state: string;
};

export type ParsedDependencies =
  | { status: "none"; dependencies: number[] }
  | { status: "valid"; dependencies: number[] }
  | { status: "invalid"; dependencies: number[]; reason: string };

export type EligibleIssue = {
  number: number;
  title: string;
  dependencies: number[];
};

export type IneligibleIssue = {
  number: number;
  title: string;
  reason: string;
};

export type PollPlan = {
  eligible: EligibleIssue[];
  ineligible: IneligibleIssue[];
};

const BLOCKED_BY_HEADING = "## Blocked by";
const BLOCKED_BY_LINE_PATTERN = /^- Blocked by #(\d+)$/;

export function pollIssuePlan(repo: string): PollPlan {
  const readyIssues = listOpenReadyIssues(repo);
  const dependencyState = buildDependencyState(repo, readyIssues);

  const eligible: EligibleIssue[] = [];
  const ineligible: IneligibleIssue[] = [];

  for (const issue of readyIssues) {
    const parsed = parseBlockedByDependencies(issue.body ?? "");
    if (parsed.status === "invalid") {
      ineligible.push({
        number: issue.number,
        title: issue.title,
        reason: parsed.reason,
      });
      continue;
    }

    const blockedDependency = parsed.dependencies.find((number) => {
      return dependencyState.get(number) !== "CLOSED";
    });

    if (blockedDependency !== undefined) {
      ineligible.push({
        number: issue.number,
        title: issue.title,
        reason: `blocked by #${blockedDependency}`,
      });
      continue;
    }

    eligible.push({
      number: issue.number,
      title: issue.title,
      dependencies: parsed.dependencies,
    });
  }

  eligible.sort((a, b) => a.number - b.number);
  ineligible.sort((a, b) => a.number - b.number);

  return { eligible, ineligible };
}

function listOpenReadyIssues(repo: string): GhIssue[] {
  const result = runGh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "ai:ready",
    "--limit",
    "200",
    "--json",
    "number,title,body",
  ]);

  const issues = JSON.parse(result.stdout) as GhIssue[];
  return issues.sort((a, b) => a.number - b.number);
}

function buildDependencyState(repo: string, issues: GhIssue[]): Map<number, string> {
  const dependencyNumbers = new Set<number>();
  for (const issue of issues) {
    const parsed = parseBlockedByDependencies(issue.body ?? "");
    if (parsed.status !== "invalid") {
      for (const number of parsed.dependencies) {
        dependencyNumbers.add(number);
      }
    }
  }

  const state = new Map<number, string>();
  for (const number of dependencyNumbers) {
    try {
      const result = runGh([
        "issue",
        "view",
        String(number),
        "--repo",
        repo,
        "--json",
        "state",
      ]);
      const parsed = JSON.parse(result.stdout) as GhIssueState;
      state.set(number, parsed.state);
    } catch {
      state.set(number, "UNKNOWN");
    }
  }

  return state;
}

export function parseBlockedByDependencies(body: string): ParsedDependencies {
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === BLOCKED_BY_HEADING);
  if (headingIndex === -1) {
    return { status: "none", dependencies: [] };
  }

  const sectionLines: string[] = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      break;
    }
    if (trimmed.length === 0) {
      continue;
    }
    sectionLines.push(trimmed);
  }

  if (sectionLines.length === 0) {
    return { status: "valid", dependencies: [] };
  }

  const dependencies: number[] = [];
  for (const line of sectionLines) {
    const match = line.match(BLOCKED_BY_LINE_PATTERN);
    if (!match) {
      return {
        status: "invalid",
        dependencies: [],
        reason: "malformed blocked-by section",
      };
    }
    dependencies.push(Number(match[1]));
  }

  const uniqueSortedDependencies = [...new Set(dependencies)].sort((a, b) => a - b);
  return { status: "valid", dependencies: uniqueSortedDependencies };
}
