import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { RalphStateStore } from "./state-store.js";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function createStore(): { store: RalphStateStore; closeAndCleanup: () => void; dbPath: string } {
  const tempDir = mkdtempSync(join(tmpdir(), "ralph-state-store-"));
  tempPaths.push(tempDir);
  const dbPath = join(tempDir, "state.db");
  const store = new RalphStateStore(dbPath);
  return {
    store,
    dbPath,
    closeAndCleanup: () => store.close(),
  };
}

describe("RalphStateStore", () => {
  test("allocates deterministic unique run ids per issue attempt and persists attempt counters", () => {
    const firstStore = createStore();
    const first = firstStore.store.createRunAttempt({ issueNumber: 23, triggerType: "poll" });
    const second = firstStore.store.createRunAttempt({ issueNumber: 23, triggerType: "poll" });
    const otherIssue = firstStore.store.createRunAttempt({ issueNumber: 7, triggerType: "poll" });
    firstStore.closeAndCleanup();

    const reopened = new RalphStateStore(firstStore.dbPath);
    const third = reopened.createRunAttempt({ issueNumber: 23, triggerType: "poll" });
    reopened.close();

    expect(first.runId).toBe("issue-000023-run-0001");
    expect(second.runId).toBe("issue-000023-run-0002");
    expect(otherIssue.runId).toBe("issue-000007-run-0001");
    expect(third.runId).toBe("issue-000023-run-0003");
  });

  test("tracks issue comment cursor and filters already-consumed trigger comments", () => {
    const { store, closeAndCleanup, dbPath } = createStore();
    expect(store.getCommentCursor(23)).toBe(0);
    expect(store.getUnconsumedCommentIds(23, [102, 101, 101, 100])).toEqual([100, 101, 102]);

    const advancedCursor = store.advanceCommentCursor(23, [100, 101]);
    expect(advancedCursor).toBe(101);
    expect(store.getUnconsumedCommentIds(23, [99, 100, 101])).toEqual([]);
    expect(store.getUnconsumedCommentIds(23, [100, 101, 102])).toEqual([102]);

    const unchangedCursor = store.advanceCommentCursor(23, [100]);
    expect(unchangedCursor).toBe(101);
    closeAndCleanup();

    const reopened = new RalphStateStore(dbPath);
    expect(reopened.getCommentCursor(23)).toBe(101);
    reopened.close();
  });

  test("persists run metadata for retries and diagnostics", () => {
    const { store, closeAndCleanup } = createStore();
    const run = store.createRunAttempt({
      issueNumber: 23,
      triggerType: "comment",
      triggerCommentId: 9182,
    });
    const failed = store.updateRunStatus(run.runId, "failed", {
      failureReason: "quality checks failed",
    });

    expect(failed.issueNumber).toBe(23);
    expect(failed.triggerType).toBe("comment");
    expect(failed.triggerCommentId).toBe(9182);
    expect(failed.status).toBe("failed");
    expect(failed.failureReason).toBe("quality checks failed");
    closeAndCleanup();
  });
});
