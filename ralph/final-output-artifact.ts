import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const FINAL_OUTPUT_ARTIFACT_FILE = "final-output.md";

const REQUIRED_FINAL_HEADINGS = [
  "1. What was implemented",
  "2. Validation results",
  "3. Any blockers or follow-up needed",
] as const;

export function persistFinalOutputArtifact(artifactPath: string): string {
  const finalOutput = readFinalOutputArtifact(artifactPath);
  const normalized = normalizeFinalOutput(finalOutput);
  assertDeterministicFinalSections(normalized);
  writeFileSync(resolve(artifactPath, FINAL_OUTPUT_ARTIFACT_FILE), normalized, "utf8");
  return normalized;
}

function readFinalOutputArtifact(artifactPath: string): string {
  const finalOutputPath = resolve(artifactPath, FINAL_OUTPUT_ARTIFACT_FILE);
  if (!existsSync(finalOutputPath)) {
    throw new Error(
      "worker did not write /artifacts/final-output.md; update the worker prompt or agent instructions",
    );
  }
  return readFileSync(finalOutputPath, "utf8");
}

function normalizeFinalOutput(value: string): string {
  return `${value.replace(/\r\n/g, "\n").trimEnd()}\n`;
}

function assertDeterministicFinalSections(output: string): void {
  let cursor = 0;
  for (const heading of REQUIRED_FINAL_HEADINGS) {
    const index = output.indexOf(heading, cursor);
    if (index < 0) {
      throw new Error(`worker final output is missing required section heading: "${heading}"`);
    }
    cursor = index + heading.length;
  }
}
