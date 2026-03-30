import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AuditEventsResponse } from "../shared/contracts/audit.ts";
import { AuditEventsResponseSchema } from "../shared/contracts/audit.ts";
import type { AuditStore, RecordAuditEventInput } from "./audit.types.ts";

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_STORE_RELATIVE_PATH = "backend/.data/audit-store.json";

function getStorePath() {
  return process.env.AUDIT_STORE_PATH
    ? resolve(process.env.AUDIT_STORE_PATH)
    : resolve(process.cwd(), DEFAULT_STORE_RELATIVE_PATH);
}

function getDefaultStore(): AuditStore {
  return {
    retentionDays: DEFAULT_RETENTION_DAYS,
    events: [],
  };
}

function getRetentionCutoff(retentionDays: number) {
  return Date.now() - retentionDays * 24 * 60 * 60 * 1000;
}

function applyRetention(store: AuditStore): AuditStore {
  const cutoff = getRetentionCutoff(store.retentionDays);
  return {
    ...store,
    events: store.events.filter((event) => new Date(event.recordedAt).getTime() >= cutoff),
  };
}

async function writeStore(store: AuditStore) {
  const nextStore = applyRetention(store);
  const storePath = getStorePath();
  await mkdir(dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(nextStore, null, 2), "utf8");
  return nextStore;
}

async function readStore(): Promise<AuditStore> {
  const storePath = getStorePath();
  const raw = await readFile(storePath, "utf8").catch(() => null);
  if (!raw) {
    return writeStore(getDefaultStore());
  }

  const parsed = JSON.parse(raw) as Partial<AuditStore>;
  const maybeStore: AuditStore = {
    retentionDays:
      typeof parsed.retentionDays === "number" && Number.isInteger(parsed.retentionDays)
        ? parsed.retentionDays
        : DEFAULT_RETENTION_DAYS,
    events: Array.isArray(parsed.events) ? parsed.events : [],
  };
  const normalized = AuditEventsResponseSchema.parse({
    generatedAt: new Date().toISOString(),
    retentionDays: maybeStore.retentionDays,
    events: maybeStore.events,
  });

  const nextStore = applyRetention({
    retentionDays: normalized.retentionDays,
    events: normalized.events,
  });

  const retentionChanged = parsed.retentionDays !== nextStore.retentionDays;
  const eventsChanged = JSON.stringify(parsed.events ?? []) !== JSON.stringify(nextStore.events);
  if (retentionChanged || eventsChanged) {
    return writeStore(nextStore);
  }

  return nextStore;
}

export async function listAuditEvents(): Promise<AuditEventsResponse> {
  const store = await readStore();
  return {
    generatedAt: new Date().toISOString(),
    retentionDays: store.retentionDays,
    events: [...store.events].sort(
      (left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    ),
  };
}

export async function exportAuditEvents(): Promise<AuditEventsResponse> {
  return listAuditEvents();
}

export async function recordAuditEvent(input: RecordAuditEventInput) {
  const store = await readStore();
  const nextEvent = {
    id: crypto.randomUUID(),
    recordedAt: new Date().toISOString(),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    outcome: input.outcome,
    details: input.details,
    metadata: input.metadata,
  };
  await writeStore({
    ...store,
    events: [...store.events, nextEvent],
  });
}

export async function updateAuditRetentionDays(retentionDays: number) {
  const store = await readStore();
  await writeStore({
    ...store,
    retentionDays,
  });
}

export async function purgeAuditEvents() {
  const store = await readStore();
  await writeStore({
    ...store,
    events: [],
  });
}
