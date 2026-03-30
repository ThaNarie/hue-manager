import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vite-plus/test";

import { persistFinalOutputArtifact } from "./final-output-artifact.js";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { recursive: true, force: true });
  }
});

function createTempArtifactPath(): string {
  const root = mkdtempSync(join(tmpdir(), "ralph-final-output-"));
  tempPaths.push(root);
  const artifactPath = resolve(root, ".ralph", "artifacts", "issue-000037-run-0001");
  mkdirSync(artifactPath, { recursive: true });
  return artifactPath;
}

describe("final output artifact", () => {
  test("writes normalized final-output.md when worker artifact exists", () => {
    const artifactPath = createTempArtifactPath();
    const expected = [
      "1. What was implemented",
      "- Implemented issue #37 requirements.",
      "",
      "2. Validation results",
      "- vp run build",
      "- vp test",
      "- vp check --fix",
      "",
      "3. Any blockers or follow-up needed",
      "- None.",
    ].join("\n");
    writeFileSync(resolve(artifactPath, "final-output.md"), expected, "utf8");

    const finalOutput = persistFinalOutputArtifact(artifactPath);

    expect(finalOutput).toBe(`${expected}\n`);
    expect(readFileSync(resolve(artifactPath, "final-output.md"), "utf8")).toBe(`${expected}\n`);
  });

  test("throws when worker did not write final-output artifact", () => {
    const artifactPath = createTempArtifactPath();

    expect(() => persistFinalOutputArtifact(artifactPath)).toThrow(
      "worker did not write /artifacts/final-output.md",
    );
  });
});
