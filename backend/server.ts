import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  AutomationsResponseSchema,
  AutomationMutationRequestSchema,
  AutomationMutationResponseSchema,
} from "../shared/contracts/automations.ts";
import { OverviewHealthResponseSchema } from "../shared/contracts/health.ts";
import {
  LightMutationRequestSchema,
  LightsResponseSchema,
  type LightsResponse,
} from "../shared/contracts/lights.ts";
import type {
  HueV1GroupsResponse,
  HueV1Light,
  HueV1LightsResponse,
  HueV1MutationResult,
  HueV1Rule,
  HueV1RulesResponse,
} from "./server.types.ts";
import { registerSceneRoutes } from "./server.scenes.ts";
import {
  HUE_NOT_CONFIGURED_MESSAGE,
  buildGroupMaps,
  fetchHueJson,
  getHueBaseUrl,
  getMutationError,
  getOverviewHealth,
  mapHueLightToContract,
  mapHueRuleToContract,
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
  if (!parsedBody.success) {
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
    return context.json({ message: "Could not reach Hue Bridge." }, 502);
  }
  if (!mutationResponse.ok) {
    return context.json(
      { message: `Hue Bridge request failed (${mutationResponse.status}).` },
      502,
    );
  }

  const mutationPayload = (await mutationResponse.json().catch(() => null)) as
    | HueV1MutationResult[]
    | null;
  if (!Array.isArray(mutationPayload)) {
    return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
  }

  const mutationError = getMutationError(mutationPayload);
  if (mutationError) {
    return context.json({ message: mutationError.message }, mutationError.status);
  }

  const lightResult = await fetchHueJson<HueV1Light>(`/lights/${encodeURIComponent(lightId)}`);
  if (!lightResult.ok) {
    return context.json({ message: lightResult.message }, lightResult.status);
  }

  const groupsResult = await fetchHueJson<HueV1GroupsResponse>("/groups");
  const groupMaps = groupsResult.ok ? buildGroupMaps(groupsResult.data) : buildGroupMaps({});
  const light = mapHueLightToContract(lightId, lightResult.data, groupMaps);
  return context.json({ light });
});

app.get("/api/automations", async (context) => {
  const rulesResult = await fetchHueJson<HueV1RulesResponse>("/rules");
  if (!rulesResult.ok) {
    return context.json({ message: rulesResult.message }, rulesResult.status);
  }

  const automations = Object.entries(rulesResult.data)
    .map(([ruleId, rule]) => mapHueRuleToContract(ruleId, rule))
    .sort((left, right) => left.name.localeCompare(right.name));
  const payload = AutomationsResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    automations,
  });

  return context.json(payload);
});

app.patch("/api/automations/:automationId", async (context) => {
  const automationId = context.req.param("automationId");
  const body = await context.req.json().catch(() => null);
  const parsedBody = AutomationMutationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return context.json({ message: "Invalid automation mutation payload" }, 400);
  }

  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
  }

  const nextStatus = parsedBody.data.isEnabled ? "enabled" : "disabled";
  const mutationResponse = await fetch(`${baseUrl}/rules/${encodeURIComponent(automationId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: nextStatus }),
  }).catch(() => null);
  if (!mutationResponse) {
    return context.json({ message: "Could not reach Hue Bridge." }, 502);
  }
  if (!mutationResponse.ok) {
    return context.json(
      { message: `Hue Bridge request failed (${mutationResponse.status}).` },
      502,
    );
  }

  const mutationPayload = (await mutationResponse.json().catch(() => null)) as
    | HueV1MutationResult[]
    | null;
  if (!Array.isArray(mutationPayload)) {
    return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
  }

  const mutationError = getMutationError(mutationPayload);
  if (mutationError) {
    return context.json({ message: mutationError.message }, mutationError.status);
  }

  const ruleResult = await fetchHueJson<HueV1Rule>(`/rules/${encodeURIComponent(automationId)}`);
  if (!ruleResult.ok) {
    return context.json({ message: ruleResult.message }, ruleResult.status);
  }

  const automation = mapHueRuleToContract(automationId, ruleResult.data);
  const payload = AutomationMutationResponseSchema.parse({ automation });
  return context.json(payload);
});
registerSceneRoutes(app);

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
