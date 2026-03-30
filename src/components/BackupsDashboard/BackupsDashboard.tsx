import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { BackupsDashboardToasts } from "./BackupsDashboardToasts";
import { useBackupsDashboard } from "./BackupsDashboard.hooks";

function getBackupLabel(reason: string, trigger: string): string {
  if (reason === "manual") {
    return "Manual dashboard backup";
  }
  return `Automatic snapshot (${trigger})`;
}

export function BackupsDashboard() {
  const {
    backups,
    createBackup,
    dismissToast,
    error,
    isCreating,
    isLoading,
    isRefreshing,
    refresh,
    restoringBackupId,
    restoreBackup,
    toasts,
  } = useBackupsDashboard();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Backups</CardTitle>
          <div className="flex items-center gap-2">
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
            <button
              className="rounded-md border border-emerald-500/50 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={createBackup}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create Backup"}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load backups: {error.message}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading backups...</p>
        ) : backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups available yet.</p>
        ) : (
          <ul className="space-y-2">
            {backups.map((backup) => (
              <li
                key={backup.id}
                className="rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-100">
                      {getBackupLabel(backup.reason, backup.trigger)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(backup.createdAt).toLocaleString()} - {backup.id}
                    </p>
                  </div>
                  <button
                    className="rounded-md border border-amber-500/50 bg-amber-950/30 px-3 py-1 text-xs font-medium text-amber-100 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    onClick={() => {
                      restoreBackup(backup.id);
                    }}
                    disabled={restoringBackupId !== null}
                  >
                    {restoringBackupId === backup.id ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <BackupsDashboardToasts toasts={toasts} onDismissToast={dismissToast} />
    </Card>
  );
}
