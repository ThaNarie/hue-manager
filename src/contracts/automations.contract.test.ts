import { describe, expect, test } from "vite-plus/test";
import {
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
        },
      ],
    });
    expect(parsed.automations[0].owner).toBeNull();
  });

  test("rejects invalid mutation payload", () => {
    expect(() => parseAutomationMutationRequest({})).toThrowError();
  });
});
