import type { HealthStatus } from "../../../shared/contracts/health";

type StatusVariant = "ok" | "degraded" | "down";

export function statusToBadgeVariant(status: HealthStatus): StatusVariant {
  if (status === "degraded") {
    return "degraded";
  }

  if (status === "down") {
    return "down";
  }

  return "ok";
}

export function formatDate(dateIsoString: string): string {
  return new Date(dateIsoString).toLocaleString();
}
