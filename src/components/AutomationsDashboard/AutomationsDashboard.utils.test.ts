import { describe, expect, test } from "vite-plus/test";
import type { Automation } from "../../../shared/contracts/automations";
import {
  applyOptimisticAutomationPatch,
  filterAndSortAutomations,
  formatAutomationTriggeredAt,
  getInitialAutomationFilters,
  matchesAutomationSearchQuery,
  parseSavedAutomationViews,
  removeSavedAutomationView,
  replaceAutomationById,
  upsertSavedAutomationView,
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

  test("parses saved automation views from storage payload", () => {
    const parsed = parseSavedAutomationViews(
      JSON.stringify([
        {
          name: "Disabled only",
          filters: {
            searchQuery: "",
            status: "disabled",
            sort: "name-asc",
          },
        },
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.filters.status).toBe("disabled");
  });

  test("upserts and removes saved automation views by name", () => {
    const first = upsertSavedAutomationView([], {
      name: "Ops",
      filters: { ...getInitialAutomationFilters(), status: "enabled" },
    });
    const second = upsertSavedAutomationView(first, {
      name: "ops",
      filters: { ...getInitialAutomationFilters(), status: "disabled" },
    });

    expect(second).toHaveLength(1);
    expect(second[0]?.filters.status).toBe("disabled");
    expect(removeSavedAutomationView(second, "Ops")).toHaveLength(0);
  });
});
