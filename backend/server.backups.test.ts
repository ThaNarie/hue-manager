import { describe, expect, test } from "vite-plus/test";
import { getSceneRestorePlan } from "./server.backups";

describe("backup restore behavior", () => {
  test("builds a restore plan for create/update/delete scenes", () => {
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

  test("builds empty operations when scene sets already match", () => {
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
});
