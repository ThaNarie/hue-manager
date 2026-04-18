import { OverviewHealthCard } from "../components/OverviewHealthCard/OverviewHealthCard";
import { BackupsDashboard } from "../components/BackupsDashboard/BackupsDashboard";

export function IndexPage() {
  return (
    <div className="space-y-6">
      <OverviewHealthCard />
      <BackupsDashboard />
    </div>
  );
}
