import type {
  Scene,
  SceneCreateRequest,
  SceneUpdateRequest,
} from "../../../shared/contracts/scenes";

export const DELETE_CONFIRMATION_TEXT = "DELETE";

export type SceneDraft = Pick<SceneCreateRequest, "name">;

export type SceneEditInput = {
  sceneId: string;
  patch: SceneUpdateRequest;
};

export type SceneDeleteInput = {
  sceneId: string;
};

export type SceneActivationInput = {
  sceneId: string;
};

export type SceneFeedbackToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

export type SceneDashboardMutationState = {
  creating: boolean;
  pendingSceneIds: string[];
};

export type SceneDashboardData = {
  scenes: Scene[];
  sortedScenes: Scene[];
};
