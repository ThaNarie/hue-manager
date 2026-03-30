import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { runCleanup } from "./cleanup.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function createTempRepoRoot(): string {
  const tempDir = mkdtempSync(join(tmpdir(), "ralph-cleanup-"));
  tempPaths.push(tempDir);
  return tempDir;
}

function createRunFixture(
  repoRoot: string,
  runId: string,
  options: { status?: "succeeded" | "failed"; modifiedAtMs: number },
): void {
  const artifactDir = resolve(repoRoot, ".ralph/artifacts", runId);
  const worktreeDir = resolve(repoRoot, ".ralph/worktrees", runId);
  mkdirSync(artifactDir, { recursive: true });
  mkdirSync(worktreeDir, { recursive: true });
  if (options.status) {
    writeFileSync(
      resolve(artifactDir, "result.json"),
      JSON.stringify({ status: options.status, completedAt: new Date().toISOString() }),
      "utf8",
    );
  } else {
    writeFileSync(resolve(artifactDir, "worker.stderr.log"), "failed output", "utf8");
  }
  utimesSync(artifactDir, options.modifiedAtMs / 1000, options.modifiedAtMs / 1000);
  utimesSync(worktreeDir, options.modifiedAtMs / 1000, options.modifiedAtMs / 1000);
}

describe("runCleanup", () => {
  test("removes artifacts older than retention and prunes only successful worktrees", () => {
    const repoRoot = createTempRepoRoot();
    const nowMs = Date.UTC(2026, 2, 30, 0, 0, 0);
    const oldMs = nowMs - 20 * DAY_MS;
    const newMs = nowMs - 3 * DAY_MS;

    createRunFixture(repoRoot, "issue-000030-run-0001", {
      status: "succeeded",
      modifiedAtMs: oldMs,
    });
    createRunFixture(repoRoot, "issue-000030-run-0002", { status: "failed", modifiedAtMs: oldMs });
    createRunFixture(repoRoot, "issue-000030-run-0003", {
      status: "succeeded",
      modifiedAtMs: newMs,
    });

    const report = runCleanup({
      repoRoot,
      retentionDays: 14,
      nowMs,
    });

    expect(report.artifacts.scanned).toBe(3);
    expect(report.artifacts.removed).toBe(2);
    expect(report.worktrees.scanned).toBe(3);
    expect(report.worktrees.removed).toBe(1);
    expect(report.worktrees.keptForDiagnostics).toBe(1);

    expect(
      readFileSync(resolve(repoRoot, ".ralph/artifacts/issue-000030-run-0003/result.json"), "utf8"),
    ).toContain("succeeded");
    expect(() =>
      readFileSync(resolve(repoRoot, ".ralph/artifacts/issue-000030-run-0001/result.json"), "utf8"),
    ).toThrow();
    expect(existsSync(resolve(repoRoot, ".ralph/worktrees/issue-000030-run-0001"))).toBe(false);
    expect(existsSync(resolve(repoRoot, ".ralph/artifacts/issue-000030-run-0002"))).toBe(false);
    expect(existsSync(resolve(repoRoot, ".ralph/worktrees/issue-000030-run-0002"))).toBe(true);
  });

  test("reports cleanup actions in dry-run mode without deleting files", () => {
    const repoRoot = createTempRepoRoot();
    const nowMs = Date.UTC(2026, 2, 30, 0, 0, 0);
    const oldMs = nowMs - 30 * DAY_MS;
    createRunFixture(repoRoot, "issue-000030-run-0004", {
      status: "succeeded",
      modifiedAtMs: oldMs,
    });

    const report = runCleanup({
      repoRoot,
      retentionDays: 14,
      nowMs,
      dryRun: true,
    });

    expect(report.dryRun).toBe(true);
    expect(report.artifacts.removed).toBe(1);
    expect(report.worktrees.removed).toBe(1);
    expect(
      report.actions.some(
        (action) =>
          action.runId === "issue-000030-run-0004" &&
          action.kind === "artifact" &&
          action.reason.includes("would remove"),
      ),
    ).toBe(true);
    expect(
      readFileSync(resolve(repoRoot, ".ralph/artifacts/issue-000030-run-0004/result.json"), "utf8"),
    ).toContain("succeeded");
  });
});
