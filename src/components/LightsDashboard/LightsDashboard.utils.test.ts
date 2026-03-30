import { describe, expect, test } from "vite-plus/test";
import type { Light } from "../../../shared/contracts/lights";
import {
  applyOptimisticLightPatch,
  buildRoomOptions,
  buildZoneOptions,
  filterAndSortLights,
  formatLightUpdatedAt,
  getInitialLightFilters,
  matchesSearchQuery,
  parseSavedLightViews,
  removeSavedLightView,
  replaceLightById,
  upsertSavedLightView,
} from "./LightsDashboard.utils";
import { UNASSIGNED_ZONE_FILTER } from "./LightsDashboard.types";

const LIGHT_FIXTURES: Light[] = [
  {
    id: "a1",
    name: "Kitchen Ceiling",
    type: "bulb",
    room: { id: "room-kitchen", name: "Kitchen" },
    zone: { id: "zone-downstairs", name: "Downstairs" },
    isOn: true,
    brightness: 90,
    lastUpdatedAt: "2026-03-28T10:00:00.000Z",
  },
  {
    id: "b2",
    name: "Office Lamp",
    type: "lamp",
    room: { id: "room-office", name: "Office" },
    zone: null,
    isOn: false,
    brightness: 0,
    lastUpdatedAt: "2026-03-28T09:00:00.000Z",
  },
  {
    id: "c3",
    name: "Dining Strip",
    type: "strip",
    room: { id: "room-dining", name: "Dining Room" },
    zone: { id: "zone-downstairs", name: "Downstairs" },
    isOn: true,
    brightness: 45,
    lastUpdatedAt: "2026-03-28T11:00:00.000Z",
  },
];

describe("LightsDashboard.utils", () => {
  test("builds unique room options sorted by label", () => {
    expect(buildRoomOptions(LIGHT_FIXTURES)).toEqual([
      { value: "room-dining", label: "Dining Room" },
      { value: "room-kitchen", label: "Kitchen" },
      { value: "room-office", label: "Office" },
    ]);
  });

  test("builds unique zone options and includes unassigned entry", () => {
    expect(buildZoneOptions(LIGHT_FIXTURES)).toEqual([
      { value: "zone-downstairs", label: "Downstairs" },
      { value: UNASSIGNED_ZONE_FILTER, label: "Unassigned zone" },
    ]);
  });

  test("matches search query against id/name/type/room/zone", () => {
    expect(matchesSearchQuery(LIGHT_FIXTURES[0], "kitchen")).toBe(true);
    expect(matchesSearchQuery(LIGHT_FIXTURES[0], "downstairs")).toBe(true);
    expect(matchesSearchQuery(LIGHT_FIXTURES[1], "lamp")).toBe(true);
    expect(matchesSearchQuery(LIGHT_FIXTURES[2], "garage")).toBe(false);
  });

  test("filters by room and zone", () => {
    const filtered = filterAndSortLights(LIGHT_FIXTURES, {
      ...getInitialLightFilters(),
      roomId: "room-kitchen",
      zoneId: "zone-downstairs",
    });

    expect(filtered.map((light) => light.id)).toEqual(["a1"]);
  });

  test("filters by unassigned zone option", () => {
    const filtered = filterAndSortLights(LIGHT_FIXTURES, {
      ...getInitialLightFilters(),
      zoneId: UNASSIGNED_ZONE_FILTER,
    });

    expect(filtered.map((light) => light.id)).toEqual(["b2"]);
  });

  test("sorts by selected sort option", () => {
    const byBrightness = filterAndSortLights(LIGHT_FIXTURES, {
      ...getInitialLightFilters(),
      sort: "brightness-desc",
    });
    expect(byBrightness.map((light) => light.id)).toEqual(["a1", "c3", "b2"]);

    const byUpdated = filterAndSortLights(LIGHT_FIXTURES, {
      ...getInitialLightFilters(),
      sort: "updated-desc",
    });
    expect(byUpdated.map((light) => light.id)).toEqual(["c3", "a1", "b2"]);
  });

  test("formats timestamp for UI display", () => {
    expect(formatLightUpdatedAt("2026-03-28T10:00:00.000Z")).not.toHaveLength(0);
  });

  test("applies optimistic toggle updates immediately", () => {
    const updatedLights = applyOptimisticLightPatch(LIGHT_FIXTURES, "b2", { isOn: true });
    expect(updatedLights.find((light) => light.id === "b2")?.isOn).toBe(true);
  });

  test("forces brightness to zero when optimistically toggled off", () => {
    const updatedLights = applyOptimisticLightPatch(LIGHT_FIXTURES, "a1", { isOn: false });
    expect(updatedLights.find((light) => light.id === "a1")?.brightness).toBe(0);
  });

  test("replaces a single light by id from mutation response", () => {
    const replacement = {
      ...LIGHT_FIXTURES[0],
      brightness: 12,
      lastUpdatedAt: "2026-03-28T12:00:00.000Z",
    };
    const updatedLights = replaceLightById(LIGHT_FIXTURES, replacement);
    expect(updatedLights.find((light) => light.id === "a1")?.brightness).toBe(12);
    expect(updatedLights.find((light) => light.id === "b2")?.brightness).toBe(0);
  });

  test("parses saved views from storage payload", () => {
    const parsed = parseSavedLightViews(
      JSON.stringify([
        {
          name: "Kitchen only",
          filters: {
            searchQuery: "kitchen",
            roomId: "room-kitchen",
            zoneId: "",
            sort: "name-asc",
          },
        },
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.name).toBe("Kitchen only");
  });

  test("upserts and removes saved views by name", () => {
    const first = upsertSavedLightView([], {
      name: "Evening",
      filters: { ...getInitialLightFilters(), searchQuery: "evening" },
    });
    const second = upsertSavedLightView(first, {
      name: "evening",
      filters: { ...getInitialLightFilters(), searchQuery: "night" },
    });

    expect(second).toHaveLength(1);
    expect(second[0]?.filters.searchQuery).toBe("night");
    expect(removeSavedLightView(second, "Evening")).toHaveLength(0);
  });
});
