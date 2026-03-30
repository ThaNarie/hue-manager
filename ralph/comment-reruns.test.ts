import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { parseRerunCommand, pollCommentRerunTriggers } from "./comment-reruns.js";
import { RalphStateStore } from "./state-store.js";

type FakeGhIssue = {
  number: number;
  title: string;
  labels: string[];
  comments: Array<{ id: number; body: string }>;
};

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function createStore(): { store: RalphStateStore; close: () => void } {
  const tempDir = mkdtempSync(join(tmpdir(), "ralph-comment-reruns-"));
  tempPaths.push(tempDir);
  const store = new RalphStateStore(join(tempDir, "state.db"));
  return {
    store,
    close: () => store.close(),
  };
}

function createFakeGh(issues: FakeGhIssue[]) {
  return (args: string[]): { stdout: string } => {
    if (args[0] !== "issue") {
      throw new Error(`Unexpected command: ${args.join(" ")}`);
    }

    if (args[1] === "list") {
      const labelIndex = args.indexOf("--label");
      const label = args[labelIndex + 1];
      const filtered = issues
        .filter((issue) => issue.labels.includes(label))
        .map((issue) => ({ number: issue.number, title: issue.title }));
      return { stdout: JSON.stringify(filtered) };
    }

    if (args[1] === "view") {
      const issueNumber = Number(args[2]);
      const issue = issues.find((entry) => entry.number === issueNumber);
      if (!issue) {
        throw new Error(`Unknown issue #${issueNumber}`);
      }
      return {
        stdout: JSON.stringify({ comments: issue.comments }),
      };
    }

    throw new Error(`Unexpected command: ${args.join(" ")}`);
  };
}

describe("comment rerun commands", () => {
  test("parses strict rerun commands", () => {
    expect(parseRerunCommand("retry")).toBe("retry");
    expect(parseRerunCommand("/apply-feedback")).toBe("apply-feedback");
    expect(parseRerunCommand("@ralph retry")).toBe("retry");
    expect(parseRerunCommand("please retry this")).toBeNull();
    expect(parseRerunCommand("apply feedback")).toBeNull();
  });

  test("returns only unconsumed recognized commands from review and failed issues", () => {
    const { store, close } = createStore();
    store.advanceCommentCursor(11, [400]);

    const gh = createFakeGh([
      {
        number: 11,
        title: "review issue",
        labels: ["ai:review"],
        comments: [
          { id: 400, body: "retry" },
          { id: 401, body: "looks good" },
          { id: 402, body: "/apply-feedback" },
        ],
      },
      {
        number: 12,
        title: "failed issue",
        labels: ["ai:failed"],
        comments: [
          { id: 99, body: "retry" },
          { id: 100, body: "/retry" },
        ],
      },
      {
        number: 13,
        title: "ready issue",
        labels: ["ai:ready"],
        comments: [{ id: 700, body: "retry" }],
      },
    ]);

    const triggers = pollCommentRerunTriggers("thanarie/hue-manager", { gh, stateStore: store });
    close();

    expect(triggers).toEqual([
      {
        issueNumber: 11,
        issueTitle: "review issue",
        commentId: 402,
        command: "apply-feedback",
      },
      {
        issueNumber: 12,
        issueTitle: "failed issue",
        commentId: 99,
        command: "retry",
      },
      {
        issueNumber: 12,
        issueTitle: "failed issue",
        commentId: 100,
        command: "retry",
      },
    ]);
  });
});
