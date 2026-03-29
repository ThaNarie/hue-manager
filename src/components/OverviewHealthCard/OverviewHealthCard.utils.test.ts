import { describe, expect, test } from "vite-plus/test";
import { getHealthPollMs, statusToBadgeVariant } from "./OverviewHealthCard.utils";

describe("OverviewHealthCard.utils", () => {
  test("maps health statuses to badge variants", () => {
    expect(statusToBadgeVariant("ok")).toBe("ok");
    expect(statusToBadgeVariant("degraded")).toBe("degraded");
    expect(statusToBadgeVariant("down")).toBe("down");
  });

  test("uses default polling interval when env value is missing", () => {
    expect(getHealthPollMs(undefined)).toBe(10_000);
  });

  test("uses default polling interval when env value is invalid", () => {
    expect(getHealthPollMs("abc")).toBe(10_000);
  });

  test("enforces a lower-bound polling interval", () => {
    expect(getHealthPollMs("500")).toBe(1_000);
  });

  test("accepts valid polling intervals from env value", () => {
    expect(getHealthPollMs("15000")).toBe(15_000);
  });
});
