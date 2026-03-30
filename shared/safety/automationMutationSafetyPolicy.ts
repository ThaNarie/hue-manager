import type {
  AutomationAction,
  AutomationCreateRequest,
  AutomationMutationRequest,
} from "../contracts/automations";

export type AutomationMutationRiskLevel = "low-risk" | "destructive" | "dangerous";
export type AutomationMutationSafetyAction = "immediate" | "confirm" | "explicit";
export type AutomationMutationSafetyApproval = {
  action: Exclude<AutomationMutationSafetyAction, "immediate">;
  token?: string;
};

export const AUTOMATION_SAFETY_APPROVAL_ACTION_HEADER = "x-hue-automation-safety-action";
export const AUTOMATION_SAFETY_APPROVAL_TOKEN_HEADER = "x-hue-automation-safety-token";
export const DANGEROUS_AUTOMATION_MUTATION_TOKEN = "ALLOW_DANGEROUS_AUTOMATION_MUTATION";

function hasDangerousAction(actions: AutomationAction[]): boolean {
  return actions.some(
    (action) =>
      action.method === "DELETE" ||
      action.address.toLowerCase().startsWith("/config") ||
      action.address.toLowerCase().startsWith("/schedules"),
  );
}

function hasDestructiveAction(actions: AutomationAction[]): boolean {
  return actions.some((action) => {
    if (!("on" in action.body)) {
      return false;
    }
    return action.body.on === false;
  });
}

type AutomationMutationInput = AutomationCreateRequest | AutomationMutationRequest;

export function classifyAutomationMutationRisk(
  mutation: AutomationMutationInput,
): AutomationMutationRiskLevel {
  if (mutation.actions && hasDangerousAction(mutation.actions)) {
    return "dangerous";
  }
  if ((mutation.isEnabled !== undefined && mutation.isEnabled === false) || mutation.actions) {
    if (mutation.actions && hasDestructiveAction(mutation.actions)) {
      return "destructive";
    }
    if (mutation.isEnabled === false) {
      return "destructive";
    }
  }
  return "low-risk";
}

export function getAutomationMutationSafetyAction(
  mutation: AutomationMutationInput,
): AutomationMutationSafetyAction {
  const riskLevel = classifyAutomationMutationRisk(mutation);
  if (riskLevel === "dangerous") {
    return "explicit";
  }
  if (riskLevel === "destructive") {
    return "confirm";
  }
  return "immediate";
}

export function isAutomationMutationSafetyApprovalValid(
  mutation: AutomationMutationInput,
  approval: AutomationMutationSafetyApproval | null,
): boolean {
  const requiredAction = getAutomationMutationSafetyAction(mutation);
  if (requiredAction === "immediate") {
    return true;
  }
  if (requiredAction === "confirm") {
    return approval?.action === "confirm";
  }
  return approval?.action === "explicit" && approval.token === DANGEROUS_AUTOMATION_MUTATION_TOKEN;
}
