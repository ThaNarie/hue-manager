import { describe, expect, test } from "vite-plus/test";

import {
  claimIssue,
  getAuthenticatedActorLogin,
  transitionIssueLifecycleLabel,
} from "./issue-lifecycle.js";

type FakeIssue = {
  number: number;
  state: "OPEN" | "CLOSED";
  labels: string[];
  assignees: string[];
};

function createFakeGh(issues: FakeIssue[], actor = "ralph-bot") {
  const issueMap = new Map(issues.map((issue) => [issue.number, issue]));
  const calls: string[][] = [];

  const fakeGh = (args: string[]): { stdout: string } => {
    calls.push([...args]);
    if (args[0] === "api" && args[1] === "user") {
      return { stdout: `${actor}\n` };
    }

    if (args[0] !== "issue") {
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    }

    const issueNumber = Number(args[2]);
    const issue = issueMap.get(issueNumber);
    if (!issue) {
      throw new Error(`Unknown issue #${issueNumber}`);
    }

    if (args[1] === "view") {
      return {
        stdout: JSON.stringify({
          number: issue.number,
          state: issue.state,
          labels: issue.labels.map((name) => ({ name })),
          assignees: issue.assignees.map((login) => ({ login })),
        }),
      };
    }

    if (args[1] === "edit") {
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === "--add-label") {
          const label = args[index + 1];
          if (label && !issue.labels.includes(label)) {
            issue.labels.push(label);
          }
        }
        if (args[index] === "--remove-label") {
          const label = args[index + 1];
          issue.labels = issue.labels.filter((entry) => entry !== label);
        }
        if (args[index] === "--add-assignee") {
          const assignee = args[index + 1];
          if (assignee && !issue.assignees.includes(assignee)) {
            issue.assignees.push(assignee);
          }
        }
      }
      return { stdout: "" };
    }

    throw new Error(`Unexpected command: ${args.join(" ")}`);
  };

  return { fakeGh, issueMap, calls };
}

describe("issue lifecycle transitions", () => {
  test("claims a ready issue by labeling and assigning actor", () => {
    const { fakeGh, issueMap } = createFakeGh([
      { number: 24, state: "OPEN", labels: ["ai:ready"], assignees: [] },
    ]);

    const result = claimIssue("thanarie/hue-manager", 24, "ralph-bot", fakeGh);
    const updated = issueMap.get(24);

    expect(result).toEqual({ status: "claimed" });
    expect(updated?.labels.sort()).toEqual(["ai:claimed"]);
    expect(updated?.assignees).toEqual(["ralph-bot"]);
  });

  test("skips claim when ready label is missing", () => {
    const { fakeGh } = createFakeGh([
      { number: 24, state: "OPEN", labels: ["ai:failed"], assignees: [] },
    ]);

    const result = claimIssue("thanarie/hue-manager", 24, "ralph-bot", fakeGh);
    expect(result).toEqual({ status: "skipped", reason: "issue is not in ai:ready" });
  });

  test("moves lifecycle labels through success and failure paths deterministically", () => {
    const { fakeGh, issueMap } = createFakeGh([
      { number: 24, state: "OPEN", labels: ["ai:claimed"], assignees: ["ralph-bot"] },
      { number: 25, state: "OPEN", labels: ["ai:claimed"], assignees: ["ralph-bot"] },
    ]);

    transitionIssueLifecycleLabel("thanarie/hue-manager", 24, "ai:in-progress", fakeGh);
    transitionIssueLifecycleLabel("thanarie/hue-manager", 24, "ai:review", fakeGh);

    transitionIssueLifecycleLabel("thanarie/hue-manager", 25, "ai:in-progress", fakeGh);
    transitionIssueLifecycleLabel("thanarie/hue-manager", 25, "ai:failed", fakeGh);

    expect(issueMap.get(24)?.labels).toEqual(["ai:review"]);
    expect(issueMap.get(25)?.labels).toEqual(["ai:failed"]);
  });

  test("keeps failed issues human-retriable by allowing transition back to ready", () => {
    const { fakeGh, issueMap } = createFakeGh([
      { number: 24, state: "OPEN", labels: ["ai:failed"], assignees: ["ralph-bot"] },
    ]);

    transitionIssueLifecycleLabel("thanarie/hue-manager", 24, "ai:ready", fakeGh);
    expect(issueMap.get(24)?.labels).toEqual(["ai:ready"]);
  });

  test("reads current actor login from GitHub CLI", () => {
    const { fakeGh, calls } = createFakeGh([]);
    const actor = getAuthenticatedActorLogin(fakeGh);

    expect(actor).toBe("ralph-bot");
    expect(calls[0]).toEqual(["api", "user", "--jq", ".login"]);
  });
});
