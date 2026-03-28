import { spawn } from "node:child_process";

/**
 * Run backend and frontend together for the local tracer bullet.
 */
function runProcess(label, command, args) {
  const child = spawn(command, args, { stdio: "pipe", shell: true });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${label}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`[${label}] exited with ${reason}`);
    process.exitCode = process.exitCode ?? code ?? 0;
  });

  return child;
}

const backend = runProcess("backend", "npm", ["run", "dev:backend"]);
const frontend = runProcess("frontend", "npm", ["run", "dev:frontend"]);

function shutdown(signal) {
  console.log(`Received ${signal}; stopping dev processes...`);
  backend.kill("SIGTERM");
  frontend.kill("SIGTERM");
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
