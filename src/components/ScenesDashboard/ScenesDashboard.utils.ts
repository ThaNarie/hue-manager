import type { Scene } from "../../../shared/contracts/scenes";
import type { SceneDraft } from "./ScenesDashboard.types";

export function getInitialSceneDraft(): SceneDraft {
  return {
    name: "",
  };
}

export function sortScenesByName(scenes: Scene[]): Scene[] {
  return [...scenes].sort((left, right) => left.name.localeCompare(right.name));
}
