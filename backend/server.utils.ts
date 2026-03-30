import type { OverviewHealthResponse } from "../shared/contracts/health.ts";
import type { AutomationsResponse } from "../shared/contracts/automations.ts";
import type { Group, GroupKind, GroupMember, GroupsResponse } from "../shared/contracts/groups.ts";
import type { LightGroup, LightType, LightsResponse } from "../shared/contracts/lights.ts";
import type { ScenesResponse } from "../shared/contracts/scenes.ts";
import type {
  HueV1GroupsResponse,
  HueV1Light,
  HueV1Scene,
  HueV1LightsResponse,
  HueV1MutationResult,
  HueV1Rule,
} from "./server.types.ts";

const hueHost = process.env.HUE_HOST;
const huePath = process.env.HUE_PATH;

export const HUE_NOT_CONFIGURED_MESSAGE =
  "Hue Bridge is not configured. Set HUE_HOST and HUE_PATH.";

export type FetchHueResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 500 | 502; message: string };

export function getHueBaseUrl() {
  if (!hueHost || !huePath) {
    return null;
  }

  return `${hueHost.replace(/\/$/, "")}${huePath.startsWith("/") ? huePath : `/${huePath}`}`;
}

export async function fetchHueJson<T>(path: string): Promise<FetchHueResult<T>> {
  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      status: 500,
      message: HUE_NOT_CONFIGURED_MESSAGE,
    };
  }

  const response = await fetch(`${baseUrl}${path}`).catch(() => null);
  if (!response) {
    return {
      ok: false,
      status: 502,
      message: "Could not reach Hue Bridge.",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 502,
      message: `Hue Bridge request failed (${response.status}).`,
    };
  }

  const payload = (await response.json().catch(() => null)) as T | null;
  if (!payload) {
    return {
      ok: false,
      status: 502,
      message: "Hue Bridge returned invalid JSON.",
    };
  }

  return { ok: true, data: payload };
}

function toLightType(hueType: string | undefined): LightType {
  const normalized = (hueType ?? "").toLowerCase();
  if (normalized.includes("strip")) {
    return "strip";
  }
  if (normalized.includes("plug") || normalized.includes("socket")) {
    return "plug";
  }
  if (normalized.includes("lamp") || normalized.includes("table") || normalized.includes("floor")) {
    return "lamp";
  }
  return "bulb";
}

function fromHueBrightness(hueBri: number | undefined, isOn: boolean): number {
  if (!isOn || typeof hueBri !== "number") {
    return 0;
  }
  const normalized = Math.round((Math.max(1, Math.min(254, hueBri)) / 254) * 100);
  return Math.max(1, Math.min(100, normalized));
}

export function toHueBrightness(brightness: number): number {
  const clamped = Math.max(1, Math.min(100, brightness));
  return Math.round((clamped / 100) * 254);
}

function parseLastUpdated(input: string | undefined): string {
  const parsed = input ? new Date(input) : new Date(NaN);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

function parseHueLastUpdated(input: string | undefined): string {
  if (!input) {
    return new Date().toISOString();
  }

  const normalized = /z$/i.test(input) ? input : `${input}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

export function buildGroupMaps(groups: HueV1GroupsResponse) {
  const roomsByLightId: Record<string, LightGroup> = {};
  const zonesByLightId: Record<string, LightGroup> = {};

  for (const [groupId, group] of Object.entries(groups)) {
    const groupType = (group.type ?? "").toLowerCase();
    const targetMap =
      groupType === "room" ? roomsByLightId : groupType === "zone" ? zonesByLightId : null;
    if (!targetMap || !Array.isArray(group.lights)) {
      continue;
    }

    for (const lightId of group.lights) {
      if (!targetMap[lightId]) {
        targetMap[lightId] = {
          id: `${groupType}-${groupId}`,
          name: group.name ?? `${groupType}-${groupId}`,
        };
      }
    }
  }

  return { roomsByLightId, zonesByLightId };
}

export function toGroupKind(value: string | undefined): GroupKind | null {
  if (value === "Room" || value === "room") {
    return "room";
  }
  if (value === "Zone" || value === "zone") {
    return "zone";
  }
  return null;
}

export function mapHueGroupsToContract(
  groups: HueV1GroupsResponse,
  lights: HueV1LightsResponse,
): Pick<GroupsResponse, "groups" | "availableLights"> {
  const availableLights: GroupMember[] = Object.entries(lights)
    .map(([lightId, light]) => ({
      id: lightId,
      name: light.name ?? `Light ${lightId}`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const lightsById = new Map(availableLights.map((light) => [light.id, light]));
  const mappedGroups: Group[] = [];

  for (const [groupId, group] of Object.entries(groups)) {
    const kind = toGroupKind(group.type);
    if (!kind) {
      continue;
    }
    const memberLightIds = Array.isArray(group.lights) ? [...group.lights] : [];
    const members = memberLightIds
      .map((lightId) => lightsById.get(lightId))
      .filter((member): member is GroupMember => Boolean(member));
    mappedGroups.push({
      id: `${kind}-${groupId}`,
      hueGroupId: groupId,
      kind,
      name: group.name ?? `${kind}-${groupId}`,
      memberLightIds,
      members,
    });
  }

  mappedGroups.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind.localeCompare(right.kind);
    }
    return left.name.localeCompare(right.name);
  });

  return {
    groups: mappedGroups,
    availableLights,
  };
}

export function mapHueLightToContract(
  lightId: string,
  light: HueV1Light,
  groupMaps: ReturnType<typeof buildGroupMaps>,
): LightsResponse["lights"][number] {
  const isOn = Boolean(light.state?.on);
  return {
    id: lightId,
    name: light.name ?? `Light ${lightId}`,
    type: toLightType(light.type),
    room: groupMaps.roomsByLightId[lightId] ?? { id: "room-unknown", name: "Unknown room" },
    zone: groupMaps.zonesByLightId[lightId] ?? null,
    isOn,
    brightness: fromHueBrightness(light.state?.bri, isOn),
    lastUpdatedAt: parseLastUpdated(light.state?.lastupdated),
  };
}

function parseHueRuleTimestamp(input: string | undefined): string | null {
  if (!input || input === "none") {
    return null;
  }
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function mapHueRuleToContract(
  ruleId: string,
  rule: HueV1Rule,
): AutomationsResponse["automations"][number] {
  const status = rule.status === "disabled" ? "disabled" : "enabled";
  return {
    id: ruleId,
    name: rule.name?.trim() ? rule.name : `Rule ${ruleId}`,
    status,
    isEnabled: status === "enabled",
    owner: rule.owner?.trim() ? rule.owner : null,
    lastTriggeredAt: parseHueRuleTimestamp(rule.lasttriggered),
  };
}

export function mapHueSceneToContract(
  sceneId: string,
  scene: HueV1Scene,
): ScenesResponse["scenes"][number] {
  return {
    id: sceneId,
    name: scene.name ?? `Scene ${sceneId}`,
    groupId: scene.group ?? null,
    isLocked: Boolean(scene.locked),
    lastUpdatedAt: parseHueLastUpdated(scene.lastupdated),
  };
}

export function getOverviewHealth(): OverviewHealthResponse {
  const now = new Date();
  const tenSecondsAgo = new Date(now.getTime() - 10_000);
  const oneMinuteAgo = new Date(now.getTime() - 60_000);

  return {
    generatedAt: now.toISOString(),
    bridge: {
      status: "ok",
      connected: true,
      lastSeenAt: tenSecondsAgo.toISOString(),
    },
    sync: {
      status: "ok",
      lastRunAt: oneMinuteAgo.toISOString(),
      pendingJobs: 0,
    },
  };
}

export function getMutationError(
  mutationPayload: HueV1MutationResult[],
): { message: string; status: 404 | 502 } | null {
  const firstError = mutationPayload.find((entry) => entry.error)?.error;
  if (!firstError) {
    return null;
  }

  return {
    message: firstError.description ?? "Hue Bridge rejected the mutation.",
    status: firstError.type === 3 ? 404 : 502,
  };
}

export function getCreatedResourceId(mutationPayload: HueV1MutationResult[]): string | null {
  for (const entry of mutationPayload) {
    if (!entry.success) {
      continue;
    }
    const candidate = (entry.success.id ?? "") as string;
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}
