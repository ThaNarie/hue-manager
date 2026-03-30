import { z } from "zod";

export const AutomationStatusSchema = z.enum(["enabled", "disabled"]);
export const AutomationActionMethodSchema = z.enum(["PUT", "POST", "DELETE"]);

export const AutomationConditionSchema = z.object({
  address: z.string().trim().min(1),
  operator: z.string().trim().min(1),
  value: z.string().trim().min(1),
});

export const AutomationActionSchema = z.object({
  address: z.string().trim().min(1),
  method: AutomationActionMethodSchema,
  body: z.record(z.string(), z.unknown()),
});

export const AutomationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: AutomationStatusSchema,
  isEnabled: z.boolean(),
  owner: z.string().min(1).nullable(),
  lastTriggeredAt: z.string().datetime().nullable(),
  conditions: z.array(AutomationConditionSchema),
  actions: z.array(AutomationActionSchema),
});

export const AutomationsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  automations: z.array(AutomationSchema),
});

export const AutomationCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(32),
  isEnabled: z.boolean(),
  conditions: z.array(AutomationConditionSchema).min(1),
  actions: z.array(AutomationActionSchema).min(1),
});

export const AutomationMutationRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(32).optional(),
    isEnabled: z.boolean().optional(),
    conditions: z.array(AutomationConditionSchema).min(1).optional(),
    actions: z.array(AutomationActionSchema).min(1).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.isEnabled !== undefined ||
      value.conditions !== undefined ||
      value.actions !== undefined,
    {
      message: "At least one mutable automation field is required",
    },
  );

export const AutomationMutationResponseSchema = z.object({
  automation: AutomationSchema,
});

export type AutomationStatus = z.infer<typeof AutomationStatusSchema>;
export type AutomationActionMethod = z.infer<typeof AutomationActionMethodSchema>;
export type AutomationCondition = z.infer<typeof AutomationConditionSchema>;
export type AutomationAction = z.infer<typeof AutomationActionSchema>;
export type Automation = z.infer<typeof AutomationSchema>;
export type AutomationsResponse = z.infer<typeof AutomationsResponseSchema>;
export type AutomationCreateRequest = z.infer<typeof AutomationCreateRequestSchema>;
export type AutomationMutationRequest = z.infer<typeof AutomationMutationRequestSchema>;
export type AutomationMutationResponse = z.infer<typeof AutomationMutationResponseSchema>;

export function parseAutomationsResponse(data: unknown): AutomationsResponse {
  return AutomationsResponseSchema.parse(data);
}

export function parseAutomationCreateRequest(data: unknown): AutomationCreateRequest {
  return AutomationCreateRequestSchema.parse(data);
}

export function parseAutomationMutationRequest(data: unknown): AutomationMutationRequest {
  return AutomationMutationRequestSchema.parse(data);
}

export function parseAutomationMutationResponse(data: unknown): AutomationMutationResponse {
  return AutomationMutationResponseSchema.parse(data);
}
