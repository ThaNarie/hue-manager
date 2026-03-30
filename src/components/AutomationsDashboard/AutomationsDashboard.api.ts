import {
  parseAutomationCreateRequest,
  parseAutomationMutationRequest,
  parseAutomationMutationResponse,
  parseAutomationsResponse,
} from "../../../shared/contracts/automations";
import type {
  AutomationCreateRequest,
  AutomationMutationRequest,
} from "../../../shared/contracts/automations";
import {
  AUTOMATION_SAFETY_APPROVAL_ACTION_HEADER,
  AUTOMATION_SAFETY_APPROVAL_TOKEN_HEADER,
  type AutomationMutationSafetyApproval,
} from "../../../shared/safety/automationMutationSafetyPolicy";

function getResponseMessage(payload: unknown, fallbackMessage: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return fallbackMessage;
}

function toSafetyHeaders(
  approval: AutomationMutationSafetyApproval | null,
): Record<string, string> {
  if (!approval) {
    return {};
  }
  return {
    [AUTOMATION_SAFETY_APPROVAL_ACTION_HEADER]: approval.action,
    ...(approval.token ? { [AUTOMATION_SAFETY_APPROVAL_TOKEN_HEADER]: approval.token } : {}),
  };
}

export async function requestAutomations() {
  const response = await fetch("/api/automations");
  if (!response.ok) {
    throw new Error(`Automations endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseAutomationsResponse(payload);
}

export async function requestAutomationCreate(
  input: AutomationCreateRequest,
  approval: AutomationMutationSafetyApproval | null,
) {
  const response = await fetch("/api/automations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...toSafetyHeaders(approval),
    },
    body: JSON.stringify(parseAutomationCreateRequest(input)),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Automation create failed (${response.status})`));
  }

  return parseAutomationMutationResponse(payload);
}

export async function requestAutomationMutation(
  automationId: string,
  patch: AutomationMutationRequest,
  approval: AutomationMutationSafetyApproval | null,
) {
  const response = await fetch(`/api/automations/${encodeURIComponent(automationId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...toSafetyHeaders(approval),
    },
    body: JSON.stringify(parseAutomationMutationRequest(patch)),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Automation update failed (${response.status})`));
  }

  return parseAutomationMutationResponse(payload);
}
