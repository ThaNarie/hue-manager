import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { OverviewHealthResponseSchema } from "../shared/contracts/health.ts";
import {
  AuditEventsResponseSchema,
  UpdateAuditRetentionRequestSchema,
} from "../shared/contracts/audit.ts";
import {
  LightMutationRequestSchema,
  LightsResponseSchema,
  type LightsResponse,
} from "../shared/contracts/lights.ts";
import {
  exportAuditEvents,
  listAuditEvents,
  purgeAuditEvents,
  recordAuditEvent,
  updateAuditRetentionDays,
} from "./audit.service.ts";
import type {
  HueV1GroupsResponse,
  HueV1Light,
  HueV1LightsResponse,
  HueV1MutationResult,
} from "./server.types.ts";
import {
  HUE_NOT_CONFIGURED_MESSAGE,
  buildGroupMaps,
  fetchHueJson,
  getHueBaseUrl,
  getMutationError,
  getOverviewHealth,
  mapHueLightToContract,
  toHueBrightness,
} from "./server.utils.ts";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? "8787");

const app = new Hono();

/*
 * Keep this file as lightweight of an HTTP proxy as possible.
 * Business logic, data mapping, and Hue-specific helpers belong in server.utils.ts.
 */

app.use("/api/*", cors());

app.get("/api/health", (context) => {
  const payload = OverviewHealthResponseSchema.parse(getOverviewHealth());
  return context.json(payload);
});

app.get("/api/audit/events", async (context) => {
  const payload = AuditEventsResponseSchema.parse(await listAuditEvents());
  return context.json(payload);
});

app.get("/api/audit/export", async (context) => {
  const payload = AuditEventsResponseSchema.parse(await exportAuditEvents());
  context.header("Content-Disposition", 'attachment; filename="hue-manager-audit-log.json"');
  return context.json(payload);
});

app.put("/api/audit/retention", async (context) => {
  const body = await context.req.json().catch(() => null);
  const parsedBody = UpdateAuditRetentionRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return context.json({ message: "Invalid retention payload" }, 400);
  }

  await updateAuditRetentionDays(parsedBody.data.retentionDays);
  const payload = AuditEventsResponseSchema.parse(await listAuditEvents());
  return context.json(payload);
});

app.delete("/api/audit/events", async (context) => {
  await purgeAuditEvents();
  const payload = AuditEventsResponseSchema.parse(await listAuditEvents());
  return context.json(payload);
});

app.get("/api/lights", async (context) => {
  const lightsResult = await fetchHueJson<HueV1LightsResponse>("/lights");
  if (!lightsResult.ok) {
    return context.json({ message: lightsResult.message }, lightsResult.status);
  }

  const groupsResult = await fetchHueJson<HueV1GroupsResponse>("/groups");
  const groupMaps = groupsResult.ok ? buildGroupMaps(groupsResult.data) : buildGroupMaps({});
  const lights = Object.entries(lightsResult.data)
    .map(([lightId, light]) => mapHueLightToContract(lightId, light, groupMaps))
    .sort((left, right) => left.name.localeCompare(right.name));
  const payload = LightsResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    lights,
  } satisfies LightsResponse);

  return context.json(payload);
});

app.patch("/api/lights/:lightId", async (context) => {
  // Keep the route thin: validate input, proxy mutation, and return mapped contract shape.
  const lightId = context.req.param("lightId");
  const body = await context.req.json().catch(() => null);
  const parsedBody = LightMutationRequestSchema.safeParse(body);
  const eventBase = {
    action: "light.update",
    entityType: "light",
    entityId: lightId,
    metadata: {
      route: "/api/lights/:lightId",
    },
  };
  async function persistEvent(
    outcome: "success" | "failure",
    details: string | null,
    metadata: Record<string, unknown> = {},
  ) {
    await recordAuditEvent({
      ...eventBase,
      outcome,
      details,
      metadata: {
        ...eventBase.metadata,
        ...metadata,
      },
    }).catch(() => undefined);
  }

  if (!parsedBody.success) {
    await persistEvent("failure", "Invalid light mutation payload", { statusCode: 400 });
    return context.json({ message: "Invalid light mutation payload" }, 400);
  }

  const statePayload: { on?: boolean; bri?: number } = {};
  if (parsedBody.data.isOn !== undefined) {
    statePayload.on = parsedBody.data.isOn;
  }
  if (parsedBody.data.brightness !== undefined) {
    if (parsedBody.data.brightness <= 0) {
      statePayload.on = false;
    } else {
      statePayload.on = parsedBody.data.isOn ?? true;
      statePayload.bri = toHueBrightness(parsedBody.data.brightness);
    }
  }

  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    await persistEvent("failure", HUE_NOT_CONFIGURED_MESSAGE, {
      statusCode: 500,
      requestedPatch: parsedBody.data,
    });
    return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
  }

  const mutationResponse = await fetch(`${baseUrl}/lights/${encodeURIComponent(lightId)}/state`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(statePayload),
  }).catch(() => null);
  if (!mutationResponse) {
    await persistEvent("failure", "Could not reach Hue Bridge.", {
      statusCode: 502,
      requestedPatch: parsedBody.data,
    });
    return context.json({ message: "Could not reach Hue Bridge." }, 502);
  }
  if (!mutationResponse.ok) {
    await persistEvent("failure", `Hue Bridge request failed (${mutationResponse.status}).`, {
      statusCode: 502,
      bridgeStatus: mutationResponse.status,
      requestedPatch: parsedBody.data,
    });
    return context.json(
      { message: `Hue Bridge request failed (${mutationResponse.status}).` },
      502,
    );
  }

  const mutationPayload = (await mutationResponse.json().catch(() => null)) as
    | HueV1MutationResult[]
    | null;
  if (!Array.isArray(mutationPayload)) {
    await persistEvent("failure", "Hue Bridge returned invalid mutation response.", {
      statusCode: 502,
      requestedPatch: parsedBody.data,
    });
    return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
  }

  const mutationError = getMutationError(mutationPayload);
  if (mutationError) {
    await persistEvent("failure", mutationError.message, {
      statusCode: mutationError.status,
      requestedPatch: parsedBody.data,
    });
    return context.json({ message: mutationError.message }, mutationError.status);
  }

  const lightResult = await fetchHueJson<HueV1Light>(`/lights/${encodeURIComponent(lightId)}`);
  if (!lightResult.ok) {
    await persistEvent("failure", lightResult.message, {
      statusCode: lightResult.status,
      requestedPatch: parsedBody.data,
    });
    return context.json({ message: lightResult.message }, lightResult.status);
  }

  const groupsResult = await fetchHueJson<HueV1GroupsResponse>("/groups");
  const groupMaps = groupsResult.ok ? buildGroupMaps(groupsResult.data) : buildGroupMaps({});
  const light = mapHueLightToContract(lightId, lightResult.data, groupMaps);
  await persistEvent("success", null, {
    statusCode: 200,
    requestedPatch: parsedBody.data,
  });
  return context.json({ light });
});

app.notFound((context) => context.json({ message: "Not found" }, 404));

serve(
  {
    fetch: app.fetch,
    hostname: host,
    port,
  },
  () => {
    console.log(`API listening on http://${host}:${port}`);
  },
);
