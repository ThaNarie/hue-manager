import { describe, expect, test } from "vite-plus/test";
import {
  DANGEROUS_AUTOMATION_MUTATION_TOKEN,
  getAutomationMutationSafetyAction,
  isAutomationMutationSafetyApprovalValid,
} from "../../shared/safety/automationMutationSafetyPolicy";

describe("automation safety policy", () => {
  test("requires confirm for destructive disable", () => {
    const action = getAutomationMutationSafetyAction({ isEnabled: false });
    expect(action).toBe("confirm");
    expect(
      isAutomationMutationSafetyApprovalValid({ isEnabled: false }, { action: "confirm" }),
    ).toBe(true);
  });

  test("requires explicit token for dangerous delete action", () => {
    const mutation = {
      isEnabled: true,
      actions: [{ address: "/groups/0/action", method: "DELETE" as const, body: {} }],
    };
    expect(getAutomationMutationSafetyAction(mutation)).toBe("explicit");
    expect(
      isAutomationMutationSafetyApprovalValid(mutation, {
        action: "explicit",
        token: DANGEROUS_AUTOMATION_MUTATION_TOKEN,
      }),
    ).toBe(true);
  });
});
