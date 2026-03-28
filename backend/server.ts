import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  OverviewHealthResponseSchema,
  type OverviewHealthResponse,
} from "../shared/contracts/health.ts";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? "8787");

const app = new Hono();

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

app.get("/api/health", (context) => {
  const payload = OverviewHealthResponseSchema.parse(getOverviewHealth());
  return context.json(payload);
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
