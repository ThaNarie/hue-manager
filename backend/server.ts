import { createServer } from "node:http";
import {
  OverviewHealthResponseSchema,
  type OverviewHealthResponse,
} from "../shared/contracts/health.ts";

const host = process.env.API_HOST ?? "127.0.0.1";
const port = Number(process.env.API_PORT ?? "8787");

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

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/api/health") {
    const payload = OverviewHealthResponseSchema.parse(getOverviewHealth());
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
    return;
  }

  res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ message: "Not found" }));
});

server.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
