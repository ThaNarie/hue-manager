import {
  parseSceneActivationResponse,
  parseSceneCreateRequest,
  parseSceneDeleteResponse,
  parseSceneMutationResponse,
  parseSceneUpdateRequest,
  parseScenesResponse,
} from "../../../shared/contracts/scenes";
import type { SceneDraft } from "./ScenesDashboard.types";

function getResponseMessage(payload: unknown, fallbackMessage: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return fallbackMessage;
}

export async function requestScenes() {
  const response = await fetch("/api/scenes");
  if (!response.ok) {
    throw new Error(`Scenes endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseScenesResponse(payload);
}

export async function requestSceneCreate(input: SceneDraft) {
  const response = await fetch("/api/scenes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parseSceneCreateRequest(input)),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Scene create failed (${response.status})`));
  }

  return parseSceneMutationResponse(payload);
}

export async function requestSceneEdit(sceneId: string, name: string) {
  const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parseSceneUpdateRequest({ name })),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Scene edit failed (${response.status})`));
  }

  return parseSceneMutationResponse(payload);
}

export async function requestSceneActivation(sceneId: string) {
  const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}/activate`, {
    method: "PUT",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Scene activation failed (${response.status})`));
  }

  return parseSceneActivationResponse(payload);
}

export async function requestSceneDelete(sceneId: string) {
  const response = await fetch(`/api/scenes/${encodeURIComponent(sceneId)}`, {
    method: "DELETE",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Scene deletion failed (${response.status})`));
  }

  return parseSceneDeleteResponse(payload);
}
