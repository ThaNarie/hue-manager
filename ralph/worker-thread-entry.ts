import { parentPort, workerData } from "node:worker_threads";

import { executeIssueWork, type ExecuteIssueWorkInput } from "./worker-execution.js";

type WorkerSuccessMessage = {
  ok: true;
};

type WorkerFailureMessage = {
  ok: false;
  error: string;
};

function postMessage(message: WorkerSuccessMessage | WorkerFailureMessage): void {
  if (!parentPort) {
    return;
  }
  parentPort.postMessage(message);
}

try {
  executeIssueWork(workerData as ExecuteIssueWorkInput);
  postMessage({ ok: true });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  postMessage({ ok: false, error: message });
}
