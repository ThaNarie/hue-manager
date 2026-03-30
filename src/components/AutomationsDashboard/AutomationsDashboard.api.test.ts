import { afterEach, describe, expect, test, vi } from "vite-plus/test";
import {
  requestAutomationCreate,
  requestAutomationMutation,
  requestAutomations,
} from "./AutomationsDashboard.api";
import { DANGEROUS_AUTOMATION_MUTATION_TOKEN } from "../../../shared/safety/automationMutationSafetyPolicy";

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AutomationsDashboard.api", () => {
  test("fetches automations list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        makeJsonResponse({
          generatedAt: "2026-03-30T12:00:00.000Z",
          automations: [
            {
              id: "a1",
              name: "Morning routine",
              status: "enabled",
              isEnabled: true,
              owner: "rest-api",
              lastTriggeredAt: null,
              conditions: [],
              actions: [],
            },
          ],
        }),
      ),
    );

    const response = await requestAutomations();
    expect(response.automations).toHaveLength(1);
    expect(response.automations[0].id).toBe("a1");
  });

  test("sends safety approval headers for dangerous edits", async () => {
    const fetchMock = vi.fn(async () =>
      makeJsonResponse({
        automation: {
          id: "a1",
          name: "Dangerous routine",
          status: "enabled",
          isEnabled: true,
          owner: "rest-api",
          lastTriggeredAt: null,
          conditions: [],
          actions: [],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestAutomationMutation(
      "a1",
      {
        actions: [{ address: "/config", method: "PUT", body: { whitelist: {} } }],
      },
      {
        action: "explicit",
        token: DANGEROUS_AUTOMATION_MUTATION_TOKEN,
      },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/automations/a1",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          "x-hue-automation-safety-action": "explicit",
          "x-hue-automation-safety-token": DANGEROUS_AUTOMATION_MUTATION_TOKEN,
        }),
      }),
    );
  });

  test("surfaces server message on create errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => makeJsonResponse({ message: "Safety policy rejected." }, 403)),
    );

    await expect(
      requestAutomationCreate(
        {
          name: "Blocked",
          isEnabled: false,
          conditions: [{ address: "/sensors/1/state/status", operator: "eq", value: "1" }],
          actions: [{ address: "/groups/0/action", method: "PUT", body: { on: false } }],
        },
        { action: "confirm" },
      ),
    ).rejects.toThrowError("Safety policy rejected.");
  });
});
