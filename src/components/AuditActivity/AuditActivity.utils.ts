import type { AuditEvent } from "../../../shared/contracts/audit";

export function formatAuditTimestamp(dateIsoString: string): string {
  return new Date(dateIsoString).toLocaleString();
}

export function formatAuditDetails(event: AuditEvent): string {
  if (event.details) {
    return event.details;
  }

  return event.outcome === "success" ? "Completed successfully." : "Failed.";
}
