import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  OverviewHealthResponseSchema,
  type OverviewHealthResponse,
} from "../shared/contracts/health.ts";
import {
  LightMutationRequestSchema,
  LightsResponseSchema,
  type Light,
  type LightsResponse,
} from "../shared/contracts/lights.ts";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? "8787");

const app = new Hono();
let mockLights = getMockLights();

app.use("/api/*", cors());

function getOverviewHealth(): OverviewHealthResponse {
  const now = new Date();
  const tenSecondsAgo = new Date(now.getTime() - 10_000);
  const oneMinuteAgo = new Date(now.getTime() - 60_000);

  return {
    generatedAt: now.toISOString(),
    bridge: {
      status: "ok",
      connected: true,
      lastSeenAt: tenSecondsAgo.toISOString(),
    },
    sync: {
      status: "ok",
      lastRunAt: oneMinuteAgo.toISOString(),
      pendingJobs: 0,
    },
  };
}

function getMockLights(): Light[] {
  const now = Date.now();

  return [
    {
      id: "light-001",
      name: "Kitchen Ceiling",
      type: "bulb",
      room: { id: "room-kitchen", name: "Kitchen" },
      zone: { id: "zone-downstairs", name: "Downstairs" },
      isOn: true,
      brightness: 92,
      lastUpdatedAt: new Date(now - 30_000).toISOString(),
    },
    {
      id: "light-002",
      name: "Kitchen Counter Strip",
      type: "strip",
      room: { id: "room-kitchen", name: "Kitchen" },
      zone: { id: "zone-downstairs", name: "Downstairs" },
      isOn: true,
      brightness: 58,
      lastUpdatedAt: new Date(now - 15_000).toISOString(),
    },
    {
      id: "light-003",
      name: "Dining Pendant",
      type: "lamp",
      room: { id: "room-dining", name: "Dining Room" },
      zone: { id: "zone-downstairs", name: "Downstairs" },
      isOn: false,
      brightness: 0,
      lastUpdatedAt: new Date(now - 180_000).toISOString(),
    },
    {
      id: "light-004",
      name: "Living Main",
      type: "bulb",
      room: { id: "room-living", name: "Living Room" },
      zone: { id: "zone-downstairs", name: "Downstairs" },
      isOn: true,
      brightness: 74,
      lastUpdatedAt: new Date(now - 60_000).toISOString(),
    },
    {
      id: "light-005",
      name: "Living Floor Lamp",
      type: "lamp",
      room: { id: "room-living", name: "Living Room" },
      zone: { id: "zone-downstairs", name: "Downstairs" },
      isOn: true,
      brightness: 41,
      lastUpdatedAt: new Date(now - 45_000).toISOString(),
    },
    {
      id: "light-006",
      name: "Hallway North",
      type: "bulb",
      room: { id: "room-hallway", name: "Hallway" },
      zone: { id: "zone-downstairs", name: "Downstairs" },
      isOn: false,
      brightness: 0,
      lastUpdatedAt: new Date(now - 420_000).toISOString(),
    },
    {
      id: "light-007",
      name: "Primary Bedroom Main",
      type: "bulb",
      room: { id: "room-primary-bedroom", name: "Primary Bedroom" },
      zone: { id: "zone-upstairs", name: "Upstairs" },
      isOn: true,
      brightness: 68,
      lastUpdatedAt: new Date(now - 22_000).toISOString(),
    },
    {
      id: "light-008",
      name: "Primary Bedside Left",
      type: "lamp",
      room: { id: "room-primary-bedroom", name: "Primary Bedroom" },
      zone: { id: "zone-upstairs", name: "Upstairs" },
      isOn: false,
      brightness: 0,
      lastUpdatedAt: new Date(now - 900_000).toISOString(),
    },
    {
      id: "light-009",
      name: "Guest Bedroom",
      type: "bulb",
      room: { id: "room-guest-bedroom", name: "Guest Bedroom" },
      zone: { id: "zone-upstairs", name: "Upstairs" },
      isOn: false,
      brightness: 0,
      lastUpdatedAt: new Date(now - 1_200_000).toISOString(),
    },
    {
      id: "light-010",
      name: "Office Desk Lamp",
      type: "lamp",
      room: { id: "room-office", name: "Office" },
      zone: { id: "zone-upstairs", name: "Upstairs" },
      isOn: true,
      brightness: 83,
      lastUpdatedAt: new Date(now - 12_000).toISOString(),
    },
    {
      id: "light-011",
      name: "Office Ambient Strip",
      type: "strip",
      room: { id: "room-office", name: "Office" },
      zone: { id: "zone-upstairs", name: "Upstairs" },
      isOn: true,
      brightness: 39,
      lastUpdatedAt: new Date(now - 9_000).toISOString(),
    },
    {
      id: "light-012",
      name: "Garage Plug Lamp",
      type: "plug",
      room: { id: "room-garage", name: "Garage" },
      zone: null,
      isOn: false,
      brightness: 0,
      lastUpdatedAt: new Date(now - 2_700_000).toISOString(),
    },
  ];
}

function getLightsResponse(): LightsResponse {
  return {
    generatedAt: new Date().toISOString(),
    lights: mockLights,
  };
}

app.get("/api/health", (context) => {
  const payload = OverviewHealthResponseSchema.parse(getOverviewHealth());
  return context.json(payload);
});

app.get("/api/lights", (context) => {
  const payload = LightsResponseSchema.parse(getLightsResponse());
  return context.json(payload);
});

app.patch("/api/lights/:lightId", async (context) => {
  const lightId = context.req.param("lightId");
  const body = await context.req.json().catch(() => null);
  const parsedBody = LightMutationRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return context.json({ message: "Invalid light mutation payload" }, 400);
  }

  const lightIndex = mockLights.findIndex((light) => light.id === lightId);
  if (lightIndex === -1) {
    return context.json({ message: `Unknown light (${lightId})` }, 404);
  }

  const currentLight = mockLights[lightIndex];
  const nextIsOn =
    parsedBody.data.isOn ??
    (parsedBody.data.brightness !== undefined ? parsedBody.data.brightness > 0 : currentLight.isOn);
  const nextBrightness = !nextIsOn ? 0 : (parsedBody.data.brightness ?? currentLight.brightness);
  const nextLight: Light = {
    ...currentLight,
    isOn: nextIsOn,
    brightness: nextBrightness,
    lastUpdatedAt: new Date().toISOString(),
  };

  mockLights = mockLights.map((light) => (light.id === lightId ? nextLight : light));
  return context.json({ light: nextLight });
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
