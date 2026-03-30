import type { RalphConfig } from "./types.js";
import type { EligibleIssue } from "./issue-selection.js";
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
  const stateStore = new RalphStateStore();
  try {
    if (options.dryRun) {
      const previewRunId = stateStore.peekNextRunId(issue.number);
      console.log(`[Ralph] dry-run: next run id for #${issue.number} would be ${previewRunId}`);
      return;
    }

    const actorLogin = getAuthenticatedActorLogin();
    const claimResult = claimIssue(config.repo, issue.number, actorLogin);
    if (claimResult.status !== "claimed") {
      console.log(
        `[Ralph] skipped #${issue.number}: could not claim issue (${claimResult.reason}).`,
      );
      return;
    }
    console.log(`[Ralph] claimed #${issue.number} as ${actorLogin}`);

    const run = stateStore.createRunAttempt({
      issueNumber: issue.number,
      triggerType: "poll",
    });
    console.log(`[Ralph] created run ${run.runId} for #${issue.number}`);

    transitionIssueLifecycleLabel(config.repo, issue.number, "ai:in-progress");
    console.log(`[Ralph] transitioned #${issue.number} to ai:in-progress`);
    stateStore.updateRunStatus(run.runId, "running");
    console.log(`[Ralph] run ${run.runId} marked running`);

    try {
      executeIssueWork({
        repo: config.repo,
        issueNumber: issue.number,
        runId: run.runId,
        baseBranch: config.baseBranch,
        workerImage: config.workerImage,
        workerTimeoutMs: config.workerTimeoutMs,
      });
      stateStore.updateRunStatus(run.runId, "succeeded");
      transitionIssueLifecycleLabel(config.repo, issue.number, "ai:review");
      console.log(`[Ralph] transitioned #${issue.number} to ai:review`);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      stateStore.updateRunStatus(run.runId, "failed", { failureReason });
      transitionIssueLifecycleLabel(config.repo, issue.number, "ai:failed");
      console.log(`[Ralph] transitioned #${issue.number} to ai:failed`);
      console.error(`[Ralph] run ${run.runId} failed: ${failureReason}`);
    }
  } finally {
    stateStore.close();
  }
}
