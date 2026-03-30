import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { SavedViewControls } from "../SavedViewControls/SavedViewControls";
import { LightsDashboardFilters } from "./LightsDashboardFilters";
import { useLightsDashboard } from "./LightsDashboard.hooks";
import { LightsDashboardList } from "./LightsDashboardList";
import { LightsDashboardToasts } from "./LightsDashboardToasts";
import { UNASSIGNED_ZONE_FILTER } from "./LightsDashboard.types";

export function LightsDashboard() {
  const {
    dismissToast,
    error,
    filters,
    filteredLights,
    bulkTurnOnFilteredLights,
    isLoading,
    isRefreshing,
    isBridgeOffline,
    lightErrors,
    lights,
    pendingLightIds,
    refresh,
    roomOptions,
    saveCurrentView,
    savedViewDraftName,
    savedViews,
    selectedSavedViewName,
    toasts,
    updateLight,
    updateFilters,
    applySelectedSavedView,
    deleteSelectedSavedView,
    setSavedViewDraftName,
    setSelectedSavedViewName,
    zoneOptions,
  } = useLightsDashboard();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Lights</CardTitle>
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
        <SavedViewControls
          title="Saved light views"
          saveLabel="Save current view"
          namePlaceholder="Evening downstairs"
          savedViews={savedViews.map((view) => view.name)}
          draftName={savedViewDraftName}
          selectedViewName={selectedSavedViewName}
          onDraftNameChange={setSavedViewDraftName}
          onSelectedViewNameChange={setSelectedSavedViewName}
          onSave={saveCurrentView}
          onApply={applySelectedSavedView}
          onDelete={deleteSelectedSavedView}
        />

        <LightsDashboardFilters
          filters={filters}
          roomOptions={roomOptions}
          zoneOptions={zoneOptions}
          onUpdateFilters={updateFilters}
        />

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load lights: {error.message}
          </p>
        ) : null}
        {isBridgeOffline ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
            Bridge offline. Light write actions are disabled until reconnect.
          </p>
        ) : null}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Showing {filteredLights.length} of {lights.length} lights
          </p>
          {filters.zoneId === UNASSIGNED_ZONE_FILTER ? <p>Filtered to unassigned zone</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={bulkTurnOnFilteredLights}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={filteredLights.length === 0}
          >
            Turn on all filtered
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading lights...</p>
        ) : filteredLights.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lights matched your filters.</p>
        ) : (
          <LightsDashboardList
            lights={filteredLights}
            lightErrors={lightErrors}
            pendingLightIds={pendingLightIds}
            writesDisabled={isBridgeOffline}
            onUpdateLight={updateLight}
          />
        )}
      </CardContent>
      <LightsDashboardToasts toasts={toasts} onDismissToast={dismissToast} />
    </Card>
  );
}
