import { Card } from "../ui/Card/Card";
import { CardContent } from "../ui/Card/CardContent";
import { CardHeader } from "../ui/Card/CardHeader";
import { CardTitle } from "../ui/Card/CardTitle";
import { useGroupsDashboard } from "./GroupsDashboard.hooks";
import { GroupsDashboardToasts } from "./GroupsDashboardToasts";

export function GroupsDashboard() {
  const {
    availableLights,
    drafts,
    error,
    groupErrors,
    groups,
    hasChanges,
    isLoading,
    isRefreshing,
    pendingGroupIds,
    refresh,
    saveGroup,
    toasts,
    toggleGroupMembership,
    updateGroupName,
    dismissToast,
  } = useGroupsDashboard();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Rooms and zones</CardTitle>
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
        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load rooms/zones: {error.message}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {groups.length} groups and {availableLights.length} lights available for membership edits
        </p>

        {isLoading ? (
          <p className="text-sm text-slate-300">Loading rooms and zones...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rooms or zones found.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const draft = drafts[group.id];
              const hasPending = pendingGroupIds.includes(group.id);
              const isSaveDisabled =
                hasPending || !draft || !hasChanges(group) || draft.name.trim().length === 0;
              return (
                <div key={group.id} className="space-y-3 rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-100">
                      {group.kind === "room" ? "Room" : "Zone"}: {group.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{group.members.length} members</p>
                  </div>

                  <label className="space-y-1 text-sm text-muted-foreground">
                    <span>Name</span>
                    <input
                      type="text"
                      value={draft?.name ?? group.name}
                      onChange={(event) => {
                        updateGroupName(group.id, event.target.value);
                      }}
                      className="w-full rounded-md border border-border bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus-visible:border-slate-500"
                      disabled={hasPending}
                    />
                  </label>

                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Members</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {availableLights.map((light) => (
                        <label
                          key={`${group.id}-${light.id}`}
                          className="flex items-center gap-2 rounded border border-border/50 px-2 py-1 text-xs text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(draft?.memberLightIds.includes(light.id))}
                            onChange={() => {
                              toggleGroupMembership(group.id, light.id);
                            }}
                            disabled={hasPending}
                          />
                          <span>{light.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {groupErrors[group.id] ? (
                    <p className="rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-xs text-red-200">
                      Update failed: {groupErrors[group.id]}
                    </p>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        saveGroup(group);
                      }}
                      className="rounded-md border border-border px-3 py-1 text-xs font-medium text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isSaveDisabled}
                    >
                      {hasPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <GroupsDashboardToasts toasts={toasts} onDismissToast={dismissToast} />
    </Card>
  );
}
