import { Activity, DatabaseBackup } from "lucide-react";
import { Badge } from "../ui/Badge/Badge";
import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { useOverviewHealthCard } from "./OverviewHealthCard.hooks";
import { formatDate, statusToBadgeVariant } from "./OverviewHealthCard.utils";

export function OverviewHealthCard() {
  const { health, isRefreshing, pollMs, refresh } = useOverviewHealthCard();

  if (health.status === "error") {
    return (
      <Card className="border-red-500/40 bg-red-950/20">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Bridge & Sync Health</CardTitle>
            <button
              className="rounded-md border border-red-300/40 px-3 py-1 text-xs font-medium text-red-100 transition hover:border-red-200/70 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                void refresh();
              }}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Bridge & Sync Health</CardTitle>
            <button
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                void refresh();
              }}
              disabled
            >
              Refresh
            </button>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-slate-300">Loading health data...</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Bridge & Sync Health</CardTitle>
          <button
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
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
          Last successful sync {formatDate(health.data.sync.lastRunAt)} • Updated{" "}
          {formatDate(health.data.generatedAt)} • Polling every {pollMs / 1000}s • Contract
          validated via shared Zod schema.
        </p>
      </CardContent>
    </Card>
  );
}
