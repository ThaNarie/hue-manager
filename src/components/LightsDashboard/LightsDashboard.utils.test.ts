import { describe, expect, test } from "vite-plus/test";
import type { Light } from "../../../shared/contracts/lights";
import {
  buildRoomOptions,
  buildZoneOptions,
  filterAndSortLights,
  formatLightUpdatedAt,
  getInitialLightFilters,
  matchesSearchQuery,
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
});
