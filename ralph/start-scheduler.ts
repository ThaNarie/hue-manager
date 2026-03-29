import { Worker } from "node:worker_threads";

import { loadSecrets } from "./env.js";
import {
  claimIssue,
  getAuthenticatedActorLogin,
  transitionIssueLifecycleLabel,
} from "./issue-lifecycle.js";
import { pollIssuePlan, type EligibleIssue } from "./issue-selection.js";
import { RalphStateStore } from "./state-store.js";
import type { RalphConfig } from "./types.js";

const THREAD_ENTRY_URL = new URL("./worker-thread-entry.js", import.meta.url);

export type BackoffDelay = {
  waitMs: number;
  nextBackoffMs: number;
};

export function selectLaunchCandidates(
  eligible: EligibleIssue[],
  activeIssueNumbers: Set<number>,
  maxWorkers: number,
): EligibleIssue[] {
  const availableSlots = Math.max(0, maxWorkers - activeIssueNumbers.size);
  if (availableSlots === 0) {
    return [];
  }
  return eligible.filter((issue) => !activeIssueNumbers.has(issue.number)).slice(0, availableSlots);
}

export function computeIdleBackoffDelay(
  backoffMs: number,
  maxBackoffMs: number,
  jitterMs: number,
  random: () => number = Math.random,
): BackoffDelay {
  const clampedJitter = Math.max(0, Math.floor(jitterMs));
  const jitter = clampedJitter === 0 ? 0 : Math.floor(random() * (clampedJitter + 1));
  return {
    waitMs: backoffMs + jitter,
    nextBackoffMs: Math.min(maxBackoffMs, backoffMs * 2),
  };
}

export async function runStartLoop(
  config: RalphConfig,
  options: { dryRun: boolean },
): Promise<void> {
  loadSecrets();

  console.log(
    `[Ralph] start: polling ${config.repo} with maxWorkers=${config.maxWorkers}, loopIntervalMs=${config.loopIntervalMs}`,
  );
  console.log(
    `[Ralph] idle backoff: max=${config.idleBackoffMaxMs}ms, jitter=${config.idleBackoffJitterMs}ms`,
  );
  console.log("[Ralph] Press Ctrl+C to stop.");

  const stateStore = new RalphStateStore();
  const activeIssueNumbers = new Set<number>();
  const activeRuns = new Set<Promise<void>>();
  const actorLogin = options.dryRun ? undefined : getAuthenticatedActorLogin();
  let idleBackoffMs = config.loopIntervalMs;
  let stopping = false;

  process.on("SIGINT", () => {
    stopping = true;
  });

  try {
    while (!stopping) {
      const startedAt = new Date().toISOString();
      console.log(
        `[Ralph] tick ${startedAt} active=${activeIssueNumbers.size}/${config.maxWorkers}`,
      );

      const plan = pollIssuePlan(config.repo);
      const candidates = selectLaunchCandidates(
        plan.eligible,
        activeIssueNumbers,
        config.maxWorkers,
      );

      if (candidates.length > 0 && idleBackoffMs !== config.loopIntervalMs) {
        idleBackoffMs = config.loopIntervalMs;
        console.log(`[Ralph] idle backoff reset to ${idleBackoffMs}ms`);
      }

      for (const issue of candidates) {
        const runPromise = launchIssue(config, issue, stateStore, options.dryRun, actorLogin, () =>
          activeIssueNumbers.delete(issue.number),
        ).finally(() => {
          activeRuns.delete(runPromise);
        });
        activeIssueNumbers.add(issue.number);
        activeRuns.add(runPromise);
      }

      if (stopping) {
        break;
      }

      if (plan.eligible.length === 0 && activeIssueNumbers.size === 0) {
        const backoff = computeIdleBackoffDelay(
          idleBackoffMs,
          config.idleBackoffMaxMs,
          config.idleBackoffJitterMs,
        );
        console.log(`[Ralph] idle: sleeping ${backoff.waitMs}ms before next poll`);
        idleBackoffMs = backoff.nextBackoffMs;
        await sleep(backoff.waitMs);
      } else {
        await sleep(config.loopIntervalMs);
      }
    }

    if (activeRuns.size > 0) {
      console.log(`[Ralph] stopping: waiting for ${activeRuns.size} active run(s) to settle`);
      await Promise.allSettled(activeRuns);
    }
  } finally {
    stateStore.close();
  }

  console.log("[Ralph] stopped.");
}

async function launchIssue(
  config: RalphConfig,
  issue: EligibleIssue,
  stateStore: RalphStateStore,
  dryRun: boolean,
  actorLogin: string | undefined,
  onComplete: () => void,
): Promise<void> {
  try {
    if (dryRun) {
      const previewRunId = stateStore.peekNextRunId(issue.number);
      console.log(`[Ralph] dry-run: #${issue.number} would start as ${previewRunId}`);
      return;
    }

    const login = actorLogin ?? getAuthenticatedActorLogin();
    const claimResult = claimIssue(config.repo, issue.number, login);
    if (claimResult.status !== "claimed") {
      console.log(
        `[Ralph] skipped #${issue.number}: could not claim issue (${claimResult.reason}).`,
      );
      return;
    }
    console.log(`[Ralph] claimed #${issue.number} as ${login}`);

    const run = stateStore.createRunAttempt({
      issueNumber: issue.number,
      triggerType: "poll",
    });
    console.log(`[Ralph] created run ${run.runId} for #${issue.number}`);

    transitionIssueLifecycleLabel(config.repo, issue.number, "ai:in-progress");
    stateStore.updateRunStatus(run.runId, "running");
    console.log(`[Ralph] run ${run.runId} marked running`);

    try {
      await executeIssueInWorkerThread({
        repo: config.repo,
        issueNumber: issue.number,
        runId: run.runId,
        baseBranch: config.baseBranch,
        workerImage: config.workerImage,
        workerTimeoutMs: config.workerTimeoutMs,
      });

      stateStore.updateRunStatus(run.runId, "succeeded");
      transitionIssueLifecycleLabel(config.repo, issue.number, "ai:review");
      console.log(`[Ralph] run ${run.runId} succeeded (#${issue.number})`);
    } catch (error) {
      const failureReason = error instanceof Error ? error.message : String(error);
      stateStore.updateRunStatus(run.runId, "failed", { failureReason });
      transitionIssueLifecycleLabel(config.repo, issue.number, "ai:failed");
      console.error(`[Ralph] run ${run.runId} failed: ${failureReason}`);
    }
  } finally {
    onComplete();
  }
}

function executeIssueInWorkerThread(input: {
  repo: string;
  issueNumber: number;
  runId: string;
  baseBranch: string;
  workerImage: string;
  workerTimeoutMs: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(THREAD_ENTRY_URL, { workerData: input });
    let settled = false;

    worker.once("message", (message: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      const payload = message as { ok?: boolean; error?: string };
      if (payload.ok) {
        resolve();
      } else {
        reject(new Error(payload.error ?? "worker thread failed"));
      }
    });

    worker.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    });

    worker.once("exit", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`worker thread exited with code ${code}`));
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
