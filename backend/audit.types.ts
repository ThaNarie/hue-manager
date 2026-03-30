import type { AuditEvent, AuditOutcome } from "../shared/contracts/audit.ts";

export type AuditStore = {
  retentionDays: number;
  events: AuditEvent[];
};

export type RecordAuditEventInput = {
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: AuditOutcome;
  details: string | null;
  metadata: Record<string, unknown>;
};
