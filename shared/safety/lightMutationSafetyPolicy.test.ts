import { describe, expect, test } from "vite-plus/test";
import {
  DANGEROUS_LIGHT_MUTATION_TOKEN,
  classifyLightMutationRisk,
  getLightMutationSafetyAction,
  isLightMutationSafetyApprovalValid,
} from "./lightMutationSafetyPolicy";

describe("light mutation safety policy", () => {
  test("classifies non-destructive updates as low-risk immediate actions", () => {
    const patch = { brightness: 35 };
    expect(classifyLightMutationRisk(patch)).toBe("low-risk");
    expect(getLightMutationSafetyAction(patch)).toBe("immediate");
    expect(isLightMutationSafetyApprovalValid(patch, null)).toBe(true);
  });

  test("classifies power-off updates as destructive confirm actions", () => {
    const patch = { isOn: false };
    expect(classifyLightMutationRisk(patch)).toBe("destructive");
    expect(getLightMutationSafetyAction(patch)).toBe("confirm");
    expect(isLightMutationSafetyApprovalValid(patch, null)).toBe(false);
    expect(isLightMutationSafetyApprovalValid(patch, { action: "confirm" })).toBe(true);
  });

  test("classifies conflicting intents as dangerous explicit actions", () => {
    const patch = { isOn: true, brightness: 0 };
    expect(classifyLightMutationRisk(patch)).toBe("dangerous");
    expect(getLightMutationSafetyAction(patch)).toBe("explicit");
    expect(isLightMutationSafetyApprovalValid(patch, { action: "confirm" })).toBe(false);
    expect(
      isLightMutationSafetyApprovalValid(patch, {
        action: "explicit",
        token: DANGEROUS_LIGHT_MUTATION_TOKEN,
      }),
    ).toBe(true);
  });
});
