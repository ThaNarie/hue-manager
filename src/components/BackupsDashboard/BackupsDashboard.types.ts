import type { BackupSummary } from "../../../shared/contracts/backups";

export type BackupToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

export type BackupsDashboardData = {
  backups: BackupSummary[];
};
