import { describe, expect, test } from "vite-plus/test";

import { runParallelScheduler } from "./parallel-scheduler.js";
import type { RalphConfig } from "./types.js";

function createConfig(overrides: Partial<RalphConfig> = {}): RalphConfig {
  return {
    repo: "thanarie/hue-manager",
    loopIntervalMs: 100,
    maxWorkers: 2,
    idleBackoffMaxMs: 800,
    idleBackoffJitterMs: 25,
    baseBranch: "main",
    workerImage: "image",
    workerTimeoutMs: 60_000,
    requiredLabels: [],
    ...overrides,
  };
}

describe("runParallelScheduler", () => {
  test("starts no more than max workers and keeps deterministic selection", async () => {
    const config = createConfig({ maxWorkers: 2 });
    const started: number[] = [];
    const workerResolves: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    let sleepCalls = 0;
    let stop = false;

    await runParallelScheduler(
      config,
      { dryRun: false, shouldStop: () => stop },
      {
        pollIssuePlan: () => ({
          eligible: [
            { number: 8, title: "eight", dependencies: [] },
            { number: 3, title: "three", dependencies: [] },
            { number: 5, title: "five", dependencies: [] },
          ],
          ineligible: [],
        }),
        runEligibleIssue: async (_cfg, issue) => {
          started.push(issue.number);
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise<void>((resolve) => {
            workerResolves.push(() => {
              active -= 1;
              resolve();
            });
          });
        },
        sleep: async () => {
          sleepCalls += 1;
          if (sleepCalls === 2) {
            stop = true;
            for (const resolve of workerResolves.splice(0)) {
              resolve();
            }
          }
        },
        jitter: () => 0,
      },
    );

    expect(started).toEqual([3, 5]);
    expect(maxActive).toBe(2);
  });

  test("executes only issues from eligible set", async () => {
    const config = createConfig();
    const started: number[] = [];
    let stop = false;

    await runParallelScheduler(
      config,
      { dryRun: false, shouldStop: () => stop },
      {
        pollIssuePlan: () => ({
          eligible: [{ number: 11, title: "ready", dependencies: [2] }],
          ineligible: [{ number: 12, title: "blocked", reason: "blocked by #13" }],
        }),
        runEligibleIssue: (_cfg, issue) => {
          started.push(issue.number);
        },
        sleep: async () => {
          stop = true;
        },
        jitter: () => 0,
      },
    );

    expect(started).toEqual([11]);
  });

  test("applies idle backoff with jitter and resets when eligible work appears", async () => {
    const config = createConfig({
      loopIntervalMs: 100,
      idleBackoffMaxMs: 500,
      idleBackoffJitterMs: 10,
    });
    const delays: number[] = [];
    const polls = [
      { eligible: [], ineligible: [] },
      { eligible: [], ineligible: [] },
      { eligible: [{ number: 7, title: "ready", dependencies: [] }], ineligible: [] },
    ];
    let pollIndex = 0;
    let stop = false;

    await runParallelScheduler(
      config,
      { dryRun: false, shouldStop: () => stop },
      {
        pollIssuePlan: () => {
          const next = polls[Math.min(pollIndex, polls.length - 1)];
          pollIndex += 1;
          return next;
        },
        runEligibleIssue: () => undefined,
        sleep: async (ms) => {
          delays.push(ms);
          if (delays.length >= 3) {
            stop = true;
          }
        },
        jitter: () => 0.5,
      },
    );

    expect(delays).toEqual([105, 205, 100]);
  });
});
