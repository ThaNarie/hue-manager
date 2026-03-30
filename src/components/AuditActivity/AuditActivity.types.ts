import type { AuditEvent } from "../../../shared/contracts/audit";

export type AuditActivityData = {
  retentionDays: number;
  events: AuditEvent[];
};
