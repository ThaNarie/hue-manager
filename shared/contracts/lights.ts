import { z } from "zod";

export const LightTypeSchema = z.enum(["bulb", "strip", "lamp", "plug"]);

export const LightGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const LightSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: LightTypeSchema,
  room: LightGroupSchema,
  zone: LightGroupSchema.nullable(),
  isOn: z.boolean(),
  brightness: z.number().int().min(0).max(100),
  lastUpdatedAt: z.string().datetime(),
});

export const LightsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  lights: z.array(LightSchema),
});

export type LightType = z.infer<typeof LightTypeSchema>;
export type LightGroup = z.infer<typeof LightGroupSchema>;
export type Light = z.infer<typeof LightSchema>;
export type LightsResponse = z.infer<typeof LightsResponseSchema>;

export function parseLightsResponse(data: unknown): LightsResponse {
  return LightsResponseSchema.parse(data);
}
