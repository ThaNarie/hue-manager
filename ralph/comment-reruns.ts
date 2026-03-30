import { runGh } from "./github.js";
import { RalphStateStore } from "./state-store.js";

type GhRunner = typeof runGh;

type GhIssue = {
  number: number;
  title: string;
};

type GhIssueComment = {
  id: number;
  body: string;
};

type GhIssueCommentsResponse = {
  comments: GhIssueComment[];
};

export type RerunCommand = "retry" | "apply-feedback";

export type CommentRerunTrigger = {
  issueNumber: number;
  issueTitle: string;
  commentId: number;
  command: RerunCommand;
};

const RERUN_COMMAND_PATTERN = /^\s*(?:@ralph\s+)?\/?(retry|apply-feedback)\s*$/im;

export function pollCommentRerunTriggers(
  repo: string,
  options: { gh?: GhRunner; stateStore?: RalphStateStore } = {},
): CommentRerunTrigger[] {
  const gh = options.gh ?? runGh;
  const providedStore = options.stateStore;
  const stateStore = providedStore ?? new RalphStateStore();

  try {
    const candidateIssues = listCandidateIssues(repo, gh);
    const triggers: CommentRerunTrigger[] = [];

    for (const issue of candidateIssues) {
      const comments = listIssueComments(repo, issue.number, gh);
      const unconsumedCommentIds = stateStore.getUnconsumedCommentIds(
        issue.number,
        comments.map((comment) => comment.id),
      );
      const commentsById = new Map(comments.map((comment) => [comment.id, comment]));

      for (const commentId of unconsumedCommentIds) {
        const comment = commentsById.get(commentId);
        if (!comment) {
          continue;
        }
        const command = parseRerunCommand(comment.body);
        if (!command) {
          continue;
        }
        triggers.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          commentId,
          command,
        });
      }
    }

    triggers.sort((left, right) => {
      if (left.issueNumber !== right.issueNumber) {
        return left.issueNumber - right.issueNumber;
      }
      return left.commentId - right.commentId;
    });
    return triggers;
  } finally {
    if (!providedStore) {
      stateStore.close();
    }
  }
}

export function parseRerunCommand(body: string): RerunCommand | null {
  const match = body.match(RERUN_COMMAND_PATTERN);
  if (!match) {
    return null;
  }
  return match[1] as RerunCommand;
}

function listCandidateIssues(repo: string, gh: GhRunner): GhIssue[] {
  const reviewIssues = listOpenIssuesByLabel(repo, "ai:review", gh);
  const failedIssues = listOpenIssuesByLabel(repo, "ai:failed", gh);
  const deduped = new Map<number, GhIssue>();
  for (const issue of [...reviewIssues, ...failedIssues]) {
    deduped.set(issue.number, issue);
  }
  return [...deduped.values()].sort((left, right) => left.number - right.number);
}

function listOpenIssuesByLabel(repo: string, label: string, gh: GhRunner): GhIssue[] {
  const result = gh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    label,
    "--limit",
    "200",
    "--json",
    "number,title",
  ]);
  return JSON.parse(result.stdout) as GhIssue[];
}

function listIssueComments(repo: string, issueNumber: number, gh: GhRunner): GhIssueComment[] {
  const result = gh(["issue", "view", String(issueNumber), "--repo", repo, "--json", "comments"]);
  const parsed = JSON.parse(result.stdout) as GhIssueCommentsResponse;
  return parsed.comments;
}
