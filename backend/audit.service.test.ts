import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  listAuditEvents,
  purgeAuditEvents,
  recordAuditEvent,
  updateAuditRetentionDays,
} from "./audit.service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
  delete process.env.AUDIT_STORE_PATH;
});

async function withAuditStorePath() {
  const directory = await mkdtemp(join(tmpdir(), "hue-manager-audit-"));
  temporaryDirectories.push(directory);
  const filePath = join(directory, "audit-store.json");
  process.env.AUDIT_STORE_PATH = filePath;
  return filePath;
}

describe("audit service", () => {
  test("defaults retention policy to 90 days", async () => {
    await withAuditStorePath();

    const auditEvents = await listAuditEvents();
    expect(auditEvents.retentionDays).toBe(90);
    expect(auditEvents.events).toHaveLength(0);
  });

  test("records events and applies configured retention", async () => {
    await withAuditStorePath();

    await recordAuditEvent({
      action: "light.update",
      entityType: "light",
      entityId: "light-1",
      outcome: "failure",
      details: "Could not reach Hue Bridge.",
      metadata: { statusCode: 502 },
    });

    await updateAuditRetentionDays(1);
    await recordAuditEvent({
      action: "light.update",
      entityType: "light",
      entityId: "light-1",
      outcome: "success",
      details: null,
      metadata: { statusCode: 200 },
    });

    const auditEvents = await listAuditEvents();
    expect(auditEvents.retentionDays).toBe(1);
    expect(auditEvents.events).toHaveLength(2);
    expect(auditEvents.events[0].recordedAt >= auditEvents.events[1].recordedAt).toBe(true);
  });

  test("purges all recorded events", async () => {
    const filePath = await withAuditStorePath();

    await recordAuditEvent({
      action: "light.update",
      entityType: "light",
      entityId: "light-2",
      outcome: "success",
      details: null,
      metadata: { statusCode: 200 },
    });
    await purgeAuditEvents();

    const auditEvents = await listAuditEvents();
    expect(auditEvents.events).toHaveLength(0);
    const persisted = await readFile(filePath, "utf8");
    expect(persisted.includes('"events": []')).toBe(true);
  });
});
