import type { HealthStatus } from "../../../shared/contracts/health";

type StatusVariant = "ok" | "degraded" | "down";

const DEFAULT_HEALTH_POLL_MS = 10_000;
const MIN_HEALTH_POLL_MS = 1_000;

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

export function getHealthPollMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_HEALTH_POLL_MS;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_HEALTH_POLL_MS;
  }

  return Math.max(parsed, MIN_HEALTH_POLL_MS);
}
