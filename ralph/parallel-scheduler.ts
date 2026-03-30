import type { PollPlan, EligibleIssue } from "./issue-selection.js";
import type { RalphConfig } from "./types.js";

type PollIssuePlanFn = (repo: string) => PollPlan;
type RunEligibleIssueFn = (
  config: RalphConfig,
  issue: EligibleIssue,
  options: { dryRun: boolean },
) => void | Promise<void>;
type SleepFn = (ms: number) => Promise<void>;
type JitterFn = () => number;
type Logger = (message: string) => void;
type ErrorLogger = (message: string) => void;

export type ParallelSchedulerDeps = {
  pollIssuePlan: PollIssuePlanFn;
  runEligibleIssue: RunEligibleIssueFn;
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
  const runIssue = deps.runEligibleIssue ?? (() => undefined);
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
    try {
      plan = poll(config.repo);
    } catch (caught) {
      error(`[Ralph] tick failed: ${caught instanceof Error ? caught.message : String(caught)}`);
      await sleepFn(config.loopIntervalMs);
      continue;
    }

    const availableSlots = Math.max(0, config.maxWorkers - activeWorkers.size);
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

    const hasEligibleWork = eligibleSorted.length > 0;
    if (hasEligibleWork) {
      idleCycles = 0;
    }

    if (options.shouldStop()) {
      break;
    }

    const delayMs = computeNextDelayMs(config, {
      hasEligibleWork,
      hasActiveWorkers: activeWorkers.size > 0,
      idleCycles,
      jitter,
    });

    if (!hasEligibleWork && activeWorkers.size === 0) {
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
