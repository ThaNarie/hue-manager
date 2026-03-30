import { z } from "zod";

export const GroupKindSchema = z.enum(["room", "zone"]);

export const GroupMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const GroupSchema = z.object({
  id: z.string().min(1),
  hueGroupId: z.string().min(1),
  kind: GroupKindSchema,
  name: z.string().min(1),
  memberLightIds: z.array(z.string().min(1)),
  members: z.array(GroupMemberSchema),
});

export const GroupsResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  groups: z.array(GroupSchema),
  availableLights: z.array(GroupMemberSchema),
});

export const GroupMutationRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    memberLightIds: z.array(z.string().min(1)).optional(),
  })
  .refine((value) => value.name !== undefined || value.memberLightIds !== undefined, {
    message: "At least one mutable group field is required",
  });

export const GroupMutationResponseSchema = z.object({
  group: GroupSchema,
});

export type GroupKind = z.infer<typeof GroupKindSchema>;
export type GroupMember = z.infer<typeof GroupMemberSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type GroupsResponse = z.infer<typeof GroupsResponseSchema>;
export type GroupMutationRequest = z.infer<typeof GroupMutationRequestSchema>;
export type GroupMutationResponse = z.infer<typeof GroupMutationResponseSchema>;

export function parseGroupsResponse(data: unknown): GroupsResponse {
  return GroupsResponseSchema.parse(data);
}

export function parseGroupMutationRequest(data: unknown): GroupMutationRequest {
  return GroupMutationRequestSchema.parse(data);
}

export function parseGroupMutationResponse(data: unknown): GroupMutationResponse {
  return GroupMutationResponseSchema.parse(data);
}
