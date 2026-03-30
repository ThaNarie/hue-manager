import type { RalphConfig } from "./types.js";
import type { EligibleIssue } from "./issue-selection.js";
import type { CommentRerunTrigger } from "./comment-reruns.js";
import {
  claimIssue,
  getAuthenticatedActorLogin,
  transitionIssueLifecycleLabel,
} from "./issue-lifecycle.js";
import { RalphStateStore } from "./state-store.js";
import { executeIssueWork } from "./worker-execution.js";

export function runEligibleIssue(
  config: RalphConfig,
  issue: EligibleIssue,
  options: { dryRun: boolean },
): void {
  runIssueAttempt(config, issue.number, { type: "poll" }, options);
}

export function runCommentTriggeredIssue(
  config: RalphConfig,
  trigger: CommentRerunTrigger,
  options: { dryRun: boolean },
): void {
  runIssueAttempt(
    config,
    trigger.issueNumber,
    { type: "comment", commentId: trigger.commentId, command: trigger.command },
    options,
  );
}

function runIssueAttempt(
  config: RalphConfig,
  issueNumber: number,
  trigger: { type: "poll" } | { type: "comment"; commentId: number; command: string },
  options: { dryRun: boolean },
): void {
  const stateStore = new RalphStateStore();
  try {
    if (options.dryRun) {
      const previewRunId = stateStore.peekNextRunId(issueNumber);
      console.log(`[Ralph] dry-run: next run id for #${issueNumber} would be ${previewRunId}`);
      return;
    }

    let runIdForCommentTrigger: string | null = null;
    try {
      if (trigger.type === "comment") {
        const consumed = stateStore.createCommentTriggeredRunAttempt(
          issueNumber,
          trigger.commentId,
        );
        if (!consumed) {
          console.log(
            `[Ralph] skipped #${issueNumber}: command comment ${trigger.commentId} already consumed.`,
          );
          return;
        }
        runIdForCommentTrigger = consumed.runId;
        transitionIssueLifecycleLabel(config.repo, issueNumber, "ai:ready");
        console.log(
          `[Ralph] accepted ${trigger.command} from comment ${trigger.commentId} on #${issueNumber}`,
        );
        console.log(`[Ralph] transitioned #${issueNumber} to ai:ready`);
      }

      const actorLogin = getAuthenticatedActorLogin();
      const claimResult = claimIssue(config.repo, issueNumber, actorLogin);
      if (claimResult.status !== "claimed") {
        if (runIdForCommentTrigger !== null) {
          stateStore.updateRunStatus(runIdForCommentTrigger, "failed", {
            failureReason: `claim failed: ${claimResult.reason}`,
          });
        }
        console.log(
          `[Ralph] skipped #${issueNumber}: could not claim issue (${claimResult.reason}).`,
        );
        return;
      }
      console.log(`[Ralph] claimed #${issueNumber} as ${actorLogin}`);

      const run =
        runIdForCommentTrigger === null
          ? stateStore.createRunAttempt({
              issueNumber,
              triggerType: "poll",
            })
          : stateStore.getRunAttempt(runIdForCommentTrigger);
      console.log(`[Ralph] created run ${run.runId} for #${issueNumber}`);

      transitionIssueLifecycleLabel(config.repo, issueNumber, "ai:in-progress");
      console.log(`[Ralph] transitioned #${issueNumber} to ai:in-progress`);
      stateStore.updateRunStatus(run.runId, "running");
      console.log(`[Ralph] run ${run.runId} marked running`);

      try {
        executeIssueWork({
          repo: config.repo,
          issueNumber,
          runId: run.runId,
          baseBranch: config.baseBranch,
          workerImage: config.workerImage,
          workerTimeoutMs: config.workerTimeoutMs,
        });
        stateStore.updateRunStatus(run.runId, "succeeded");
        transitionIssueLifecycleLabel(config.repo, issueNumber, "ai:review");
        console.log(`[Ralph] transitioned #${issueNumber} to ai:review`);
      } catch (error) {
        const failureReason = error instanceof Error ? error.message : String(error);
        stateStore.updateRunStatus(run.runId, "failed", { failureReason });
        transitionIssueLifecycleLabel(config.repo, issueNumber, "ai:failed");
        console.log(`[Ralph] transitioned #${issueNumber} to ai:failed`);
        console.error(`[Ralph] run ${run.runId} failed: ${failureReason}`);
      }
    } catch (error) {
      if (runIdForCommentTrigger !== null) {
        const failureReason = error instanceof Error ? error.message : String(error);
        try {
          stateStore.updateRunStatus(runIdForCommentTrigger, "failed", { failureReason });
        } catch {
          // Keep original error as primary failure signal for scheduler logging.
        }
      }
      throw error;
    }
  } finally {
    stateStore.close();
  }
}
