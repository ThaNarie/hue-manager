import {
  parseBackupCreateResponse,
  parseBackupsResponse,
  parseBackupRestoreResponse,
} from "../../../shared/contracts/backups";

function getResponseMessage(payload: unknown, fallbackMessage: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  return fallbackMessage;
}

export async function requestBackups() {
  const response = await fetch("/api/backups");
  if (!response.ok) {
    throw new Error(`Backups endpoint failed (${response.status})`);
  }

  const payload = await response.json();
  return parseBackupsResponse(payload);
}

export async function requestBackupCreate() {
  const response = await fetch("/api/backups", {
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Backup create failed (${response.status})`));
  }

  return parseBackupCreateResponse(payload);
}

export async function requestBackupRestore(backupId: string) {
  const response = await fetch(`/api/backups/${encodeURIComponent(backupId)}/restore`, {
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(getResponseMessage(payload, `Backup restore failed (${response.status})`));
  }

  return parseBackupRestoreResponse(payload);
}
