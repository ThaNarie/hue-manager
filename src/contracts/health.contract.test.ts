import { describe, expect, test } from "vite-plus/test";
import { parseOverviewHealthResponse } from "../../shared/contracts/health";

describe("overview health contract", () => {
  test("parses a valid backend response", () => {
    const parsed = parseOverviewHealthResponse({
      generatedAt: "2026-03-28T09:00:00.000Z",
      bridge: {
        status: "ok",
        connected: true,
        lastSeenAt: "2026-03-28T09:00:00.000Z",
      },
      sync: {
        status: "degraded",
        pendingJobs: 3,
        lastRunAt: "2026-03-28T08:59:00.000Z",
      },
    });

    expect(parsed.sync.pendingJobs).toBe(3);
    expect(parsed.bridge.status).toBe("ok");
  });

  test("rejects invalid statuses", () => {
    expect(() =>
      parseOverviewHealthResponse({
        generatedAt: "2026-03-28T09:00:00.000Z",
        bridge: {
          status: "unknown",
          connected: true,
          lastSeenAt: "2026-03-28T09:00:00.000Z",
        },
        sync: {
          status: "ok",
          pendingJobs: 0,
          lastRunAt: "2026-03-28T09:00:00.000Z",
        },
      }),
    ).toThrowError();
  });
});
