import { z } from "zod";

export const SceneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  groupId: z.string().min(1).nullable(),
  isLocked: z.boolean(),
  lastUpdatedAt: z.string().datetime(),
});

export const ScenesResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  scenes: z.array(SceneSchema),
});

export const SceneCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(32),
  groupId: z.string().min(1).optional(),
});

export const SceneUpdateRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(32).optional(),
    groupId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.name !== undefined || value.groupId !== undefined, {
    message: "At least one mutable scene field is required",
  });

export const SceneMutationResponseSchema = z.object({
  scene: SceneSchema,
});

export const SceneActivationResponseSchema = z.object({
  activatedSceneId: z.string().min(1),
});

export const SceneDeleteResponseSchema = z.object({
  deletedSceneId: z.string().min(1),
});

export type Scene = z.infer<typeof SceneSchema>;
export type ScenesResponse = z.infer<typeof ScenesResponseSchema>;
export type SceneCreateRequest = z.infer<typeof SceneCreateRequestSchema>;
export type SceneUpdateRequest = z.infer<typeof SceneUpdateRequestSchema>;
export type SceneMutationResponse = z.infer<typeof SceneMutationResponseSchema>;
export type SceneActivationResponse = z.infer<typeof SceneActivationResponseSchema>;
export type SceneDeleteResponse = z.infer<typeof SceneDeleteResponseSchema>;

export function parseScenesResponse(data: unknown): ScenesResponse {
  return ScenesResponseSchema.parse(data);
}

export function parseSceneCreateRequest(data: unknown): SceneCreateRequest {
  return SceneCreateRequestSchema.parse(data);
}

export function parseSceneUpdateRequest(data: unknown): SceneUpdateRequest {
  return SceneUpdateRequestSchema.parse(data);
}

export function parseSceneMutationResponse(data: unknown): SceneMutationResponse {
  return SceneMutationResponseSchema.parse(data);
}

export function parseSceneActivationResponse(data: unknown): SceneActivationResponse {
  return SceneActivationResponseSchema.parse(data);
}

export function parseSceneDeleteResponse(data: unknown): SceneDeleteResponse {
  return SceneDeleteResponseSchema.parse(data);
}
