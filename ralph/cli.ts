import { spawnSync } from "node:child_process";
import process from "node:process";

import { loadRalphConfig } from "./config.js";
import { getMissingSecrets, loadSecrets } from "./env.js";
import { runGh } from "./github.js";
import {
  claimIssue,
  getAuthenticatedActorLogin,
  transitionIssueLifecycleLabel,
} from "./issue-lifecycle.js";
import { pollIssuePlan } from "./issue-selection.js";
import { runStartLoop } from "./start-scheduler.js";
import { RalphStateStore } from "./state-store.js";
import type { RalphConfig } from "./types.js";
import { executeIssueWork } from "./worker-execution.js";

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
    default:
      printUsage();
      process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log("Ralph CLI");
  console.log("Usage: node dist/ralph/cli.js <doctor|once|start> [--dry-run]");
}

async function runOnce(config: RalphConfig, options: { dryRun: boolean }): Promise<void> {
  loadSecrets();

  const plan = pollIssuePlan(config.repo);
  const stateStore = new RalphStateStore();
  try {
    const mode = options.dryRun ? "dry-run" : "live";
    console.log(`[Ralph] once (${mode}): polled ${config.repo}`);
    printPlan(plan);
    const nextIssue = plan.eligible[0];

    if (nextIssue) {
      if (options.dryRun) {
        const previewRunId = stateStore.peekNextRunId(nextIssue.number);
        console.log(
          `[Ralph] dry-run: next run id for #${nextIssue.number} would be ${previewRunId}`,
        );
      } else {
        const actorLogin = getAuthenticatedActorLogin();
        const claimResult = claimIssue(config.repo, nextIssue.number, actorLogin);
        if (claimResult.status !== "claimed") {
          console.log(
            `[Ralph] skipped #${nextIssue.number}: could not claim issue (${claimResult.reason}).`,
          );
          return;
        }
        console.log(`[Ralph] claimed #${nextIssue.number} as ${actorLogin}`);

        const run = stateStore.createRunAttempt({
          issueNumber: nextIssue.number,
          triggerType: "poll",
        });
        console.log(`[Ralph] created run ${run.runId} for #${nextIssue.number}`);

        transitionIssueLifecycleLabel(config.repo, nextIssue.number, "ai:in-progress");
        console.log(`[Ralph] transitioned #${nextIssue.number} to ai:in-progress`);
        stateStore.updateRunStatus(run.runId, "running");
        console.log(`[Ralph] run ${run.runId} marked running`);

        try {
          executeIssueWork({
            repo: config.repo,
            issueNumber: nextIssue.number,
            runId: run.runId,
            baseBranch: config.baseBranch,
            workerImage: config.workerImage,
            workerTimeoutMs: config.workerTimeoutMs,
          });
          stateStore.updateRunStatus(run.runId, "succeeded");
          transitionIssueLifecycleLabel(config.repo, nextIssue.number, "ai:review");
          console.log(`[Ralph] transitioned #${nextIssue.number} to ai:review`);
        } catch (error) {
          const failureReason = error instanceof Error ? error.message : String(error);
          stateStore.updateRunStatus(run.runId, "failed", { failureReason });
          transitionIssueLifecycleLabel(config.repo, nextIssue.number, "ai:failed");
          console.log(`[Ralph] transitioned #${nextIssue.number} to ai:failed`);
          console.error(`[Ralph] run ${run.runId} failed: ${failureReason}`);
        }
      }
    }
  } finally {
    stateStore.close();
  }

  if (options.dryRun) {
    console.log(
      "[Ralph] dry-run: no labels, assignments, branches, containers, or PRs were modified.",
    );
  }
}

async function runStart(config: RalphConfig, options: { dryRun: boolean }): Promise<void> {
  await runStartLoop(config, options);
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
