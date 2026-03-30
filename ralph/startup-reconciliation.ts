import { spawnSync } from "node:child_process";

import { transitionIssueLifecycleLabel } from "./issue-lifecycle.js";
import { RalphStateStore } from "./state-store.js";
import type { RalphConfig } from "./types.js";

type ContainerSnapshot = {
  running: Set<string>;
  all: Set<string>;
};

export type StartupReconciliationDeps = {
  stateStore: RalphStateStore;
  getContainerSnapshot: () => ContainerSnapshot;
  transitionIssueLifecycleLabel: typeof transitionIssueLifecycleLabel;
  log: (message: string) => void;
  error: (message: string) => void;
};

export function reconcileStartupRuns(
  config: RalphConfig,
  deps: Partial<StartupReconciliationDeps> = {},
): void {
  const stateStore = deps.stateStore ?? new RalphStateStore();
  const shouldCloseStore = deps.stateStore === undefined;
  const getContainerSnapshot = deps.getContainerSnapshot ?? defaultGetContainerSnapshot;
  const transition = deps.transitionIssueLifecycleLabel ?? transitionIssueLifecycleLabel;
  const log = deps.log ?? ((message: string) => console.log(message));
  const error = deps.error ?? ((message: string) => console.error(message));

  try {
    const inProgressRuns = stateStore.listRunAttemptsByStatus("running");
    if (inProgressRuns.length === 0) {
      log("[Ralph] startup reconciliation: no in-progress runs found.");
      return;
    }

    const containers = getContainerSnapshot();
    for (const run of inProgressRuns) {
      const containerName = formatContainerName(run.runId);
      if (containers.running.has(containerName)) {
        log(
          `[Ralph] startup reconciliation: keeping ${run.runId} in-progress (container ${containerName} is running).`,
        );
        continue;
      }

      const failureReason = containers.all.has(containerName)
        ? `orphaned run detected during startup reconciliation: worker container ${containerName} is stopped`
        : `orphaned run detected during startup reconciliation: worker container ${containerName} not found`;
      stateStore.updateRunStatus(run.runId, "failed", { failureReason });
      try {
        transition(config.repo, run.issueNumber, "ai:failed");
      } catch (caught) {
        error(
          `[Ralph] startup reconciliation: failed to transition #${run.issueNumber} to ai:failed (${caught instanceof Error ? caught.message : String(caught)}).`,
        );
      }
      log(
        `[Ralph] startup reconciliation: marked ${run.runId} as failed and issue #${run.issueNumber} as ai:failed.`,
      );
    }
  } finally {
    if (shouldCloseStore) {
      stateStore.close();
    }
  }
}

function defaultGetContainerSnapshot(): ContainerSnapshot {
  return {
    running: listDockerContainerNames(false),
    all: listDockerContainerNames(true),
  };
}

function listDockerContainerNames(includeStopped: boolean): Set<string> {
  const args = ["ps", "--format", "{{.Names}}"];
  if (includeStopped) {
    args.splice(1, 0, "-a");
  }

  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.error) {
    throw new Error(`failed to inspect Docker containers: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`failed to inspect Docker containers: ${result.stderr.trim()}`);
  }

  return new Set(
    result.stdout
      .split("\n")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function formatContainerName(runId: string): string {
  return `ralph-${runId.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}
