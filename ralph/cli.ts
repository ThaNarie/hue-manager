import { spawnSync } from "node:child_process";
import process from "node:process";

import { loadRalphConfig } from "./config.js";
import { runCleanup } from "./cleanup.js";
import { getMissingSecrets, loadSecrets } from "./env.js";
import { runGh } from "./github.js";
import { pollIssuePlan } from "./issue-selection.js";
import { pollCommentRerunTriggers } from "./comment-reruns.js";
import { runCommentTriggeredIssue, runEligibleIssue } from "./issue-runner.js";
import { runParallelScheduler } from "./parallel-scheduler.js";
import type { RalphConfig } from "./types.js";

type ToolCheck = {
  name: string;
  ok: boolean;
  details: string;
};

async function main(): Promise<void> {
  const command = process.argv[2];
  const options = process.argv.slice(3);
  const dryRun = options.includes("--dry-run");
  const config = loadRalphConfig();

  switch (command) {
    case "doctor":
      process.exitCode = await runDoctor(config);
      return;
    case "once":
      await runOnce(config, { dryRun });
      return;
    case "start":
      await runStart(config, { dryRun });
      return;
    case "cleanup":
      runCleanupCommand(config, { dryRun });
      return;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log("Ralph CLI");
  console.log("Usage: node dist/ralph/cli.js <doctor|once|start|cleanup> [--dry-run]");
}

async function runOnce(config: RalphConfig, options: { dryRun: boolean }): Promise<void> {
  loadSecrets();

  const plan = pollIssuePlan(config.repo);
  const rerunTriggers = pollCommentRerunTriggers(config.repo);
  const mode = options.dryRun ? "dry-run" : "live";
  console.log(`[Ralph] once (${mode}): polled ${config.repo}`);
  printPlan(plan);
  const nextTrigger = rerunTriggers[0];
  if (nextTrigger) {
    runCommentTriggeredIssue(config, nextTrigger, options);
  } else {
    const nextIssue = plan.eligible[0];
    if (nextIssue) {
      runEligibleIssue(config, nextIssue, options);
    }
  }

  if (options.dryRun) {
    console.log(
      "[Ralph] dry-run: no labels, assignments, branches, containers, or PRs were modified.",
    );
  }
}

async function runStart(config: RalphConfig, options: { dryRun: boolean }): Promise<void> {
  loadSecrets();

  console.log(`[Ralph] start: running every ${config.loopIntervalMs}ms for ${config.repo}`);
  console.log("[Ralph] Press Ctrl+C to stop.");

  let stopping = false;
  process.on("SIGINT", () => {
    stopping = true;
  });

  await runParallelScheduler(
    config,
    { dryRun: options.dryRun, shouldStop: () => stopping },
    {
      pollIssuePlan,
      pollCommentRerunTriggers,
      runEligibleIssue,
      runCommentTriggeredIssue,
    },
  );

  console.log("[Ralph] stopped.");
}

function runCleanupCommand(config: RalphConfig, options: { dryRun: boolean }): void {
  const report = runCleanup({
    retentionDays: config.cleanupRetentionDays,
    dryRun: options.dryRun,
  });

  console.log(
    `[Ralph cleanup] retention=${report.retentionDays}d cutoff=${report.cutoffIso} mode=${
      report.dryRun ? "dry-run" : "live"
    }`,
  );

  for (const action of report.actions) {
    console.log(
      `[Ralph cleanup] ${action.action.toUpperCase()} ${action.kind} ${action.runId} (${action.reason})`,
    );
  }

  console.log(
    `[Ralph cleanup] artifacts scanned=${report.artifacts.scanned} removed=${report.artifacts.removed} kept=${report.artifacts.kept}`,
  );
  console.log(
    `[Ralph cleanup] worktrees scanned=${report.worktrees.scanned} removed=${report.worktrees.removed} kept=${report.worktrees.kept} keptForDiagnostics=${report.worktrees.keptForDiagnostics}`,
  );
}

function printPlan(plan: ReturnType<typeof pollIssuePlan>): void {
  if (plan.eligible.length === 0) {
    console.log("[Ralph] eligible issues: none");
  } else {
    const ordered = plan.eligible.map((issue) => `#${issue.number}`).join(", ");
    console.log(`[Ralph] eligible issues (ordered): ${ordered}`);
    const next = plan.eligible[0];
    console.log(`[Ralph] next issue: #${next.number} ${next.title}`);
  }

  if (plan.ineligible.length > 0) {
    console.log("[Ralph] ineligible issues:");
    for (const issue of plan.ineligible) {
      console.log(`- #${issue.number} ${issue.title} (${issue.reason})`);
    }
  }
}

async function runDoctor(config: RalphConfig): Promise<number> {
  const checks: ToolCheck[] = [
    checkTool("node", ["--version"], "Install Node.js 22+ and re-run doctor."),
    checkTool("git", ["--version"], "Install Git and ensure it is on PATH."),
    checkTool("docker", ["--version"], "Install Docker and ensure it is on PATH."),
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

void main();
