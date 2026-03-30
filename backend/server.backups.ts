import type { Hono } from "hono";
import {
  BackupsResponseSchema,
  BackupCreateResponseSchema,
  BackupRestoreResponseSchema,
  type BackupReason,
  type BackupSummary,
} from "../shared/contracts/backups.ts";
import type { BackupSnapshotTrigger } from "../shared/safety/backupSnapshotPolicy.ts";
import type {
  HueV1GroupsResponse,
  HueV1LightsResponse,
  HueV1RulesResponse,
  HueV1Scene,
  HueV1ScenesResponse,
} from "./server.types.ts";
import { fetchHueJson, getHueBaseUrl, HUE_NOT_CONFIGURED_MESSAGE } from "./server.utils.ts";

type BackupSnapshotPayload = {
  lights: HueV1LightsResponse;
  groups: HueV1GroupsResponse;
  scenes: HueV1ScenesResponse;
  rules: HueV1RulesResponse;
};

type BackupSnapshot = BackupSummary & {
  payload: BackupSnapshotPayload;
};

const MAX_SNAPSHOTS = 40;
const backupSnapshots: BackupSnapshot[] = [];

async function fetchSnapshotPayload() {
  const lightsResult = await fetchHueJson<HueV1LightsResponse>("/lights");
  if (!lightsResult.ok) {
    return lightsResult;
  }

  const groupsResult = await fetchHueJson<HueV1GroupsResponse>("/groups");
  if (!groupsResult.ok) {
    return groupsResult;
  }

  const scenesResult = await fetchHueJson<HueV1ScenesResponse>("/scenes");
  if (!scenesResult.ok) {
    return scenesResult;
  }

  const rulesResult = await fetchHueJson<HueV1RulesResponse>("/rules");
  if (!rulesResult.ok) {
    return rulesResult;
  }

  return {
    ok: true as const,
    data: {
      lights: lightsResult.data,
      groups: groupsResult.data,
      scenes: scenesResult.data,
      rules: rulesResult.data,
    } satisfies BackupSnapshotPayload,
  };
}

function getBackups(): BackupSummary[] {
  return backupSnapshots.map(({ id, createdAt, reason, trigger }) => ({
    id,
    createdAt,
    reason,
    trigger,
  }));
}

function storeBackupSnapshot(snapshot: BackupSnapshot) {
  backupSnapshots.unshift(snapshot);
  if (backupSnapshots.length > MAX_SNAPSHOTS) {
    backupSnapshots.length = MAX_SNAPSHOTS;
  }
}

export async function createBackupSnapshot(
  reason: BackupReason,
  trigger: BackupSnapshotTrigger | "dashboard:manual",
): Promise<
  { ok: true; backup: BackupSummary } | { ok: false; status: 500 | 502; message: string }
> {
  const snapshotResult = await fetchSnapshotPayload();
  if (!snapshotResult.ok) {
    return snapshotResult;
  }

  const backup: BackupSnapshot = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    reason,
    trigger,
    payload: snapshotResult.data,
  };
  storeBackupSnapshot(backup);
  return {
    ok: true,
    backup: {
      id: backup.id,
      createdAt: backup.createdAt,
      reason: backup.reason,
      trigger: backup.trigger,
    },
  };
}

async function requestHueWrite(path: string, init: RequestInit): Promise<boolean> {
  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    return false;
  }

  const response = await fetch(`${baseUrl}${path}`, init).catch(() => null);
  return Boolean(response?.ok);
}

export function getSceneRestorePlan(
  snapshotScenes: HueV1ScenesResponse,
  currentScenes: HueV1ScenesResponse,
) {
  const snapshotIds = new Set(Object.keys(snapshotScenes));
  const currentIds = new Set(Object.keys(currentScenes));

  const updateSceneIds = [...snapshotIds].filter((sceneId) => currentIds.has(sceneId));
  const createSceneIds = [...snapshotIds].filter((sceneId) => !currentIds.has(sceneId));
  const deleteSceneIds = [...currentIds].filter((sceneId) => !snapshotIds.has(sceneId));

  return {
    updateSceneIds,
    createSceneIds,
    deleteSceneIds,
  };
}

function toSceneWritePayload(scene: HueV1Scene): { name?: string; group?: string } {
  return {
    ...(scene.name ? { name: scene.name } : {}),
    ...(scene.group ? { group: scene.group } : {}),
  };
}

export async function restoreBackupSnapshot(
  backupId: string,
): Promise<{ ok: true } | { ok: false; status: 404 | 500 | 502; message: string }> {
  const backup = backupSnapshots.find((snapshot) => snapshot.id === backupId);
  if (!backup) {
    return { ok: false, status: 404, message: "Backup not found." };
  }
  if (!getHueBaseUrl()) {
    return { ok: false, status: 500, message: HUE_NOT_CONFIGURED_MESSAGE };
  }

  const currentScenesResult = await fetchHueJson<HueV1ScenesResponse>("/scenes");
  if (!currentScenesResult.ok) {
    return currentScenesResult;
  }

  const scenePlan = getSceneRestorePlan(backup.payload.scenes, currentScenesResult.data);
  for (const sceneId of scenePlan.deleteSceneIds) {
    const ok = await requestHueWrite(`/scenes/${encodeURIComponent(sceneId)}`, {
      method: "DELETE",
    });
    if (!ok) {
      return { ok: false, status: 502, message: "Hue Bridge rejected scene restore delete." };
    }
  }

  for (const sceneId of scenePlan.updateSceneIds) {
    const snapshotScene = backup.payload.scenes[sceneId];
    const ok = await requestHueWrite(`/scenes/${encodeURIComponent(sceneId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSceneWritePayload(snapshotScene)),
    });
    if (!ok) {
      return { ok: false, status: 502, message: "Hue Bridge rejected scene restore update." };
    }
  }

  for (const sceneId of scenePlan.createSceneIds) {
    const snapshotScene = backup.payload.scenes[sceneId];
    const ok = await requestHueWrite("/scenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...toSceneWritePayload(snapshotScene),
        recycle: false,
      }),
    });
    if (!ok) {
      return { ok: false, status: 502, message: "Hue Bridge rejected scene restore create." };
    }
  }

  for (const [groupId, group] of Object.entries(backup.payload.groups)) {
    const payload = {
      ...(group.name ? { name: group.name } : {}),
      ...(Array.isArray(group.lights) ? { lights: group.lights } : {}),
    };
    const ok = await requestHueWrite(`/groups/${encodeURIComponent(groupId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!ok) {
      return { ok: false, status: 502, message: "Hue Bridge rejected group restore write." };
    }
  }

  for (const [ruleId, rule] of Object.entries(backup.payload.rules)) {
    const status = rule.status === "disabled" ? "disabled" : "enabled";
    const ok = await requestHueWrite(`/rules/${encodeURIComponent(ruleId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!ok) {
      return { ok: false, status: 502, message: "Hue Bridge rejected automation restore write." };
    }
  }

  for (const [lightId, light] of Object.entries(backup.payload.lights)) {
    const payload: { on?: boolean; bri?: number } = {};
    if (typeof light.state?.on === "boolean") {
      payload.on = light.state.on;
    }
    if (typeof light.state?.bri === "number") {
      payload.bri = light.state.bri;
    }

    const ok = await requestHueWrite(`/lights/${encodeURIComponent(lightId)}/state`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!ok) {
      return { ok: false, status: 502, message: "Hue Bridge rejected light restore write." };
    }
  }

  return { ok: true };
}

export async function createAutomaticPrewriteSnapshot(
  trigger: BackupSnapshotTrigger,
): Promise<{ ok: true } | { ok: false; status: 500 | 502; message: string }> {
  const result = await createBackupSnapshot("automatic", trigger);
  if (!result.ok) {
    return result;
  }
  return { ok: true };
}

export function registerBackupRoutes(app: Hono) {
  app.get("/api/backups", (context) => {
    const payload = BackupsResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      backups: getBackups(),
    });
    return context.json(payload);
  });

  app.post("/api/backups", async (context) => {
    const result = await createBackupSnapshot("manual", "dashboard:manual");
    if (!result.ok) {
      return context.json({ message: result.message }, result.status);
    }

    const payload = BackupCreateResponseSchema.parse({
      backup: result.backup,
    });
    return context.json(payload, 201);
  });

  app.post("/api/backups/:backupId/restore", async (context) => {
    const backupId = context.req.param("backupId") ?? "";
    if (!backupId) {
      return context.json({ message: "Backup id is required." }, 400);
    }
    const result = await restoreBackupSnapshot(backupId);
    if (!result.ok) {
      return context.json({ message: result.message }, result.status);
    }

    const payload = BackupRestoreResponseSchema.parse({
      restoredBackupId: backupId,
    });
    return context.json(payload);
  });
}
