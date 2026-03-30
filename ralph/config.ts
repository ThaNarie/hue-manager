import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { RalphConfig, RalphLabelConfig } from "./types.js";

const DEFAULT_LOOP_INTERVAL_MS = 60_000;
const DEFAULT_MAX_WORKERS = 1;
const DEFAULT_IDLE_BACKOFF_MAX_MS = 5 * 60_000;
const DEFAULT_IDLE_BACKOFF_JITTER_MS = 250;
const DEFAULT_BASE_BRANCH = "main";
const DEFAULT_WORKER_IMAGE = "hue-manager-ralph-worker:latest";
const DEFAULT_WORKER_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_CLEANUP_RETENTION_DAYS = 14;

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
  const maxWorkers = validateMaxWorkers(parsed.maxWorkers, configPath);
  const idleBackoffMaxMs = validateIdleBackoffMax(
    parsed.idleBackoffMaxMs,
    loopIntervalMs,
    configPath,
  );
  const idleBackoffJitterMs = validateIdleBackoffJitter(parsed.idleBackoffJitterMs, configPath);
  const baseBranch = validateBaseBranch(parsed.baseBranch, configPath);
  const workerImage = validateWorkerImage(parsed.workerImage, configPath);
  const workerTimeoutMs = validateWorkerTimeout(parsed.workerTimeoutMs, configPath);
  const cleanupRetentionDays = validateCleanupRetentionDays(
    parsed.cleanupRetentionDays,
    configPath,
  );
  const requiredLabels = validateLabels(parsed.requiredLabels, configPath);

  return {
    repo,
    loopIntervalMs,
    maxWorkers,
    idleBackoffMaxMs,
    idleBackoffJitterMs,
    baseBranch,
    workerImage,
    workerTimeoutMs,
    cleanupRetentionDays,
    requiredLabels,
  };
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

function validateMaxWorkers(value: unknown, configPath: string): number {
  if (value === undefined) {
    return DEFAULT_MAX_WORKERS;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid "maxWorkers" in ${configPath}. Use a positive integer.`);
  }

  return value;
}

function validateIdleBackoffMax(
  value: unknown,
  loopIntervalMs: number,
  configPath: string,
): number {
  if (value === undefined) {
    return Math.max(loopIntervalMs, DEFAULT_IDLE_BACKOFF_MAX_MS);
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < loopIntervalMs) {
    throw new Error(
      `Invalid "idleBackoffMaxMs" in ${configPath}. Use an integer >= loopIntervalMs.`,
    );
  }

  return value;
}

function validateIdleBackoffJitter(value: unknown, configPath: string): number {
  if (value === undefined) {
    return DEFAULT_IDLE_BACKOFF_JITTER_MS;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid "idleBackoffJitterMs" in ${configPath}. Use a non-negative integer.`);
  }

  return value;
}

function validateBaseBranch(value: unknown, configPath: string): string {
  if (value === undefined) {
    return DEFAULT_BASE_BRANCH;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid "baseBranch" in ${configPath}. Use a non-empty branch name string.`);
  }

  return value.trim();
}

function validateWorkerImage(value: unknown, configPath: string): string {
  if (value === undefined) {
    return DEFAULT_WORKER_IMAGE;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid "workerImage" in ${configPath}. Use a non-empty image name string.`);
  }

  return value.trim();
}

function validateWorkerTimeout(value: unknown, configPath: string): number {
  if (value === undefined) {
    return DEFAULT_WORKER_TIMEOUT_MS;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid "workerTimeoutMs" in ${configPath}. Use a positive integer number of milliseconds.`,
    );
  }

  return value;
}

function validateCleanupRetentionDays(value: unknown, configPath: string): number {
  if (value === undefined) {
    return DEFAULT_CLEANUP_RETENTION_DAYS;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Invalid "cleanupRetentionDays" in ${configPath}. Use a positive integer number of days.`,
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
