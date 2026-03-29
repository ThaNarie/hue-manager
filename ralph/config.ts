import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RalphConfig, RalphLabelConfig } from "./types.js";

const DEFAULT_LOOP_INTERVAL_MS = 60_000;

const DEFAULT_REQUIRED_LABELS: RalphLabelConfig[] = [
  {
    name: "ai:ready",
    color: "1D76DB",
    description: "Eligible for Ralph pickup",
  },
  {
    name: "ai:claimed",
    color: "FBCA04",
    description: "Claimed by Ralph before execution starts",
  },
  {
    name: "ai:in-progress",
    color: "5319E7",
    description: "Worker currently running",
  },
  {
    name: "ai:review",
    color: "0E8A16",
    description: "PR opened and awaiting review",
  },
  {
    name: "ai:blocked",
    color: "B60205",
    description: "Blocked by dependencies or manual hold",
  },
  {
    name: "ai:failed",
    color: "D93F0B",
    description: "Run failed; needs triage",
  },
];

export function loadRalphConfig(
  configPath = resolve(process.cwd(), "ralph.config.json"),
): RalphConfig {
  let rawConfig: string;

  try {
    rawConfig = readFileSync(configPath, "utf8");
  } catch (error) {
    throw new Error(
      `Cannot read config at ${configPath}. Create ralph.config.json at repo root. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${configPath}. Fix JSON formatting. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(`Invalid config in ${configPath}. Expected a JSON object.`);
  }

  const repo = parsed.repo;
  if (typeof repo !== "string" || !repo.includes("/")) {
    throw new Error(
      `Invalid "repo" in ${configPath}. Use "owner/repo" format (example: "thanarie/hue-manager").`,
    );
  }

  const loopIntervalMs = validateLoopInterval(parsed.loopIntervalMs, configPath);
  const requiredLabels = validateLabels(parsed.requiredLabels, configPath);

  return { repo, loopIntervalMs, requiredLabels };
}

function validateLoopInterval(value: unknown, configPath: string): number {
  if (value === undefined) {
    return DEFAULT_LOOP_INTERVAL_MS;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid "loopIntervalMs" in ${configPath}. Use a positive integer number of milliseconds.`,
    );
  }

  return value;
}

function validateLabels(value: unknown, configPath: string): RalphLabelConfig[] {
  if (value === undefined) {
    return DEFAULT_REQUIRED_LABELS;
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Invalid "requiredLabels" in ${configPath}. Use a non-empty array of label objects.`,
    );
  }

  const labels = value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(
        `Invalid label at requiredLabels[${index}] in ${configPath}. Expected an object.`,
      );
    }

    const { name, color, description } = entry;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error(
        `Invalid requiredLabels[${index}].name in ${configPath}. Use a non-empty string.`,
      );
    }
    if (typeof color !== "string" || !/^[A-Fa-f0-9]{6}$/.test(color)) {
      throw new Error(
        `Invalid requiredLabels[${index}].color in ${configPath}. Use a 6-char hex color without '#'.`,
      );
    }
    if (typeof description !== "string") {
      throw new Error(
        `Invalid requiredLabels[${index}].description in ${configPath}. Use a string.`,
      );
    }

    return { name, color, description };
  });

  return labels;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
