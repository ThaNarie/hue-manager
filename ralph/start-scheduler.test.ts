import { describe, expect, test } from "vite-plus/test";

import type { EligibleIssue } from "./issue-selection.js";
import { computeIdleBackoffDelay, selectLaunchCandidates } from "./start-scheduler.js";

function issue(number: number): EligibleIssue {
  return {
    number,
    title: `Issue ${number}`,
    dependencies: [],
  };
}

describe("selectLaunchCandidates", () => {
  test("never schedules more than maxWorkers", () => {
    const selected = selectLaunchCandidates([issue(3), issue(4), issue(5)], new Set(), 2);
    expect(selected.map((entry) => entry.number)).toEqual([3, 4]);
  });

  test("skips already active issue numbers", () => {
    const selected = selectLaunchCandidates([issue(3), issue(4), issue(5)], new Set([4]), 3);
    expect(selected.map((entry) => entry.number)).toEqual([3, 5]);
  });

  test("returns empty when worker slots are full", () => {
    const selected = selectLaunchCandidates([issue(3), issue(4)], new Set([20, 21]), 2);
    expect(selected).toEqual([]);
  });
});

describe("computeIdleBackoffDelay", () => {
  test("applies jitter and doubles backoff up to max", () => {
    const delay = computeIdleBackoffDelay(1000, 4000, 300, () => 0.5);
    expect(delay).toEqual({
      waitMs: 1150,
      nextBackoffMs: 2000,
    });
  });

  test("clamps next backoff to max", () => {
    const delay = computeIdleBackoffDelay(3000, 4000, 0, () => 0.9);
    expect(delay).toEqual({
      waitMs: 3000,
      nextBackoffMs: 4000,
    });
  });
});
