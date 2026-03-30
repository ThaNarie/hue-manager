import { describe, expect, test } from "vite-plus/test";
import type { Automation } from "../../../shared/contracts/automations";
import {
  applyOptimisticAutomationPatch,
  filterAndSortAutomations,
  formatAutomationTriggeredAt,
  getJsonDraftFromAutomation,
  getInitialAutomationFilters,
  matchesAutomationSearchQuery,
  replaceAutomationById,
  validateAutomationJsonDraft,
} from "./AutomationsDashboard.utils";

const AUTOMATION_FIXTURES: Automation[] = [
  {
    id: "2",
    name: "Kitchen wake up",
    status: "enabled",
    isEnabled: true,
    owner: "rest-api",
    lastTriggeredAt: "2026-03-30T06:00:00.000Z",
    conditions: [],
    actions: [],
  },
  {
    id: "9",
    name: "External evening scene",
    status: "disabled",
    isEnabled: false,
    owner: null,
    lastTriggeredAt: null,
    conditions: [],
    actions: [],
  },
  {
    id: "4",
    name: "Hallway motion",
    status: "enabled",
    isEnabled: true,
    owner: "hue-app",
    lastTriggeredAt: "2026-03-29T23:00:00.000Z",
    conditions: [],
    actions: [],
  },
];

describe("AutomationsDashboard.utils", () => {
  test("matches search query against id/name/status/owner", () => {
    expect(matchesAutomationSearchQuery(AUTOMATION_FIXTURES[0], "kitchen")).toBe(true);
    expect(matchesAutomationSearchQuery(AUTOMATION_FIXTURES[0], "rest-api")).toBe(true);
    expect(matchesAutomationSearchQuery(AUTOMATION_FIXTURES[1], "disabled")).toBe(true);
    expect(matchesAutomationSearchQuery(AUTOMATION_FIXTURES[2], "garage")).toBe(false);
  });

  test("filters by status", () => {
    const filtered = filterAndSortAutomations(AUTOMATION_FIXTURES, {
      ...getInitialAutomationFilters(),
      status: "disabled",
    });
    expect(filtered.map((automation) => automation.id)).toEqual(["9"]);
  });

  test("sorts by selected sort option", () => {
    const byNameDesc = filterAndSortAutomations(AUTOMATION_FIXTURES, {
      ...getInitialAutomationFilters(),
      sort: "name-desc",
    });
    expect(byNameDesc.map((automation) => automation.id)).toEqual(["2", "4", "9"]);

    const byUpdated = filterAndSortAutomations(AUTOMATION_FIXTURES, {
      ...getInitialAutomationFilters(),
      sort: "updated-desc",
    });
    expect(byUpdated.map((automation) => automation.id)).toEqual(["2", "4", "9"]);
  });

  test("formats null triggered timestamp as never", () => {
    expect(formatAutomationTriggeredAt(null)).toBe("Never");
    expect(formatAutomationTriggeredAt("2026-03-30T06:00:00.000Z")).not.toHaveLength(0);
  });

  test("applies optimistic status toggle", () => {
    const updated = applyOptimisticAutomationPatch(AUTOMATION_FIXTURES, "9", true);
    expect(updated.find((automation) => automation.id === "9")?.isEnabled).toBe(true);
    expect(updated.find((automation) => automation.id === "9")?.status).toBe("enabled");
  });

  test("replaces automation by id", () => {
    const replacement: Automation = {
      ...AUTOMATION_FIXTURES[1],
      owner: "bridge",
    };
    const updated = replaceAutomationById(AUTOMATION_FIXTURES, replacement);
    expect(updated.find((automation) => automation.id === "9")?.owner).toBe("bridge");
    expect(updated.find((automation) => automation.id === "4")?.owner).toBe("hue-app");
  });

  test("loads existing automation payload into json draft", () => {
    const jsonDraft = getJsonDraftFromAutomation(AUTOMATION_FIXTURES[0]);
    const parsed = JSON.parse(jsonDraft.payloadText) as {
      name: string;
      isEnabled: boolean;
      conditions: unknown[];
      actions: unknown[];
    };
    expect(parsed.name).toBe("Kitchen wake up");
    expect(parsed.isEnabled).toBe(true);
    expect(parsed.conditions).toEqual([]);
    expect(parsed.actions).toEqual([]);
  });

  test("validates json draft schema and surfaces errors", () => {
    const invalid = validateAutomationJsonDraft({
      payloadText: "{invalid",
      confirmDestructive: false,
      explicitDangerousToken: "",
    });
    expect(invalid.payload).toBeNull();
    expect(invalid.errors.payloadText).toBe("Payload must be valid JSON.");

    const schemaInvalid = validateAutomationJsonDraft({
      payloadText: JSON.stringify({ name: " " }),
      confirmDestructive: false,
      explicitDangerousToken: "",
    });
    expect(schemaInvalid.payload).toBeNull();
    expect(schemaInvalid.errors.payloadText).toBeDefined();

    const valid = validateAutomationJsonDraft({
      payloadText: JSON.stringify({
        name: "Rule",
        actions: [{ address: "/x", method: "PUT", body: {} }],
      }),
      confirmDestructive: false,
      explicitDangerousToken: "",
    });
    expect(valid.payload?.name).toBe("Rule");
  });
});
