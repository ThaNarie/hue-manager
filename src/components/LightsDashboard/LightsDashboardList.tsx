import { Badge } from "../ui/Badge/Badge";
import type { Light } from "../../../shared/contracts/lights";
import type { LightControlErrorMap } from "./LightsDashboard.types";
import { formatLightUpdatedAt } from "./LightsDashboard.utils";

type LightsDashboardListProps = {
  lights: Light[];
  lightErrors: LightControlErrorMap;
  pendingLightIds: string[];
  onUpdateLight: (lightId: string, patch: { isOn?: boolean; brightness?: number }) => void;
};

export function LightsDashboardList({
  lights,
  lightErrors,
  pendingLightIds,
  onUpdateLight,
}: LightsDashboardListProps) {
  return (
    <div className="space-y-2">
      {lights.map((light) => (
        <div
          key={light.id}
          className="grid gap-2 rounded-md border border-border bg-slate-900/50 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <div>
            <p className="text-sm font-medium text-slate-100">{light.name}</p>
            <p className="text-xs text-muted-foreground">{light.id}</p>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>{light.room.name}</p>
            <p>{light.zone?.name ?? "Unassigned zone"}</p>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Type: {light.type}</p>
            <p>Brightness: {light.brightness}%</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onUpdateLight(light.id, { isOn: !light.isOn });
                }}
                className="rounded-md border border-border px-2 py-1 text-xs text-slate-100 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pendingLightIds.includes(light.id)}
              >
                {light.isOn ? "Turn off" : "Turn on"}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={light.brightness}
                onChange={(event) => {
                  onUpdateLight(light.id, { brightness: Number(event.target.value) });
                }}
                className="h-1 w-full accent-slate-300"
                aria-label={`Brightness for ${light.name}`}
                disabled={pendingLightIds.includes(light.id)}
              />
            </div>
            {lightErrors[light.id] ? (
              <p className="mt-2 rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-xs text-red-200">
                Update failed: {lightErrors[light.id]}
              </p>
            ) : null}
          </div>

          <div className="justify-self-start sm:justify-self-end">
            <Badge variant={light.isOn ? "ok" : "down"}>{light.isOn ? "On" : "Off"}</Badge>
            <p className="mt-1 text-right text-xs text-muted-foreground">
              Updated {formatLightUpdatedAt(light.lastUpdatedAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
