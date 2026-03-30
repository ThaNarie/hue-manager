import { describe, expect, test } from "vite-plus/test";
import {
  DANGEROUS_AUTOMATION_MUTATION_TOKEN,
  classifyAutomationMutationRisk,
  getAutomationMutationSafetyAction,
  isAutomationMutationSafetyApprovalValid,
} from "./automationMutationSafetyPolicy";

describe("automation mutation safety policy", () => {
  test("classifies low-risk updates as immediate actions", () => {
    const mutation = { name: "Morning routine" };
    expect(classifyAutomationMutationRisk(mutation)).toBe("low-risk");
    expect(getAutomationMutationSafetyAction(mutation)).toBe("immediate");
    expect(isAutomationMutationSafetyApprovalValid(mutation, null)).toBe(true);
  });

  test("classifies disable writes as destructive confirm actions", () => {
    const mutation = { isEnabled: false };
    expect(classifyAutomationMutationRisk(mutation)).toBe("destructive");
    expect(getAutomationMutationSafetyAction(mutation)).toBe("confirm");
    expect(isAutomationMutationSafetyApprovalValid(mutation, null)).toBe(false);
    expect(isAutomationMutationSafetyApprovalValid(mutation, { action: "confirm" })).toBe(true);
  });

  test("classifies dangerous writes as explicit token actions", () => {
    const mutation = {
      actions: [{ address: "/config", method: "PUT" as const, body: { whitelist: {} } }],
    };
    expect(classifyAutomationMutationRisk(mutation)).toBe("dangerous");
    expect(getAutomationMutationSafetyAction(mutation)).toBe("explicit");
    expect(
      isAutomationMutationSafetyApprovalValid(mutation, {
        action: "explicit",
        token: DANGEROUS_AUTOMATION_MUTATION_TOKEN,
      }),
    ).toBe(true);
  });
});
