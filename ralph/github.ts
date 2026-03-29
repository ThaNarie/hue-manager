import { spawnSync } from "node:child_process";
import process from "node:process";

export function runGh(args: string[]): { stdout: string } {
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
