import { useEffect, useState } from "react";
import { Activity, DatabaseBackup } from "lucide-react";
import { parseOverviewHealthResponse } from "../../../shared/contracts/health";
import { Badge } from "../ui/Badge/Badge";
import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import type { OverviewHealthCardState } from "./OverviewHealthCard.types";
import { formatDate, statusToBadgeVariant } from "./OverviewHealthCard.utils";

async function loadHealth(): Promise<OverviewHealthCardState> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      return {
        status: "error",
        message: `Health endpoint failed (${response.status})`,
      };
    }

    const payload = await response.json();
    const parsed = parseOverviewHealthResponse(payload);
    return { status: "ready", data: parsed };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown health error",
    };
  }
}

export function OverviewHealthCard() {
  const [health, setHealth] = useState<OverviewHealthCardState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    void loadHealth().then((result) => {
      if (active) {
        setHealth(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  if (health.status === "error") {
    return (
      <Card className="border-red-500/40 bg-red-950/20">
        <CardHeader>
          <CardTitle>Bridge & Sync Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-red-200">
          <p>Unable to load health contract.</p>
          <p>{health.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (health.status === "loading") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bridge & Sync Health</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-300">Loading health data...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bridge & Sync Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-card/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <DatabaseBackup className="h-4 w-4" />
              Bridge
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={statusToBadgeVariant(health.data.bridge.status)}>
                {health.data.bridge.status}
              </Badge>
              <span className="text-sm text-slate-200">
                {health.data.bridge.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Sync
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={statusToBadgeVariant(health.data.sync.status)}>
                {health.data.sync.status}
              </Badge>
              <span className="text-sm text-slate-200">
                {health.data.sync.pendingJobs} pending jobs
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {formatDate(health.data.generatedAt)} • Contract validated via shared Zod schema.
        </p>
      </CardContent>
    </Card>
  );
}
