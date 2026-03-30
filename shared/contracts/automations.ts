import { z } from "zod";

export const AutomationStatusSchema = z.enum(["enabled", "disabled"]);

export const AutomationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: AutomationStatusSchema,
  isEnabled: z.boolean(),
  owner: z.string().min(1).nullable(),
  lastTriggeredAt: z.string().datetime().nullable(),
});

export const AutomationsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  automations: z.array(AutomationSchema),
});

export const AutomationMutationRequestSchema = z.object({
  isEnabled: z.boolean(),
});

export const AutomationMutationResponseSchema = z.object({
  automation: AutomationSchema,
});

export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;
export type Automation = z.infer<typeof AutomationSchema>;
export type AutomationsResponse = z.infer<typeof AutomationsResponseSchema>;
export type AutomationMutationRequest = z.infer<typeof AutomationMutationRequestSchema>;
export type AutomationMutationResponse = z.infer<typeof AutomationMutationResponseSchema>;

export function parseAutomationsResponse(data: unknown): AutomationsResponse {
  return AutomationsResponseSchema.parse(data);
}

export function parseAutomationMutationRequest(data: unknown): AutomationMutationRequest {
  return AutomationMutationRequestSchema.parse(data);
}

export function parseAutomationMutationResponse(data: unknown): AutomationMutationResponse {
  return AutomationMutationResponseSchema.parse(data);
}
