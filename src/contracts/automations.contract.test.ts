import { describe, expect, test } from "vite-plus/test";
import {
  parseAutomationCreateRequest,
  parseAutomationMutationRequest,
  parseAutomationsResponse,
} from "../../shared/contracts/automations";

describe("automations contract", () => {
  test("parses a valid automations response", () => {
    const parsed = parseAutomationsResponse({
      generatedAt: "2026-03-30T12:00:00.000Z",
      automations: [
        {
          id: "1",
          name: "Wake up lights",
          status: "enabled",
          isEnabled: true,
          owner: "rest-api",
          lastTriggeredAt: "2026-03-29T06:00:00.000Z",
          conditions: [
            {
              address: "/sensors/1/state/status",
              operator: "eq",
              value: "1",
            },
          ],
          actions: [
            {
              address: "/groups/0/action",
              method: "PUT",
              body: { on: true },
            },
          ],
        },
      ],
    });

    expect(parsed.automations).toHaveLength(1);
    expect(parsed.automations[0].status).toBe("enabled");
  });

  test("accepts nullable rule metadata fields", () => {
    const parsed = parseAutomationsResponse({
      generatedAt: "2026-03-30T12:00:00.000Z",
      automations: [
        {
          id: "9",
          name: "External rule",
          status: "disabled",
          isEnabled: false,
          owner: null,
          lastTriggeredAt: null,
          conditions: [],
          actions: [],
        },
      ],
    });
    expect(parsed.automations[0].owner).toBeNull();
  });

  test("parses valid create payload", () => {
    const parsed = parseAutomationCreateRequest({
      name: "Movie rule",
      isEnabled: true,
      conditions: [{ address: "/sensors/1/state/status", operator: "eq", value: "1" }],
      actions: [{ address: "/groups/0/action", method: "PUT", body: { on: true } }],
    });
    expect(parsed.actions[0].method).toBe("PUT");
  });

  test("rejects invalid mutation payload", () => {
    expect(() => parseAutomationMutationRequest({})).toThrowError();
  });
});
