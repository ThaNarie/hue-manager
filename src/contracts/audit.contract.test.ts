import { describe, expect, test } from "vite-plus/test";
import {
  parseAuditEventsResponse,
  parseUpdateAuditRetentionRequest,
} from "../../shared/contracts/audit";

describe("audit contract", () => {
  test("parses a valid audit events payload", () => {
    const parsed = parseAuditEventsResponse({
      generatedAt: "2026-03-30T10:00:00.000Z",
      retentionDays: 90,
      events: [
        {
          id: "event-1",
          recordedAt: "2026-03-30T09:59:00.000Z",
          action: "light.update",
          entityType: "light",
          entityId: "light-123",
          outcome: "success",
          details: null,
          metadata: {
            statusCode: 200,
          },
        },
      ],
    });

    expect(parsed.retentionDays).toBe(90);
    expect(parsed.events[0].outcome).toBe("success");
  });

  test("rejects invalid retention updates", () => {
    expect(() => parseUpdateAuditRetentionRequest({ retentionDays: 0 })).toThrowError();
  });
});
