import type { LightMutationRequest } from "../contracts/lights";

export type LightMutationRiskLevel = "low-risk" | "destructive" | "dangerous";
export type LightMutationSafetyAction = "immediate" | "confirm" | "explicit";
export type LightMutationSafetyApproval = {
  action: Exclude<LightMutationSafetyAction, "immediate">;
  token?: string;
};

export const SAFETY_APPROVAL_ACTION_HEADER = "x-hue-safety-action";
export const SAFETY_APPROVAL_TOKEN_HEADER = "x-hue-safety-token";
export const DANGEROUS_LIGHT_MUTATION_TOKEN = "ALLOW_DANGEROUS_LIGHT_MUTATION";

function hasConflictingPowerIntent(patch: LightMutationRequest): boolean {
  return (
    (patch.isOn === true && patch.brightness === 0) ||
    (patch.isOn === false && patch.brightness !== undefined && patch.brightness > 0)
  );
}

export function classifyLightMutationRisk(patch: LightMutationRequest): LightMutationRiskLevel {
  if (hasConflictingPowerIntent(patch)) {
    return "dangerous";
  }

  if (patch.isOn === false || patch.brightness === 0) {
    return "destructive";
  }

  return "low-risk";
}

export function getLightMutationSafetyAction(
  patch: LightMutationRequest,
): LightMutationSafetyAction {
  const riskLevel = classifyLightMutationRisk(patch);
  if (riskLevel === "dangerous") {
    return "explicit";
  }
  if (riskLevel === "destructive") {
    return "confirm";
  }
  return "immediate";
}

export function isLightMutationSafetyApprovalValid(
  patch: LightMutationRequest,
  approval: LightMutationSafetyApproval | null,
): boolean {
  const requiredAction = getLightMutationSafetyAction(patch);
  if (requiredAction === "immediate") {
    return true;
  }

  if (requiredAction === "confirm") {
    return approval?.action === "confirm";
  }

  return approval?.action === "explicit" && approval.token === DANGEROUS_LIGHT_MUTATION_TOKEN;
}
