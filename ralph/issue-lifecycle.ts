import { runGh } from "./github.js";

const LIFECYCLE_LABELS = new Set([
  "ai:ready",
  "ai:claimed",
  "ai:in-progress",
  "ai:review",
  "ai:blocked",
  "ai:failed",
] as const);

export type LifecycleLabel =
  | "ai:ready"
  | "ai:claimed"
  | "ai:in-progress"
  | "ai:review"
  | "ai:blocked"
  | "ai:failed";

type GhIssueSnapshot = {
  number: number;
  state: string;
  labels: Array<{ name: string }>;
  assignees: Array<{ login: string }>;
};

type GhRunner = typeof runGh;

export type ClaimResult = { status: "claimed" } | { status: "skipped"; reason: string };

export function getAuthenticatedActorLogin(gh: GhRunner = runGh): string {
  return gh(["api", "user", "--jq", ".login"]).stdout.trim();
}

export function claimIssue(
  repo: string,
  issueNumber: number,
  actorLogin: string,
  gh: GhRunner = runGh,
): ClaimResult {
  const before = getIssueSnapshot(repo, issueNumber, gh);
  if (before.state !== "OPEN") {
    return { status: "skipped", reason: "issue is not open" };
  }

  const labels = new Set(before.labels.map((label) => label.name));
  if (!labels.has("ai:ready")) {
    return { status: "skipped", reason: "issue is not in ai:ready" };
  }

  const assignees = new Set(before.assignees.map((assignee) => assignee.login));
  const hasForeignAssignee = [...assignees].some((login) => login !== actorLogin);
  if (hasForeignAssignee) {
    return { status: "skipped", reason: "issue is already assigned to a different user" };
  }

  applyLifecycleTransition(repo, issueNumber, "ai:claimed", gh, actorLogin);

  const after = getIssueSnapshot(repo, issueNumber, gh);
  const afterLabels = new Set(after.labels.map((label) => label.name));
  const afterAssignees = new Set(after.assignees.map((assignee) => assignee.login));
  if (
    !afterLabels.has("ai:claimed") ||
    afterLabels.has("ai:ready") ||
    !afterAssignees.has(actorLogin)
  ) {
    return { status: "skipped", reason: "claim verification failed" };
  }

  return { status: "claimed" };
}

export function transitionIssueLifecycleLabel(
  repo: string,
  issueNumber: number,
  targetLabel: LifecycleLabel,
  gh: GhRunner = runGh,
): void {
  applyLifecycleTransition(repo, issueNumber, targetLabel, gh);
}

function applyLifecycleTransition(
  repo: string,
  issueNumber: number,
  targetLabel: LifecycleLabel,
  gh: GhRunner,
  assignee?: string,
): void {
  const snapshot = getIssueSnapshot(repo, issueNumber, gh);
  const labelsToRemove = snapshot.labels
    .map((label) => label.name)
    .filter(
      (labelName) => LIFECYCLE_LABELS.has(labelName as LifecycleLabel) && labelName !== targetLabel,
    );

  const args = ["issue", "edit", String(issueNumber), "--repo", repo, "--add-label", targetLabel];
  if (assignee) {
    args.push("--add-assignee", assignee);
  }
  for (const label of labelsToRemove) {
    args.push("--remove-label", label);
  }

  gh(args);
}

function getIssueSnapshot(repo: string, issueNumber: number, gh: GhRunner): GhIssueSnapshot {
  const result = gh([
    "issue",
    "view",
    String(issueNumber),
    "--repo",
    repo,
    "--json",
    "number,state,labels,assignees",
  ]);
  return JSON.parse(result.stdout) as GhIssueSnapshot;
}
