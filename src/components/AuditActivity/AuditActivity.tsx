import { Download, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "../ui/Badge/Badge";
import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { useAuditActivity } from "./AuditActivity.hooks";
import { formatAuditDetails, formatAuditTimestamp } from "./AuditActivity.utils";

export function AuditActivity() {
  const {
    applyRetention,
    error,
    events,
    exportEvents,
    isExporting,
    isLoading,
    isPurging,
    isRefreshing,
    isUpdatingRetention,
    purgeEvents,
    refresh,
    retentionInput,
    retentionDays,
    setRetentionInput,
  } = useAuditActivity();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Audit Activity</CardTitle>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => {
              void refresh();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-card/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">Settings</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              Retention days
              <input
                className="h-9 w-24 rounded-md border border-border bg-background px-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                type="number"
                min={1}
                max={3650}
                value={retentionInput}
                onChange={(event) => {
                  setRetentionInput(event.target.value);
                }}
              />
            </label>
            <button
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                const parsedDays = Number.parseInt(retentionInput, 10);
                if (Number.isNaN(parsedDays)) {
                  return;
                }

                applyRetention(parsedDays);
              }}
              disabled={isUpdatingRetention}
            >
              {isUpdatingRetention ? "Applying..." : "Apply retention"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                exportEvents();
              }}
              disabled={isExporting}
            >
              <Download className="h-3.5 w-3.5" />
              {isExporting ? "Exporting..." : "Export JSON"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-red-400/50 px-3 py-1 text-xs font-medium text-red-200 transition hover:border-red-300/80 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => {
                purgeEvents();
              }}
              disabled={isPurging}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isPurging ? "Purging..." : "Purge events"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Active retention policy: {retentionDays} days
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Audit request failed: {error.message}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading audit events...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <article
                key={event.id}
                className="rounded-md border border-border bg-card/60 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={event.outcome === "success" ? "ok" : "down"}>
                    {event.outcome}
                  </Badge>
                  <span className="text-slate-100">{event.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {event.entityType}:{event.entityId ?? "unknown"}
                  </span>
                </div>
                <p className="mt-1 text-slate-200">{formatAuditDetails(event)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatAuditTimestamp(event.recordedAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
