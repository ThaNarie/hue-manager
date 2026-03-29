import type { RalphSecrets } from "./types.js";

const REQUIRED_SECRET_KEYS = ["GITHUB_TOKEN", "CURSOR_API_KEY"] as const;

export type MissingSecret = (typeof REQUIRED_SECRET_KEYS)[number];

export function getMissingSecrets(): MissingSecret[] {
  return REQUIRED_SECRET_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function loadSecrets(): RalphSecrets {
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
