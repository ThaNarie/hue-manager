import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const FINAL_OUTPUT_ARTIFACT_FILE = "final-output.md";

const REQUIRED_FINAL_HEADINGS = [
  "1. What was implemented",
  "2. Validation results",
  "3. Any blockers or follow-up needed",
] as const;

type JsonObject = Record<string, unknown>;

export function persistFinalOutputArtifact(artifactPath: string): string {
  const streamLog = readWorkerStreamLog(artifactPath);
  const finalOutput = extractFinalOutputFromStreamLog(streamLog);
  const normalized = normalizeFinalOutput(finalOutput);
  assertDeterministicFinalSections(normalized);
  writeFileSync(resolve(artifactPath, FINAL_OUTPUT_ARTIFACT_FILE), normalized, "utf8");
  return normalized;
}

export function extractFinalOutputFromStreamLog(streamLog: string): string {
  const candidates: Array<{ text: string; score: number; index: number }> = [];
  let streamedAssistantOutput = "";
  let eventIndex = 0;

  for (const line of streamLog.split("\n")) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      continue;
    }
    const parsed = parseJsonObject(trimmedLine);
    if (!parsed) {
      continue;
    }

    const eventScore = scoreEvent(parsed);
    if (eventScore <= 0) {
      continue;
    }

    const type = readString(parsed.type);
    if (type.toLowerCase().includes("delta")) {
      const delta = firstNonEmptyString(extractTextCandidates(parsed, true));
      if (delta) {
        streamedAssistantOutput += delta;
      }
    }

    for (const text of extractTextCandidates(parsed, false)) {
      const cleaned = text.trim();
      if (cleaned.length === 0) {
        continue;
      }
      candidates.push({
        text: cleaned,
        score: eventScore + scoreCandidateText(cleaned),
        index: eventIndex,
      });
    }
    eventIndex += 1;
  }

  if (streamedAssistantOutput.trim().length > 0) {
    candidates.push({
      text: streamedAssistantOutput.trim(),
      score: 20 + scoreCandidateText(streamedAssistantOutput),
      index: eventIndex,
    });
  }

  const best = candidates
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return right.index - left.index;
    })
    .at(0);
  if (!best) {
    throw new Error("failed to extract final assistant output from worker stream");
  }
  return best.text;
}

function readWorkerStreamLog(artifactPath: string): string {
  const preferred = resolve(artifactPath, "worker.log");
  if (existsSync(preferred)) {
    return readFileSync(preferred, "utf8");
  }
  return readFileSync(resolve(artifactPath, "worker.stdout.log"), "utf8");
}

function parseJsonObject(value: string): JsonObject | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function scoreEvent(event: JsonObject): number {
  const tokens = [
    readString(event.type),
    readString(event.event),
    readString(event.kind),
    readString(event.role),
    readString(readObject(event.message)?.role),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (tokens.includes("assistant")) {
    score += 20;
  }
  if (tokens.includes("final") || tokens.includes("complete") || tokens.includes("done")) {
    score += 35;
  }
  if (tokens.includes("response") || tokens.includes("message")) {
    score += 10;
  }
  if (event.final === true || event.is_final === true) {
    score += 35;
  }
  if (
    "final_output" in event ||
    "finalOutput" in event ||
    "final_response" in event ||
    "finalResponse" in event
  ) {
    score += 40;
  }
  return score;
}

function scoreCandidateText(text: string): number {
  let score = 0;
  if (text.includes(REQUIRED_FINAL_HEADINGS[0])) {
    score += 60;
  }
  if (text.includes(REQUIRED_FINAL_HEADINGS[1])) {
    score += 20;
  }
  if (text.includes(REQUIRED_FINAL_HEADINGS[2])) {
    score += 20;
  }
  if (text.length >= 120) {
    score += 5;
  }
  return score;
}

function extractTextCandidates(value: unknown, includeDelta: boolean): string[] {
  const collected: string[] = [];
  collectTextCandidates(value, includeDelta, collected, []);
  return [...new Set(collected)];
}

function collectTextCandidates(
  value: unknown,
  includeDelta: boolean,
  collected: string[],
  path: string[],
): void {
  if (typeof value === "string") {
    if (isTextCandidate(path[path.length - 1], includeDelta)) {
      collected.push(value);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextCandidates(item, includeDelta, collected, path);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    collectTextCandidates(child, includeDelta, collected, [...path, key]);
  }
}

function isTextCandidate(key: string | undefined, includeDelta: boolean): boolean {
  if (!key) {
    return false;
  }
  if (key === "delta") {
    return includeDelta;
  }
  return (
    key === "text" ||
    key === "content" ||
    key === "message" ||
    key === "output_text" ||
    key === "final_output" ||
    key === "finalOutput" ||
    key === "final_response" ||
    key === "finalResponse"
  );
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

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readObject(value: unknown): JsonObject | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return undefined;
}

function firstNonEmptyString(values: string[]): string | undefined {
  return values.find((value) => value.trim().length > 0);
}
