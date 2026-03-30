import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { loadRalphConfig } from "./config.js";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function writeConfig(contents: Record<string, unknown>): string {
  const tempDir = mkdtempSync(join(tmpdir(), "ralph-config-"));
  tempPaths.push(tempDir);
  const configPath = resolve(tempDir, "ralph.config.json");
  writeFileSync(configPath, JSON.stringify(contents), "utf8");
  return configPath;
}

describe("loadRalphConfig cleanupRetentionDays", () => {
  test("defaults cleanupRetentionDays to 14", () => {
    const configPath = writeConfig({ repo: "thanarie/hue-manager" });
    const config = loadRalphConfig(configPath);
    expect(config.cleanupRetentionDays).toBe(14);
  });

  test("loads explicit cleanupRetentionDays and validates positivity", () => {
    const validConfigPath = writeConfig({
      repo: "thanarie/hue-manager",
      cleanupRetentionDays: 30,
    });
    expect(loadRalphConfig(validConfigPath).cleanupRetentionDays).toBe(30);

    const invalidConfigPath = writeConfig({
      repo: "thanarie/hue-manager",
      cleanupRetentionDays: 0,
    });
    expect(() => loadRalphConfig(invalidConfigPath)).toThrow('Invalid "cleanupRetentionDays"');
  });
});
