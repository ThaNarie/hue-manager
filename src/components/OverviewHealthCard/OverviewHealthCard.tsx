import { Activity, DatabaseBackup } from "lucide-react";
import { Badge } from "../ui/Badge/Badge";
import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { useOverviewHealthCard } from "./OverviewHealthCard.hooks";
import { formatDate, statusToBadgeVariant } from "./OverviewHealthCard.utils";

export function OverviewHealthCard() {
  const {
    error,
    hasData,
    health,
    isBridgeOffline,
    isLoading,
    isRefreshing,
    isStale,
    lastFreshAt,
    pollMs,
    refresh,
  } = useOverviewHealthCard();

  if (error && !hasData) {
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
          <p>{error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !health) {
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
              <Badge variant={statusToBadgeVariant(health.bridge.status)}>
                {health.bridge.status}
              </Badge>
              <span className="text-sm text-slate-200">
                {health.bridge.connected ? "Connected" : "Disconnected"}
              </span>
              {isStale ? <Badge variant="down">stale</Badge> : null}
            </div>
          </div>
          <div className="rounded-md border border-border bg-card/60 p-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Sync
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={statusToBadgeVariant(health.sync.status)}>{health.sync.status}</Badge>
              <span className="text-sm text-slate-200">{health.sync.pendingJobs} pending jobs</span>
            </div>
          </div>
        </div>
        {isBridgeOffline ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100">
            Bridge unavailable. Showing last known state from{" "}
            {lastFreshAt ? formatDate(lastFreshAt) : "an unknown time"}. Auto-retrying every{" "}
            {pollMs / 1000}s; use Refresh to retry now.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Last successful sync {formatDate(health.sync.lastRunAt)} • Updated{" "}
          {formatDate(health.generatedAt)} • Polling every {pollMs / 1000}s • Contract validated via
          shared Zod schema.
        </p>
      </CardContent>
    </Card>
  );
}
