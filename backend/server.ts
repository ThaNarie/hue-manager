import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { OverviewHealthResponseSchema } from "../shared/contracts/health.ts";
import {
  AutomationCreateRequestSchema,
  AutomationsResponseSchema,
  AutomationMutationRequestSchema,
  AutomationMutationResponseSchema,
} from "../shared/contracts/automations.ts";
import {
  AUTOMATION_SAFETY_APPROVAL_ACTION_HEADER,
  AUTOMATION_SAFETY_APPROVAL_TOKEN_HEADER,
  isAutomationMutationSafetyApprovalValid,
  type AutomationMutationSafetyApproval,
} from "../shared/safety/automationMutationSafetyPolicy.ts";
import {
  AuditEventsResponseSchema,
  UpdateAuditRetentionRequestSchema,
} from "../shared/contracts/audit.ts";
import {
  GroupKindSchema,
  GroupMutationRequestSchema,
  GroupsResponseSchema,
  type GroupsResponse,
} from "../shared/contracts/groups.ts";
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
import {
  SAFETY_APPROVAL_ACTION_HEADER,
  SAFETY_APPROVAL_TOKEN_HEADER,
  isLightMutationSafetyApprovalValid,
  type LightMutationSafetyApproval,
} from "../shared/safety/lightMutationSafetyPolicy.ts";
import type {
  HueV1Group,
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
  getCreatedResourceId,
  getHueBaseUrl,
  getMutationError,
  getOverviewHealth,
  mapHueGroupsToContract,
  mapHueLightToContract,
  mapHueRuleToContract,
  toGroupKind,
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

app.get("/api/groups", async (context) => {
  const groupsResult = await fetchHueJson<HueV1GroupsResponse>("/groups");
  if (!groupsResult.ok) {
    return context.json({ message: groupsResult.message }, groupsResult.status);
  }

  const lightsResult = await fetchHueJson<HueV1LightsResponse>("/lights");
  if (!lightsResult.ok) {
    return context.json({ message: lightsResult.message }, lightsResult.status);
  }

  const payload = GroupsResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    ...mapHueGroupsToContract(groupsResult.data, lightsResult.data),
  } satisfies GroupsResponse);
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

  const safetyActionHeader = context.req.header(SAFETY_APPROVAL_ACTION_HEADER);
  const safetyTokenHeader = context.req.header(SAFETY_APPROVAL_TOKEN_HEADER);
  const safetyApproval: LightMutationSafetyApproval | null =
    safetyActionHeader === "confirm" || safetyActionHeader === "explicit"
      ? {
          action: safetyActionHeader,
          token: safetyTokenHeader,
        }
      : null;
  if (!isLightMutationSafetyApprovalValid(parsedBody.data, safetyApproval)) {
    return context.json({ message: "Safety policy rejected this light mutation." }, 403);
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

app.patch("/api/groups/:groupKind/:groupId", async (context) => {
  const groupKind = context.req.param("groupKind");
  const groupId = context.req.param("groupId");
  const parsedGroupKind = GroupKindSchema.safeParse(groupKind);
  if (!parsedGroupKind.success) {
    return context.json({ message: "Invalid group kind" }, 400);
  }

  const body = await context.req.json().catch(() => null);
  const parsedBody = GroupMutationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return context.json({ message: "Invalid group mutation payload" }, 400);
  }

  const currentGroupResult = await fetchHueJson<HueV1Group>(
    `/groups/${encodeURIComponent(groupId)}`,
  );
  if (!currentGroupResult.ok) {
    return context.json({ message: currentGroupResult.message }, currentGroupResult.status);
  }

  const currentGroupKind = toGroupKind(currentGroupResult.data.type);
  if (!currentGroupKind || currentGroupKind !== parsedGroupKind.data) {
    return context.json({ message: "Group not found" }, 404);
  }

  const updatePayload: { name?: string; lights?: string[] } = {};
  if (parsedBody.data.name !== undefined) {
    updatePayload.name = parsedBody.data.name;
  }
  if (parsedBody.data.memberLightIds !== undefined) {
    updatePayload.lights = parsedBody.data.memberLightIds;
  }
  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
  }

  const mutationResponse = await fetch(`${baseUrl}/groups/${encodeURIComponent(groupId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
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

  const groupsResult = await fetchHueJson<HueV1GroupsResponse>("/groups");
  if (!groupsResult.ok) {
    return context.json({ message: groupsResult.message }, groupsResult.status);
  }
  const lightsResult = await fetchHueJson<HueV1LightsResponse>("/lights");
  if (!lightsResult.ok) {
    return context.json({ message: lightsResult.message }, lightsResult.status);
  }
  const mapped = mapHueGroupsToContract(groupsResult.data, lightsResult.data);
  const group = mapped.groups.find(
    (entry) => entry.kind === parsedGroupKind.data && entry.hueGroupId === groupId,
  );
  if (!group) {
    return context.json({ message: "Group not found" }, 404);
  }
  return context.json({ group });
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

app.get("/api/automations/:automationId", async (context) => {
  const automationId = context.req.param("automationId");
  const ruleResult = await fetchHueJson<HueV1Rule>(`/rules/${encodeURIComponent(automationId)}`);
  if (!ruleResult.ok) {
    return context.json({ message: ruleResult.message }, ruleResult.status);
  }

  const automation = mapHueRuleToContract(automationId, ruleResult.data);
  const payload = AutomationMutationResponseSchema.parse({ automation });
  return context.json(payload);
});

app.post("/api/automations", async (context) => {
  const body = await context.req.json().catch(() => null);
  const parsedBody = AutomationCreateRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return context.json({ message: "Invalid automation create payload" }, 400);
  }

  const safetyActionHeader = context.req.header(AUTOMATION_SAFETY_APPROVAL_ACTION_HEADER);
  const safetyTokenHeader = context.req.header(AUTOMATION_SAFETY_APPROVAL_TOKEN_HEADER);
  const safetyApproval: AutomationMutationSafetyApproval | null =
    safetyActionHeader === "confirm" || safetyActionHeader === "explicit"
      ? {
          action: safetyActionHeader,
          token: safetyTokenHeader,
        }
      : null;
  if (!isAutomationMutationSafetyApprovalValid(parsedBody.data, safetyApproval)) {
    return context.json({ message: "Safety policy rejected this automation mutation." }, 403);
  }

  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
  }

  const createResponse = await fetch(`${baseUrl}/rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: parsedBody.data.name,
      status: parsedBody.data.isEnabled ? "enabled" : "disabled",
      conditions: parsedBody.data.conditions,
      actions: parsedBody.data.actions,
    }),
  }).catch(() => null);
  if (!createResponse) {
    return context.json({ message: "Could not reach Hue Bridge." }, 502);
  }
  if (!createResponse.ok) {
    return context.json({ message: `Hue Bridge request failed (${createResponse.status}).` }, 502);
  }

  const mutationPayload = (await createResponse.json().catch(() => null)) as
    | HueV1MutationResult[]
    | null;
  if (!Array.isArray(mutationPayload)) {
    return context.json({ message: "Hue Bridge returned invalid mutation response." }, 502);
  }
  const mutationError = getMutationError(mutationPayload);
  if (mutationError) {
    return context.json({ message: mutationError.message }, mutationError.status);
  }

  const createdRuleId = getCreatedResourceId(mutationPayload);
  if (!createdRuleId) {
    return context.json({ message: "Hue Bridge did not return a created automation id." }, 502);
  }

  const ruleResult = await fetchHueJson<HueV1Rule>(`/rules/${encodeURIComponent(createdRuleId)}`);
  if (!ruleResult.ok) {
    return context.json({ message: ruleResult.message }, ruleResult.status);
  }

  const automation = mapHueRuleToContract(createdRuleId, ruleResult.data);
  const payload = AutomationMutationResponseSchema.parse({ automation });
  return context.json(payload, 201);
});

app.patch("/api/automations/:automationId", async (context) => {
  const automationId = context.req.param("automationId");
  const body = await context.req.json().catch(() => null);
  const parsedBody = AutomationMutationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return context.json({ message: "Invalid automation mutation payload" }, 400);
  }

  const safetyActionHeader = context.req.header(AUTOMATION_SAFETY_APPROVAL_ACTION_HEADER);
  const safetyTokenHeader = context.req.header(AUTOMATION_SAFETY_APPROVAL_TOKEN_HEADER);
  const safetyApproval: AutomationMutationSafetyApproval | null =
    safetyActionHeader === "confirm" || safetyActionHeader === "explicit"
      ? {
          action: safetyActionHeader,
          token: safetyTokenHeader,
        }
      : null;
  if (!isAutomationMutationSafetyApprovalValid(parsedBody.data, safetyApproval)) {
    return context.json({ message: "Safety policy rejected this automation mutation." }, 403);
  }

  const baseUrl = getHueBaseUrl();
  if (!baseUrl) {
    return context.json({ message: HUE_NOT_CONFIGURED_MESSAGE }, 500);
  }

  const updatePayload: {
    name?: string;
    status?: "enabled" | "disabled";
    conditions?: Array<{ address: string; operator: string; value: string }>;
    actions?: Array<{
      address: string;
      method: "PUT" | "POST" | "DELETE";
      body: Record<string, unknown>;
    }>;
  } = {};
  if (parsedBody.data.name !== undefined) {
    updatePayload.name = parsedBody.data.name;
  }
  if (parsedBody.data.isEnabled !== undefined) {
    updatePayload.status = parsedBody.data.isEnabled ? "enabled" : "disabled";
  }
  if (parsedBody.data.conditions !== undefined) {
    updatePayload.conditions = parsedBody.data.conditions;
  }
  if (parsedBody.data.actions !== undefined) {
    updatePayload.actions = parsedBody.data.actions;
  }
  const mutationResponse = await fetch(`${baseUrl}/rules/${encodeURIComponent(automationId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
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
