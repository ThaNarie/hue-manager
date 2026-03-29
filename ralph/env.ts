import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RalphSecrets } from "./types.js";

const REQUIRED_SECRET_KEYS = ["GITHUB_TOKEN", "CURSOR_API_KEY"] as const;

export type MissingSecret = (typeof REQUIRED_SECRET_KEYS)[number];

export function getMissingSecrets(): MissingSecret[] {
  loadDotEnvIfPresent();

  return REQUIRED_SECRET_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function loadSecrets(): RalphSecrets {
  loadDotEnvIfPresent();

  const missing = getMissingSecrets();
  if (missing.length > 0) {
    const exports = missing.map((key) => `export ${key}=...`).join("\n");
    throw new Error(
      `Missing required env vars: ${missing.join(", ")}\nAdd them to your shell or .env file, for example:\n${exports}`,
    );
  }

  return {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN as string,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY as string,
  };
}

function loadDotEnvIfPresent(dotEnvPath = resolve(process.cwd(), ".env")): void {
  if (!existsSync(dotEnvPath)) {
    return;
  }

  const content = readFileSync(dotEnvPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (key.length === 0 || process.env[key]) {
      continue;
    }

    process.env[key] = stripWrappingQuotes(value);
  }
}

function stripWrappingQuotes(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  return value;
}
