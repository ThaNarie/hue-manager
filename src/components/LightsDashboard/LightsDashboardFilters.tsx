import type { LightFilterOption, LightFilters } from "./LightsDashboard.types";
import { LIGHT_SORT_OPTIONS } from "./LightsDashboard.utils";

type LightsDashboardFiltersProps = {
  filters: LightFilters;
  roomOptions: LightFilterOption[];
  zoneOptions: LightFilterOption[];
  onUpdateFilters: (nextPartial: Partial<LightFilters>) => void;
};

export function LightsDashboardFilters({
  filters,
  roomOptions,
  zoneOptions,
  onUpdateFilters,
}: LightsDashboardFiltersProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <label className="space-y-1 text-sm text-muted-foreground">
        <span>Search</span>
        <input
          type="search"
          value={filters.searchQuery}
          onChange={(event) => {
            onUpdateFilters({ searchQuery: event.target.value });
          }}
          placeholder="Name, id, type, room, zone"
          className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
        />
      </label>

      <label className="space-y-1 text-sm text-muted-foreground">
        <span>Room</span>
        <select
          value={filters.roomId}
          onChange={(event) => {
            onUpdateFilters({ roomId: event.target.value });
          }}
          className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
        >
          <option value="">All rooms</option>
          {roomOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm text-muted-foreground">
        <span>Zone</span>
        <select
          value={filters.zoneId}
          onChange={(event) => {
            onUpdateFilters({ zoneId: event.target.value });
          }}
          className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
        >
          <option value="">All zones</option>
          {zoneOptions.map((option) => (
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
          {LIGHT_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
