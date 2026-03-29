import { z } from "zod";

export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);

export const BridgeHealthSchema = z.object({
  status: HealthStatusSchema,
  connected: z.boolean(),
  lastSeenAt: z.string().datetime(),
});

export const SyncHealthSchema = z.object({
  status: HealthStatusSchema,
  lastRunAt: z.string().datetime(),
  pendingJobs: z.number().int().nonnegative(),
});

export const OverviewHealthResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  bridge: BridgeHealthSchema,
  sync: SyncHealthSchema,
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type BridgeHealth = z.infer<typeof BridgeHealthSchema>;
export type SyncHealth = z.infer<typeof SyncHealthSchema>;
export type OverviewHealthResponse = z.infer<typeof OverviewHealthResponseSchema>;

export function parseOverviewHealthResponse(data: unknown): OverviewHealthResponse {
  return OverviewHealthResponseSchema.parse(data);
}
