import { Badge } from "../ui/Badge/Badge";
import type { Automation } from "../../../shared/contracts/automations";
import type { AutomationControlErrorMap } from "./AutomationsDashboard.types";
import { formatAutomationTriggeredAt } from "./AutomationsDashboard.utils";

type AutomationsDashboardListProps = {
  automations: Automation[];
  automationErrors: AutomationControlErrorMap;
  pendingAutomationIds: string[];
  writesDisabled: boolean;
  onUpdateAutomation: (automationId: string, isEnabled: boolean) => void;
};

export function AutomationsDashboardList({
  automations,
  automationErrors,
  pendingAutomationIds,
  writesDisabled,
  onUpdateAutomation,
}: AutomationsDashboardListProps) {
  return (
    <div className="space-y-2">
      {automations.map((automation) => (
        <div
          key={automation.id}
          className="grid gap-2 rounded-md border border-border bg-slate-900/50 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <div>
            <p className="text-sm font-medium text-slate-100">{automation.name}</p>
            <p className="text-xs text-muted-foreground">{automation.id}</p>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Owner: {automation.owner ?? "External/unknown"}</p>
            <p>Triggered: {formatAutomationTriggeredAt(automation.lastTriggeredAt)}</p>
          </div>

          <div className="text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                onUpdateAutomation(automation.id, !automation.isEnabled);
              }}
              className="rounded-md border border-border px-2 py-1 text-xs text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={writesDisabled || pendingAutomationIds.includes(automation.id)}
            >
              {automation.isEnabled ? "Disable" : "Enable"}
            </button>
            {automationErrors[automation.id] ? (
              <p className="mt-2 rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-xs text-red-200">
                Update failed: {automationErrors[automation.id]}
              </p>
            ) : null}
          </div>

          <div className="justify-self-start sm:justify-self-end">
            <Badge variant={automation.isEnabled ? "ok" : "down"}>
              {automation.isEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
