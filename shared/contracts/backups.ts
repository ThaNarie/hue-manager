import { z } from "zod";

export const BackupReasonSchema = z.enum(["manual", "automatic"]);

export const BackupSummarySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  reason: BackupReasonSchema,
  trigger: z.string().min(1),
});

export const BackupsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  backups: z.array(BackupSummarySchema),
});

export const BackupCreateResponseSchema = z.object({
  backup: BackupSummarySchema,
});

export const BackupRestoreResponseSchema = z.object({
  restoredBackupId: z.string().min(1),
});

export type BackupReason = z.infer<typeof BackupReasonSchema>;
export type BackupSummary = z.infer<typeof BackupSummarySchema>;
export type BackupsResponse = z.infer<typeof BackupsResponseSchema>;
export type BackupCreateResponse = z.infer<typeof BackupCreateResponseSchema>;
export type BackupRestoreResponse = z.infer<typeof BackupRestoreResponseSchema>;

export function parseBackupsResponse(data: unknown): BackupsResponse {
  return BackupsResponseSchema.parse(data);
}

export function parseBackupCreateResponse(data: unknown): BackupCreateResponse {
  return BackupCreateResponseSchema.parse(data);
}

export function parseBackupRestoreResponse(data: unknown): BackupRestoreResponse {
  return BackupRestoreResponseSchema.parse(data);
}
