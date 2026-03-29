import { spawnSync } from "node:child_process";
import process from "node:process";

import { loadRalphConfig } from "./config.js";
import { getMissingSecrets, loadSecrets } from "./env.js";
import type { RalphConfig } from "./types.js";

type ToolCheck = {
  name: string;
  ok: boolean;
  details: string;
};

async function main(): Promise<void> {
  const command = process.argv[2];
  const config = loadRalphConfig();

  switch (command) {
    case "doctor":
      process.exitCode = await runDoctor(config);
      return;
    case "once":
      await runOnce(config);
      return;
    case "start":
      await runStart(config);
      return;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log("Ralph CLI");
  console.log("Usage: node dist/ralph/cli.js <doctor|once|start>");
}

async function runOnce(config: RalphConfig): Promise<void> {
  loadSecrets();
  console.log(`[Ralph] once: bootstrap checks passed for ${config.repo}`);
  console.log("[Ralph] worker orchestration is intentionally not implemented in slice 1.");
}

async function runStart(config: RalphConfig): Promise<void> {
  loadSecrets();

  console.log(`[Ralph] start: running every ${config.loopIntervalMs}ms for ${config.repo}`);
  console.log("[Ralph] Press Ctrl+C to stop.");

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });

  while (!stopping) {
    const startedAt = new Date().toISOString();
    console.log(`[Ralph] tick ${startedAt}`);
    try {
      await runOnce(config);
    } catch (error) {
      console.error(
        `[Ralph] tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!stopping) {
      await sleep(config.loopIntervalMs);
    }
  }

  console.log("[Ralph] stopped.");
}

async function runDoctor(config: RalphConfig): Promise<number> {
  const checks: ToolCheck[] = [
    checkTool("node", ["--version"], "Install Node.js 22+ and re-run doctor."),
    checkTool("git", ["--version"], "Install Git and ensure it is on PATH."),
    checkTool(
      "gh",
      ["--version"],
      "Install GitHub CLI from https://cli.github.com/ and re-run doctor.",
    ),
  ];

  const failedToolChecks = checks.filter((check) => !check.ok);
  const missingSecrets = getMissingSecrets();
  const errors: string[] = [];

  console.log("[Ralph doctor] Tooling checks:");
  for (const check of checks) {
    const status = check.ok ? "OK" : "FAIL";
    console.log(`- ${status} ${check.name}: ${check.details}`);
    if (!check.ok) {
      errors.push(check.details);
    }
  }

  console.log("[Ralph doctor] Secret checks:");
  if (missingSecrets.length === 0) {
    console.log("- OK required env vars are present.");
  } else {
    const exports = missingSecrets.map((key) => `export ${key}=...`).join("\n");
    const errorMessage = `Missing env vars: ${missingSecrets.join(", ")}. Add them, for example:\n${exports}`;
    console.log(`- FAIL ${errorMessage}`);
    errors.push(errorMessage);
  }

  if (failedToolChecks.length === 0 && missingSecrets.length === 0) {
    try {
      const createdLabels = ensureRequiredLabels(config);
      if (createdLabels.length === 0) {
        console.log("[Ralph doctor] Labels: all required labels already exist.");
      } else {
        console.log(
          `[Ralph doctor] Labels: created ${createdLabels.length} label(s): ${createdLabels.join(", ")}`,
        );
      }
    } catch (error) {
      const message = `Failed to sync labels with gh CLI. Confirm gh auth and repo access. Details: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.log(`[Ralph doctor] Labels: FAIL ${message}`);
      errors.push(message);
    }
  } else {
    console.log("[Ralph doctor] Labels: skipped until tooling and env checks pass.");
  }

  if (errors.length > 0) {
    console.error("\n[Ralph doctor] Setup validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    return 1;
  }

  console.log("\n[Ralph doctor] Setup validation succeeded.");
  return 0;
}

function ensureRequiredLabels(config: RalphConfig): string[] {
  const listResult = runGh([
    "label",
    "list",
    "--repo",
    config.repo,
    "--limit",
    "200",
    "--json",
    "name",
  ]);

  const existingLabelsRaw = JSON.parse(listResult.stdout) as Array<{ name?: string }>;
  const existing = new Set(
    existingLabelsRaw.map((label) => label.name).filter((name): name is string => !!name),
  );

  const created: string[] = [];
  for (const label of config.requiredLabels) {
    if (existing.has(label.name)) {
      continue;
    }

    runGh([
      "label",
      "create",
      label.name,
      "--repo",
      config.repo,
      "--color",
      label.color,
      "--description",
      label.description,
    ]);
    created.push(label.name);
  }

  return created;
}

function runGh(args: string[]): { stdout: string } {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "unknown gh error");
  }

  return { stdout: result.stdout };
}

function checkTool(name: string, args: string[], guidance: string): ToolCheck {
  const result = spawnSync(name, args, { encoding: "utf8" });
  if (result.error) {
    return { name, ok: false, details: guidance };
  }
  if (result.status !== 0) {
    return {
      name,
      ok: false,
      details: `${guidance} (command exited with status ${result.status}).`,
    };
  }
  return {
    name,
    ok: true,
    details: (result.stdout || result.stderr).trim(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

void main();
