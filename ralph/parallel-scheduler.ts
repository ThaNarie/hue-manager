import type { PollPlan, EligibleIssue } from "./issue-selection.js";
import type { RalphConfig } from "./types.js";
import type { CommentRerunTrigger } from "./comment-reruns.js";

type PollIssuePlanFn = (repo: string) => PollPlan;
type PollCommentRerunTriggersFn = (repo: string) => CommentRerunTrigger[];
type RunEligibleIssueFn = (
  config: RalphConfig,
  issue: EligibleIssue,
  options: { dryRun: boolean },
) => void | Promise<void>;
type RunCommentTriggeredIssueFn = (
  config: RalphConfig,
  trigger: CommentRerunTrigger,
  options: { dryRun: boolean },
) => void | Promise<void>;
type SleepFn = (ms: number) => Promise<void>;
type JitterFn = () => number;
type Logger = (message: string) => void;
type ErrorLogger = (message: string) => void;

export type ParallelSchedulerDeps = {
  pollIssuePlan: PollIssuePlanFn;
  pollCommentRerunTriggers: PollCommentRerunTriggersFn;
  runEligibleIssue: RunEligibleIssueFn;
  runCommentTriggeredIssue: RunCommentTriggeredIssueFn;
  sleep: SleepFn;
  jitter: JitterFn;
  log: Logger;
  error: ErrorLogger;
};

export async function runParallelScheduler(
  config: RalphConfig,
  options: { dryRun: boolean; shouldStop: () => boolean },
  deps: Partial<ParallelSchedulerDeps> = {},
): Promise<void> {
  const poll = deps.pollIssuePlan ?? (() => ({ eligible: [], ineligible: [] }));
  const pollCommentReruns = deps.pollCommentRerunTriggers ?? (() => []);
  const runIssue = deps.runEligibleIssue ?? (() => undefined);
  const runCommentTriggeredIssue = deps.runCommentTriggeredIssue ?? (() => undefined);
  const sleepFn = deps.sleep ?? defaultSleep;
  const jitter = deps.jitter ?? Math.random;
  const log = deps.log ?? ((message: string) => console.log(message));
  const error = deps.error ?? ((message: string) => console.error(message));

  const activeWorkers = new Map<number, Promise<void>>();
  let idleCycles = 0;

  while (!options.shouldStop()) {
    const startedAt = new Date().toISOString();
    log(`[Ralph] tick ${startedAt}`);

    let plan: PollPlan;
    let commentTriggers: CommentRerunTrigger[];
    try {
      plan = poll(config.repo);
      commentTriggers = pollCommentReruns(config.repo);
    } catch (caught) {
      error(`[Ralph] tick failed: ${caught instanceof Error ? caught.message : String(caught)}`);
      await sleepFn(config.loopIntervalMs);
      continue;
    }

    let availableSlots = Math.max(0, config.maxWorkers - activeWorkers.size);
    const launchableCommentTriggers = [...commentTriggers]
      .sort((a, b) => {
        if (a.issueNumber !== b.issueNumber) {
          return a.issueNumber - b.issueNumber;
        }
        return a.commentId - b.commentId;
      })
      .filter((trigger) => !activeWorkers.has(trigger.issueNumber))
      .slice(0, availableSlots);

    for (const trigger of launchableCommentTriggers) {
      const promise = Promise.resolve()
        .then(() => runCommentTriggeredIssue(config, trigger, { dryRun: options.dryRun }))
        .catch((caught) => {
          error(
            `[Ralph] scheduler worker #${trigger.issueNumber} crashed: ${
              caught instanceof Error ? caught.message : String(caught)
            }`,
          );
        })
        .finally(() => {
          activeWorkers.delete(trigger.issueNumber);
        });
      activeWorkers.set(trigger.issueNumber, promise);
    }

    availableSlots = Math.max(0, config.maxWorkers - activeWorkers.size);
    const eligibleSorted = [...plan.eligible].sort((a, b) => a.number - b.number);
    const launchableIssues = eligibleSorted
      .filter((issue) => !activeWorkers.has(issue.number))
      .slice(0, availableSlots);

    for (const issue of launchableIssues) {
      const promise = Promise.resolve()
        .then(() => runIssue(config, issue, { dryRun: options.dryRun }))
        .catch((caught) => {
          error(
            `[Ralph] scheduler worker #${issue.number} crashed: ${
              caught instanceof Error ? caught.message : String(caught)
            }`,
          );
        })
        .finally(() => {
          activeWorkers.delete(issue.number);
        });
      activeWorkers.set(issue.number, promise);
    }

    const hasReadyWork = eligibleSorted.length > 0 || commentTriggers.length > 0;
    if (hasReadyWork) {
      idleCycles = 0;
    }

    if (options.shouldStop()) {
      break;
    }

    const delayMs = computeNextDelayMs(config, {
      hasEligibleWork: hasReadyWork,
      hasActiveWorkers: activeWorkers.size > 0,
      idleCycles,
      jitter,
    });

    if (!hasReadyWork && activeWorkers.size === 0) {
      idleCycles += 1;
    }

    await sleepFn(delayMs);
  }

  await Promise.allSettled(activeWorkers.values());
}

function computeNextDelayMs(
  config: RalphConfig,
  input: {
    hasEligibleWork: boolean;
    hasActiveWorkers: boolean;
    idleCycles: number;
    jitter: JitterFn;
  },
): number {
  if (input.hasEligibleWork || input.hasActiveWorkers) {
    return config.loopIntervalMs;
  }

  const cappedBackoff = Math.min(
    config.idleBackoffMaxMs,
    config.loopIntervalMs * 2 ** Math.max(0, input.idleCycles),
  );
  const jitterWindow = config.idleBackoffJitterMs;
  const jitterOffset = jitterWindow === 0 ? 0 : Math.floor(input.jitter() * (jitterWindow + 1));
  return cappedBackoff + jitterOffset;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
