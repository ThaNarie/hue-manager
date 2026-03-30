import type { Hono } from "hono";
import {
  SceneActivationResponseSchema,
  SceneCreateRequestSchema,
  SceneDeleteResponseSchema,
  SceneMutationResponseSchema,
  ScenesResponseSchema,
  SceneUpdateRequestSchema,
  type ScenesResponse,
} from "../shared/contracts/scenes.ts";
import type { HueV1MutationResult, HueV1Scene, HueV1ScenesResponse } from "./server.types.ts";
import {
  HUE_NOT_CONFIGURED_MESSAGE,
  fetchHueJson,
  getCreatedResourceId,
  getHueBaseUrl,
  getMutationError,
  mapHueSceneToContract,
} from "./server.utils.ts";

async function parseHueMutationResponse(response: Response): Promise<HueV1MutationResult[] | null> {
  const payload = (await response.json().catch(() => null)) as HueV1MutationResult[] | null;
  if (!Array.isArray(payload)) {
    return null;
  }
  return payload;
}

export function registerSceneRoutes(app: Hono) {
  app.get("/api/scenes", async (context) => {
    const scenesResult = await fetchHueJson<HueV1ScenesResponse>("/scenes");
    if (!scenesResult.ok) {
      return context.json({ message: scenesResult.message }, scenesResult.status);
    }

    const scenes = Object.entries(scenesResult.data)
      .map(([sceneId, scene]) => mapHueSceneToContract(sceneId, scene))
      .sort((left, right) => left.name.localeCompare(right.name));
    const payload = ScenesResponseSchema.parse({
      generatedAt: new Date().toISOString(),
      scenes,
    } satisfies ScenesResponse);

    return context.json(payload);
  });

  app.post("/api/scenes", async (context) => {
    const body = await context.req.json().catch(() => null);
    const parsedBody = SceneCreateRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return context.json({ message: "Invalid scene create payload" }, 400);
    }

    const baseUrl = getHueBaseUrl();
    if (!baseUrl) {
      return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
    }

    const createResponse = await fetch(`${baseUrl}/scenes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: parsedBody.data.name,
        ...(parsedBody.data.groupId ? { group: parsedBody.data.groupId } : {}),
        recycle: false,
      }),
    }).catch(() => null);
    if (!createResponse) {
      return context.json({ message: "Could not reach Hue Bridge." }, 502);
    }
    if (!createResponse.ok) {
      return context.json(
        { message: `Hue Bridge request failed (${createResponse.status}).` },
        502,
      );
    }

    const mutationPayload = await parseHueMutationResponse(createResponse);
    if (!mutationPayload) {
      return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
    }

    const mutationError = getMutationError(mutationPayload);
    if (mutationError) {
      return context.json({ message: mutationError.message }, mutationError.status);
    }

    const createdSceneId = getCreatedResourceId(mutationPayload);
    if (!createdSceneId) {
      return context.json({ message: "Hue Bridge did not return a created scene id." }, 502);
    }

    const sceneResult = await fetchHueJson<HueV1Scene>(
      `/scenes/${encodeURIComponent(createdSceneId)}`,
    );
    if (!sceneResult.ok) {
      return context.json({ message: sceneResult.message }, sceneResult.status);
    }

    const scene = mapHueSceneToContract(createdSceneId, sceneResult.data);
    const payload = SceneMutationResponseSchema.parse({ scene });
    return context.json(payload, 201);
  });

  app.patch("/api/scenes/:sceneId", async (context) => {
    const sceneId = context.req.param("sceneId");
    const body = await context.req.json().catch(() => null);
    const parsedBody = SceneUpdateRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return context.json({ message: "Invalid scene update payload" }, 400);
    }

    const baseUrl = getHueBaseUrl();
    if (!baseUrl) {
      return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
    }

    const patchResponse = await fetch(`${baseUrl}/scenes/${encodeURIComponent(sceneId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(parsedBody.data.name ? { name: parsedBody.data.name } : {}),
        ...(parsedBody.data.groupId ? { group: parsedBody.data.groupId } : {}),
      }),
    }).catch(() => null);
    if (!patchResponse) {
      return context.json({ message: "Could not reach Hue Bridge." }, 502);
    }
    if (!patchResponse.ok) {
      return context.json({ message: `Hue Bridge request failed (${patchResponse.status}).` }, 502);
    }

    const mutationPayload = await parseHueMutationResponse(patchResponse);
    if (!mutationPayload) {
      return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
    }

    const mutationError = getMutationError(mutationPayload);
    if (mutationError) {
      return context.json({ message: mutationError.message }, mutationError.status);
    }

    const sceneResult = await fetchHueJson<HueV1Scene>(`/scenes/${encodeURIComponent(sceneId)}`);
    if (!sceneResult.ok) {
      return context.json({ message: sceneResult.message }, sceneResult.status);
    }

    const scene = mapHueSceneToContract(sceneId, sceneResult.data);
    const payload = SceneMutationResponseSchema.parse({ scene });
    return context.json(payload);
  });

  app.put("/api/scenes/:sceneId/activate", async (context) => {
    const sceneId = context.req.param("sceneId");
    const baseUrl = getHueBaseUrl();
    if (!baseUrl) {
      return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
    }

    const activateResponse = await fetch(`${baseUrl}/groups/0/action`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scene: sceneId }),
    }).catch(() => null);
    if (!activateResponse) {
      return context.json({ message: "Could not reach Hue Bridge." }, 502);
    }
    if (!activateResponse.ok) {
      return context.json(
        { message: `Hue Bridge request failed (${activateResponse.status}).` },
        502,
      );
    }

    const mutationPayload = await parseHueMutationResponse(activateResponse);
    if (!mutationPayload) {
      return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
    }

    const mutationError = getMutationError(mutationPayload);
    if (mutationError) {
      return context.json({ message: mutationError.message }, mutationError.status);
    }

    const payload = SceneActivationResponseSchema.parse({ activatedSceneId: sceneId });
    return context.json(payload);
  });

  app.delete("/api/scenes/:sceneId", async (context) => {
    const sceneId = context.req.param("sceneId");
    const baseUrl = getHueBaseUrl();
    if (!baseUrl) {
      return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
    }

    const deleteResponse = await fetch(`${baseUrl}/scenes/${encodeURIComponent(sceneId)}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!deleteResponse) {
      return context.json({ message: "Could not reach Hue Bridge." }, 502);
    }
    if (!deleteResponse.ok) {
      return context.json(
        { message: `Hue Bridge request failed (${deleteResponse.status}).` },
        502,
      );
    }

    const mutationPayload = await parseHueMutationResponse(deleteResponse);
    if (!mutationPayload) {
      return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
    }

    const mutationError = getMutationError(mutationPayload);
    if (mutationError) {
      return context.json({ message: mutationError.message }, mutationError.status);
    }

    const payload = SceneDeleteResponseSchema.parse({ deletedSceneId: sceneId });
    return context.json(payload);
  });
}
