import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";

export type CleanupInput = {
  repoRoot?: string;
  retentionDays: number;
  dryRun?: boolean;
  nowMs?: number;
};

export type CleanupAction = {
  kind: "artifact" | "worktree";
  runId: string;
  path: string;
  action: "removed" | "kept";
  reason: string;
};

export type CleanupReport = {
  retentionDays: number;
  cutoffIso: string;
  dryRun: boolean;
  artifacts: {
    scanned: number;
    removed: number;
    kept: number;
  };
  worktrees: {
    scanned: number;
    removed: number;
    kept: number;
    keptForDiagnostics: number;
  };
  actions: CleanupAction[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function runCleanup(input: CleanupInput): CleanupReport {
  const repoRoot = input.repoRoot ?? process.cwd();
  const dryRun = input.dryRun ?? false;
  const nowMs = input.nowMs ?? Date.now();
  const cutoffMs = nowMs - input.retentionDays * DAY_MS;
  const cutoffIso = new Date(cutoffMs).toISOString();
  const artifactsRoot = resolve(repoRoot, ".ralph/artifacts");
  const worktreesRoot = resolve(repoRoot, ".ralph/worktrees");
  const actions: CleanupAction[] = [];

  const successfulRuns = collectSuccessfulRunIds(artifactsRoot);

  const worktreeSummary = cleanupDirectories({
    rootPath: worktreesRoot,
    cutoffMs,
    dryRun,
    onEvaluate(entryPath, runId, mtimeMs) {
      if (!successfulRuns.has(runId)) {
        actions.push({
          kind: "worktree",
          runId,
          path: entryPath,
          action: "kept",
          reason: "kept for diagnostics (run not marked succeeded)",
        });
        return { remove: false, keepForDiagnostics: true };
      }
      if (mtimeMs > cutoffMs) {
        actions.push({
          kind: "worktree",
          runId,
          path: entryPath,
          action: "kept",
          reason: "within retention window",
        });
        return { remove: false, keepForDiagnostics: false };
      }
      actions.push({
        kind: "worktree",
        runId,
        path: entryPath,
        action: "removed",
        reason: dryRun ? "would remove succeeded run worktree older than retention" : "removed",
      });
      return { remove: true, keepForDiagnostics: false };
    },
  });

  const artifactSummary = cleanupDirectories({
    rootPath: artifactsRoot,
    cutoffMs,
    dryRun,
    onEvaluate(entryPath, runId, mtimeMs) {
      if (mtimeMs > cutoffMs) {
        actions.push({
          kind: "artifact",
          runId,
          path: entryPath,
          action: "kept",
          reason: "within retention window",
        });
        return { remove: false, keepForDiagnostics: false };
      }
      actions.push({
        kind: "artifact",
        runId,
        path: entryPath,
        action: "removed",
        reason: dryRun ? "would remove artifacts/logs older than retention" : "removed",
      });
      return { remove: true, keepForDiagnostics: false };
    },
  });

  return {
    retentionDays: input.retentionDays,
    cutoffIso,
    dryRun,
    artifacts: artifactSummary,
    worktrees: worktreeSummary,
    actions,
  };
}

function cleanupDirectories(input: {
  rootPath: string;
  cutoffMs: number;
  dryRun: boolean;
  onEvaluate: (
    entryPath: string,
    runId: string,
    mtimeMs: number,
  ) => { remove: boolean; keepForDiagnostics: boolean };
}): {
  scanned: number;
  removed: number;
  kept: number;
  keptForDiagnostics: number;
} {
  if (!existsSync(input.rootPath)) {
    return { scanned: 0, removed: 0, kept: 0, keptForDiagnostics: 0 };
  }

  const entries = readdirSync(input.rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let removed = 0;
  let kept = 0;
  let keptForDiagnostics = 0;

  for (const runId of entries) {
    const entryPath = resolve(input.rootPath, runId);
    const mtimeMs = statSync(entryPath).mtimeMs;
    const decision = input.onEvaluate(entryPath, runId, mtimeMs);
    if (decision.remove) {
      if (!input.dryRun) {
        rmSync(entryPath, { recursive: true, force: true });
      }
      removed += 1;
      continue;
    }
    kept += 1;
    if (decision.keepForDiagnostics) {
      keptForDiagnostics += 1;
    }
  }

  return {
    scanned: entries.length,
    removed,
    kept,
    keptForDiagnostics,
  };
}

function collectSuccessfulRunIds(artifactsRoot: string): Set<string> {
  if (!existsSync(artifactsRoot)) {
    return new Set();
  }

  const successful = new Set<string>();
  const entries = readdirSync(artifactsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const runId of entries) {
    const resultPath = resolve(artifactsRoot, runId, "result.json");
    if (!existsSync(resultPath)) {
      continue;
    }
    try {
      const parsed = JSON.parse(readFileSync(resultPath, "utf8")) as { status?: string };
      if (parsed.status === "succeeded") {
        successful.add(runId);
      }
    } catch {
      // Ignore malformed result files and keep worktrees for diagnostics.
    }
  }

  return successful;
}
