import { Badge } from "../ui/Badge/Badge";
import type { Light } from "../../../shared/contracts/lights";
import { formatLightUpdatedAt } from "./LightsDashboard.utils";

type LightsDashboardListProps = {
  lights: Light[];
};

export function LightsDashboardList({ lights }: LightsDashboardListProps) {
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
