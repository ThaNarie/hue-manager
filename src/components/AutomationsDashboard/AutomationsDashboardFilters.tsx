import type { AutomationFilters } from "./AutomationsDashboard.types";
import { AUTOMATION_SORT_OPTIONS, AUTOMATION_STATUS_OPTIONS } from "./AutomationsDashboard.utils";

type AutomationsDashboardFiltersProps = {
  filters: AutomationFilters;
  onUpdateFilters: (nextPartial: Partial<AutomationFilters>) => void;
};

export function AutomationsDashboardFilters({
  filters,
  onUpdateFilters,
}: AutomationsDashboardFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-1 text-sm text-muted-foreground">
        <span>Search</span>
        <input
          type="search"
          value={filters.searchQuery}
          onChange={(event) => {
            onUpdateFilters({ searchQuery: event.target.value });
          }}
          placeholder="Name, id, status, owner"
          className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
        />
      </label>

      <label className="space-y-1 text-sm text-muted-foreground">
        <span>Status</span>
        <select
          value={filters.status}
          onChange={(event) => {
            onUpdateFilters({ status: event.target.value as typeof filters.status });
          }}
          className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
        >
          {AUTOMATION_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm text-muted-foreground">
        <span>Sort</span>
        <select
          value={filters.sort}
          onChange={(event) => {
            onUpdateFilters({ sort: event.target.value as typeof filters.sort });
          }}
          className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
        >
          {AUTOMATION_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
