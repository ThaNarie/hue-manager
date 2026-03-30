import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { RalphStateStore } from "./state-store.js";
import { reconcileStartupRuns } from "./startup-reconciliation.js";
import type { RalphConfig } from "./types.js";

const tempPaths: string[] = [];
const config: RalphConfig = {
  repo: "thanarie/hue-manager",
  loopIntervalMs: 60_000,
  maxWorkers: 1,
  idleBackoffMaxMs: 300_000,
  idleBackoffJitterMs: 250,
  baseBranch: "main",
  workerImage: "hue-manager-ralph-worker:latest",
  workerTimeoutMs: 900_000,
  cleanupRetentionDays: 14,
  requiredLabels: [],
};

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function createStore(): RalphStateStore {
  const tempDir = mkdtempSync(join(tmpdir(), "ralph-startup-reconciliation-"));
  tempPaths.push(tempDir);
  return new RalphStateStore(join(tempDir, "state.db"));
}

describe("reconcileStartupRuns", () => {
  test("marks orphaned running runs as failed and transitions issues to ai:failed", () => {
    const store = createStore();
    const orphanedStopped = store.createRunAttempt({ issueNumber: 23, triggerType: "poll" });
    const orphanedMissing = store.createRunAttempt({ issueNumber: 24, triggerType: "poll" });
    const active = store.createRunAttempt({ issueNumber: 25, triggerType: "poll" });
    store.updateRunStatus(orphanedStopped.runId, "running");
    store.updateRunStatus(orphanedMissing.runId, "running");
    store.updateRunStatus(active.runId, "running");

    const transitions: Array<{ issueNumber: number; label: string }> = [];
    reconcileStartupRuns(config, {
      stateStore: store,
      getContainerSnapshot: () => ({
        running: new Set([`ralph-${active.runId}`]),
        all: new Set([`ralph-${active.runId}`, `ralph-${orphanedStopped.runId}`]),
      }),
      transitionIssueLifecycleLabel: (_repo, issueNumber, label) => {
        transitions.push({ issueNumber, label });
      },
      log: () => undefined,
      error: () => undefined,
    });

    const stoppedRun = store.getRunAttempt(orphanedStopped.runId);
    const missingRun = store.getRunAttempt(orphanedMissing.runId);
    const activeRun = store.getRunAttempt(active.runId);

    expect(stoppedRun.status).toBe("failed");
    expect(stoppedRun.failureReason).toContain("is stopped");
    expect(missingRun.status).toBe("failed");
    expect(missingRun.failureReason).toContain("not found");
    expect(activeRun.status).toBe("running");
    expect(activeRun.failureReason).toBeNull();
    expect(transitions).toEqual([
      { issueNumber: 23, label: "ai:failed" },
      { issueNumber: 24, label: "ai:failed" },
    ]);
    store.close();
  });

  test("does nothing when no runs are in-progress", () => {
    const store = createStore();
    const completed = store.createRunAttempt({ issueNumber: 29, triggerType: "poll" });
    store.updateRunStatus(completed.runId, "succeeded");

    let transitionCalls = 0;
    reconcileStartupRuns(config, {
      stateStore: store,
      getContainerSnapshot: () => ({ running: new Set(), all: new Set() }),
      transitionIssueLifecycleLabel: () => {
        transitionCalls += 1;
      },
      log: () => undefined,
      error: () => undefined,
    });

    expect(store.getRunAttempt(completed.runId).status).toBe("succeeded");
    expect(transitionCalls).toBe(0);
    store.close();
  });
});
