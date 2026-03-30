import { z } from "zod";

export const AuditOutcomeSchema = z.enum(["success", "failure"]);

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  recordedAt: z.string().datetime(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1).nullable(),
  outcome: AuditOutcomeSchema,
  details: z.string().min(1).nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const AuditEventsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  retentionDays: z.number().int().min(1).max(3650),
  events: z.array(AuditEventSchema),
});

export const UpdateAuditRetentionRequestSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650),
});

export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditEventsResponse = z.infer<typeof AuditEventsResponseSchema>;
export type UpdateAuditRetentionRequest = z.infer<typeof UpdateAuditRetentionRequestSchema>;

export function parseAuditEventsResponse(data: unknown): AuditEventsResponse {
  return AuditEventsResponseSchema.parse(data);
}

export function parseUpdateAuditRetentionRequest(data: unknown): UpdateAuditRetentionRequest {
  return UpdateAuditRetentionRequestSchema.parse(data);
}
