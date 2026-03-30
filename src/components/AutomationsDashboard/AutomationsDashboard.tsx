import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { SavedViewControls } from "../SavedViewControls/SavedViewControls";
import { useAutomationsDashboard } from "./AutomationsDashboard.hooks";
import { AutomationsDashboardEditor } from "./AutomationsDashboardEditor";
import { AutomationsDashboardFilters } from "./AutomationsDashboardFilters";
import { AutomationsDashboardJsonEditor } from "./AutomationsDashboardJsonEditor";
import { AutomationsDashboardList } from "./AutomationsDashboardList";
import { AutomationsDashboardToasts } from "./AutomationsDashboardToasts";

export function AutomationsDashboard() {
  const {
    automationErrors,
    automations,
    bulkEnableFilteredAutomations,
    dismissToast,
    error,
    editorVariant,
    filters,
    filteredAutomations,
    isBridgeOffline,
    isLoading,
    isSavingGuidedAutomation,
    isRefreshing,
    guidedMode,
    jsonApiError,
    jsonDraft,
    jsonDraftErrors,
    onCancelGuidedEdit,
    onSubmitGuidedAutomation,
    onSubmitJsonAutomation,
    requiredGuidedSafetyAction,
    requiredJsonSafetyAction,
    guidedDraft,
    guidedDraftErrors,
    pendingAutomationIds,
    refresh,
    setEditorVariant,
    saveCurrentView,
    savedViewDraftName,
    savedViews,
    selectedSavedViewName,
    setGuidedDraft,
    setJsonDraft,
    toasts,
    startGuidedEdit,
    startJsonEdit,
    updateAutomation,
    updateFilters,
    applySelectedSavedView,
    deleteSelectedSavedView,
    setSavedViewDraftName,
    setSelectedSavedViewName,
  } = useAutomationsDashboard();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Automations</CardTitle>
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
          title="Saved automation views"
          saveLabel="Save current view"
          namePlaceholder="Disabled by owner"
          savedViews={savedViews.map((view) => view.name)}
          draftName={savedViewDraftName}
          selectedViewName={selectedSavedViewName}
          onDraftNameChange={setSavedViewDraftName}
          onSelectedViewNameChange={setSelectedSavedViewName}
          onSave={saveCurrentView}
          onApply={applySelectedSavedView}
          onDelete={deleteSelectedSavedView}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs transition ${
              editorVariant === "guided"
                ? "border-slate-500 text-slate-100"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setEditorVariant("guided");
            }}
            disabled={isSavingGuidedAutomation}
          >
            Guided mode
          </button>
          <button
            type="button"
            className={`rounded-md border px-2 py-1 text-xs transition ${
              editorVariant === "json"
                ? "border-slate-500 text-slate-100"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => {
              setEditorVariant("json");
            }}
            disabled={isSavingGuidedAutomation}
          >
            Advanced JSON mode
          </button>
        </div>

        {editorVariant === "guided" ? (
          <AutomationsDashboardEditor
            draft={guidedDraft}
            errors={guidedDraftErrors}
            mode={guidedMode}
            pending={isSavingGuidedAutomation}
            requiredSafetyAction={requiredGuidedSafetyAction}
            onDraftChange={setGuidedDraft}
            onSubmit={onSubmitGuidedAutomation}
            onCancelEdit={onCancelGuidedEdit}
          />
        ) : (
          <AutomationsDashboardJsonEditor
            draft={jsonDraft}
            errors={jsonDraftErrors}
            pending={isSavingGuidedAutomation}
            requiredSafetyAction={requiredJsonSafetyAction}
            apiError={jsonApiError}
            onDraftChange={setJsonDraft}
            onSubmit={onSubmitJsonAutomation}
            onCancelEdit={onCancelGuidedEdit}
          />
        )}

        <AutomationsDashboardFilters filters={filters} onUpdateFilters={updateFilters} />

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load automations: {error.message}
          </p>
        ) : null}
        {isBridgeOffline ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
            Bridge offline. Automation write actions are disabled until reconnect.
          </p>
        ) : null}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Showing {filteredAutomations.length} of {automations.length} automations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={bulkEnableFilteredAutomations}
            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={filteredAutomations.length === 0}
          >
            Enable all filtered
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading automations...</p>
        ) : filteredAutomations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No automations matched your filters.</p>
        ) : (
          <AutomationsDashboardList
            automations={filteredAutomations}
            automationErrors={automationErrors}
            pendingAutomationIds={pendingAutomationIds}
            writesDisabled={isBridgeOffline}
            onUpdateAutomation={updateAutomation}
            onEditAutomation={startGuidedEdit}
            onEditAutomationJson={startJsonEdit}
          />
        )}
      </CardContent>
      <AutomationsDashboardToasts toasts={toasts} onDismissToast={dismissToast} />
    </Card>
  );
}
