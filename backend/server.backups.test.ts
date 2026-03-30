import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";

const ENV_KEYS = ["HUE_HOST", "HUE_PATH"] as const;
const ORIGINAL_ENV = {
  HUE_HOST: process.env.HUE_HOST,
  HUE_PATH: process.env.HUE_PATH,
};

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getRequestUrl(input: Request | URL | string): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

async function loadBackupsModule() {
  vi.resetModules();
  return import("./server.backups");
}

beforeEach(() => {
  process.env.HUE_HOST = "http://bridge.local";
  process.env.HUE_PATH = "/api/user";
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = ORIGINAL_ENV[key];
  }
});

describe("backup restore behavior", () => {
  test("builds a restore plan for create/update/delete scenes", async () => {
    const { getSceneRestorePlan } = await loadBackupsModule();
    const snapshotScenes = {
      "scene-a": { name: "Morning" },
      "scene-c": { name: "Evening" },
    };
    const currentScenes = {
      "scene-a": { name: "Old morning" },
      "scene-b": { name: "Temporary" },
    };

    const plan = getSceneRestorePlan(snapshotScenes, currentScenes);
    expect(plan.updateSceneIds).toEqual(["scene-a"]);
    expect(plan.createSceneIds).toEqual(["scene-c"]);
    expect(plan.deleteSceneIds).toEqual(["scene-b"]);
  });

  test("builds empty operations when scene sets already match", async () => {
    const { getSceneRestorePlan } = await loadBackupsModule();
    const snapshotScenes = {
      "scene-a": { name: "Morning" },
    };
    const currentScenes = {
      "scene-a": { name: "Morning" },
    };

    const plan = getSceneRestorePlan(snapshotScenes, currentScenes);
    expect(plan.updateSceneIds).toEqual(["scene-a"]);
    expect(plan.createSceneIds).toEqual([]);
    expect(plan.deleteSceneIds).toEqual([]);
  });

  test("creates an automatic snapshot with full payload data", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = getRequestUrl(input);
      if (url.endsWith("/lights")) {
        return makeJsonResponse({ "1": { state: { on: true, bri: 200 } } });
      }
      if (url.endsWith("/groups")) {
        return makeJsonResponse({ "10": { name: "Kitchen", lights: ["1"] } });
      }
      if (url.endsWith("/scenes")) {
        return makeJsonResponse({ "20": { name: "Scene A", group: "10" } });
      }
      if (url.endsWith("/rules")) {
        return makeJsonResponse({ "30": { status: "enabled" } });
      }
      return makeJsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-0000-0000-000000000001");

    const { createAutomaticPrewriteSnapshot, createBackupSnapshot } = await loadBackupsModule();
    const automatic = await createAutomaticPrewriteSnapshot("lights:destructive-mutation");
    const manual = await createBackupSnapshot("manual", "dashboard:manual");

    expect(automatic).toEqual({ ok: true });
    expect(manual).toEqual({
      ok: true,
      backup: expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000001",
        reason: "manual",
        trigger: "dashboard:manual",
      }),
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  test("returns restore failure when scene delete is rejected", async () => {
    let scenesReadCount = 0;
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = getRequestUrl(input);
      const method = init?.method ?? "GET";
      if (method === "GET" && url.endsWith("/lights")) {
        return makeJsonResponse({ "1": { state: { on: true, bri: 200 } } });
      }
      if (method === "GET" && url.endsWith("/groups")) {
        return makeJsonResponse({ "10": { name: "Kitchen", lights: ["1"] } });
      }
      if (method === "GET" && url.endsWith("/rules")) {
        return makeJsonResponse({ "30": { status: "enabled" } });
      }
      if (method === "GET" && url.endsWith("/scenes")) {
        scenesReadCount += 1;
        if (scenesReadCount === 1) {
          return makeJsonResponse({ "20": { name: "Snapshot Scene", group: "10" } });
        }
        return makeJsonResponse({ "99": { name: "Current Scene", group: "10" } });
      }
      if (method === "DELETE" && url.endsWith("/scenes/99")) {
        return makeJsonResponse({ error: "failed" }, 502);
      }
      return makeJsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-0000-0000-000000000002");

    const { createBackupSnapshot, restoreBackupSnapshot } = await loadBackupsModule();
    const created = await createBackupSnapshot("automatic", "lights:destructive-mutation");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const restored = await restoreBackupSnapshot(created.backup.id);
    expect(restored).toEqual({
      ok: false,
      status: 502,
      message: "Hue Bridge rejected scene restore delete.",
    });
  });
});
