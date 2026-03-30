import type { LightMutationRequest } from "../contracts/lights";
import { classifyLightMutationRisk } from "./lightMutationSafetyPolicy";

export type BackupSnapshotTrigger =
  | "lights:destructive-mutation"
  | "groups:mutation"
  | "automations:mutation"
  | "scenes:create"
  | "scenes:update"
  | "scenes:delete";

export function shouldSnapshotLightMutation(patch: LightMutationRequest): boolean {
  const riskLevel = classifyLightMutationRisk(patch);
  return riskLevel === "destructive" || riskLevel === "dangerous";
}
