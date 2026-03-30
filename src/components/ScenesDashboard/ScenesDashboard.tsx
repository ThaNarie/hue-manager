import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { ScenesDashboardForm } from "./ScenesDashboardForm";
import { useScenesDashboard } from "./ScenesDashboard.hooks";
import { ScenesDashboardList } from "./ScenesDashboardList";
import { ScenesDashboardToasts } from "./ScenesDashboardToasts";

export function ScenesDashboard() {
  const {
    activateScene,
    createScene,
    creatingScene,
    deleteScene,
    deleteScenes,
    dismissToast,
    draft,
    editScene,
    error,
    isBridgeOffline,
    isLoading,
    isRefreshing,
    pendingSceneIds,
    refresh,
    scenes,
    setDraft,
    sortedScenes,
    toasts,
  } = useScenesDashboard();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Scenes</CardTitle>
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
        <ScenesDashboardForm
          draft={draft}
          disabled={creatingScene || isBridgeOffline}
          onDraftChange={setDraft}
          onCreateScene={createScene}
        />

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load scenes: {error.message}
          </p>
        ) : null}
        {isBridgeOffline ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
            Bridge offline. Scene write actions are disabled until reconnect.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">Showing {scenes.length} scenes</p>

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading scenes...</p>
        ) : sortedScenes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scenes available yet.</p>
        ) : (
          <ScenesDashboardList
            scenes={sortedScenes}
            pendingSceneIds={pendingSceneIds}
            writesDisabled={isBridgeOffline}
            onActivateScene={activateScene}
            onEditScene={editScene}
            onDeleteScene={deleteScene}
            onBulkDeleteScenes={(sceneIds) => {
              void deleteScenes(sceneIds);
            }}
          />
        )}
      </CardContent>
      <ScenesDashboardToasts toasts={toasts} onDismissToast={dismissToast} />
    </Card>
  );
}
