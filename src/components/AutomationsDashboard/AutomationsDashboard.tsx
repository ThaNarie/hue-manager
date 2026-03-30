import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { useAutomationsDashboard } from "./AutomationsDashboard.hooks";
import { AutomationsDashboardFilters } from "./AutomationsDashboardFilters";
import { AutomationsDashboardList } from "./AutomationsDashboardList";
import { AutomationsDashboardToasts } from "./AutomationsDashboardToasts";

export function AutomationsDashboard() {
  const {
    automationErrors,
    automations,
    dismissToast,
    error,
    filters,
    filteredAutomations,
    isLoading,
    isRefreshing,
    pendingAutomationIds,
    refresh,
    toasts,
    updateAutomation,
    updateFilters,
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
        <AutomationsDashboardFilters filters={filters} onUpdateFilters={updateFilters} />

        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load automations: {error.message}
          </p>
        ) : null}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>
            Showing {filteredAutomations.length} of {automations.length} automations
          </p>
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
            onUpdateAutomation={updateAutomation}
          />
        )}
      </CardContent>
      <AutomationsDashboardToasts toasts={toasts} onDismissToast={dismissToast} />
    </Card>
  );
}
