import type { Light } from "../../../shared/contracts/lights";
import type { LightMutationRequest } from "../../../shared/contracts/lights";
import {
  type LightFilterOption,
  type LightFilters,
  type LightSortOption,
  UNASSIGNED_ZONE_FILTER,
} from "./LightsDashboard.types";

export const LIGHT_SORT_OPTIONS: Array<{ value: LightSortOption; label: string }> = [
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
  { value: "brightness-desc", label: "Brightness (high-low)" },
  { value: "brightness-asc", label: "Brightness (low-high)" },
  { value: "updated-desc", label: "Recently updated" },
  { value: "updated-asc", label: "Least recently updated" },
];

export function getInitialLightFilters(): LightFilters {
  return {
    searchQuery: "",
    roomId: "",
    zoneId: "",
    sort: "name-asc",
  };
}

export function buildRoomOptions(lights: Light[]): LightFilterOption[] {
  const uniqueRooms = new Map<string, string>();

  lights.forEach((light) => {
    uniqueRooms.set(light.room.id, light.room.name);
  });

  return [...uniqueRooms.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }));
}

export function buildZoneOptions(lights: Light[]): LightFilterOption[] {
  const uniqueZones = new Map<string, string>();
  let includesUnassigned = false;

  lights.forEach((light) => {
    if (light.zone === null) {
      includesUnassigned = true;
      return;
    }

    uniqueZones.set(light.zone.id, light.zone.name);
  });

  const options = [...uniqueZones.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ value, label }));

  if (includesUnassigned) {
    options.push({
      value: UNASSIGNED_ZONE_FILTER,
      label: "Unassigned zone",
    });
  }

  return options;
}

function compareBySort(left: Light, right: Light, sort: LightSortOption): number {
  switch (sort) {
    case "name-desc":
      return right.name.localeCompare(left.name);
    case "brightness-desc":
      return right.brightness - left.brightness;
    case "brightness-asc":
      return left.brightness - right.brightness;
    case "updated-desc":
      return new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime();
    case "updated-asc":
      return new Date(left.lastUpdatedAt).getTime() - new Date(right.lastUpdatedAt).getTime();
    case "name-asc":
    default:
      return left.name.localeCompare(right.name);
  }
}

export function matchesSearchQuery(light: Light, searchQuery: string): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const searchableSegments = [
    light.id,
    light.name,
    light.type,
    light.room.name,
    light.zone?.name ?? "",
  ].map((segment) => segment.toLowerCase());

  return searchableSegments.some((segment) => segment.includes(normalizedQuery));
}

export function filterAndSortLights(lights: Light[], filters: LightFilters): Light[] {
  return lights
    .filter((light) => {
      if (!matchesSearchQuery(light, filters.searchQuery)) {
        return false;
      }

      if (filters.roomId && light.room.id !== filters.roomId) {
        return false;
      }

      if (filters.zoneId) {
        if (filters.zoneId === UNASSIGNED_ZONE_FILTER) {
          if (light.zone !== null) {
            return false;
          }
        } else if (light.zone?.id !== filters.zoneId) {
          return false;
        }
      }

      return true;
    })
    .sort((left, right) => compareBySort(left, right, filters.sort));
}

export function formatLightUpdatedAt(dateIsoString: string): string {
  return new Date(dateIsoString).toLocaleTimeString();
}

export function applyOptimisticLightPatch(
  lights: Light[],
  lightId: string,
  patch: LightMutationRequest,
): Light[] {
  return lights.map((light) => {
    if (light.id !== lightId) {
      return light;
    }

    const nextIsOn =
      patch.isOn ?? (patch.brightness !== undefined ? patch.brightness > 0 : light.isOn);
    const nextBrightness = !nextIsOn ? 0 : (patch.brightness ?? light.brightness);

    return {
      ...light,
      isOn: nextIsOn,
      brightness: nextBrightness,
      lastUpdatedAt: new Date().toISOString(),
    };
  });
}

export function replaceLightById(lights: Light[], nextLight: Light): Light[] {
  return lights.map((light) => (light.id === nextLight.id ? nextLight : light));
}
