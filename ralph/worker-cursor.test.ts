import { describe, expect, test } from "vite-plus/test";

import { renderCursorPrompt } from "./worker-cursor.js";
import type { ExecuteIssueWorkInput } from "./worker-execution.js";

describe("renderCursorPrompt", () => {
  test("embeds acceptance criteria and blocked-by checklist sections", () => {
    const input: ExecuteIssueWorkInput = {
      repo: "thanarie/hue-manager",
      issueNumber: 27,
      runId: "issue-000027-run-0004",
      baseBranch: "main",
      workerImage: "hue-manager-ralph-worker:latest",
      workerTimeoutMs: 900_000,
    };

    const prompt = renderCursorPrompt(input, "ralph/issue-000027", {
      title: "Slice 7 scheduler",
      body: [
        "## Parent PRD",
        "",
        "- #20",
        "",
        "## Acceptance criteria",
        "",
        "- [ ] does first thing",
        "- [x] does second thing",
        "",
        "## Blocked by",
        "",
        "- #26",
      ].join("\n"),
    });

    expect(prompt).toContain("Acceptance criteria checklist:");
    expect(prompt).toContain("- does first thing");
    expect(prompt).toContain("- does second thing");
    expect(prompt).toContain("Blocked-by dependencies:");
    expect(prompt).toContain("- #26");
    expect(prompt).toContain("Parent PRD reference:");
    expect(prompt).toContain("- #20");
    expect(prompt).toContain("Required validation commands (run from /workspace):");
    expect(prompt).toContain("1. What was implemented");
    expect(prompt).toContain("Final response rules:");
    expect(prompt).toContain("Output markdown only (no preamble).");
  });
});
