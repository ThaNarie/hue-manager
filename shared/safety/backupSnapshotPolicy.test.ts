import { describe, expect, test } from "vite-plus/test";
import { shouldSnapshotLightMutation } from "./backupSnapshotPolicy";

describe("backup snapshot policy", () => {
  test("does not snapshot low-risk light mutations", () => {
    expect(shouldSnapshotLightMutation({ brightness: 80 })).toBe(false);
  });

  test("snapshots destructive light mutations", () => {
    expect(shouldSnapshotLightMutation({ isOn: false })).toBe(true);
    expect(shouldSnapshotLightMutation({ brightness: 0 })).toBe(true);
  });

  test("snapshots dangerous light mutations", () => {
    expect(shouldSnapshotLightMutation({ isOn: true, brightness: 0 })).toBe(true);
  });
});
