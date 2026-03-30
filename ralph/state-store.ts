import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { formatRunId } from "./run-identity.js";

const DEFAULT_STATE_DB_PATH = resolve(process.cwd(), ".ralph/state.db");

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export type RunAttempt = {
  runId: string;
  issueNumber: number;
  attempt: number;
  triggerType: "poll" | "comment";
  triggerCommentId: number | null;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  failureReason: string | null;
};

export type CreateRunAttemptInput = {
  issueNumber: number;
  triggerType: "poll" | "comment";
  triggerCommentId?: number;
};

type CursorRow = {
  last_comment_id: number | null;
};

type NextAttemptRow = {
  next_attempt: number;
};

type RunAttemptRow = {
  run_id: string;
  issue_number: number;
  attempt: number;
  trigger_type: "poll" | "comment";
  trigger_comment_id: number | null;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  failure_reason: string | null;
};

export class RalphStateStore {
  private db: DatabaseSync;

  constructor(dbPath = DEFAULT_STATE_DB_PATH) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();
  }

  close(): void {
    this.db.close();
  }

  peekNextRunId(issueNumber: number): string {
    const attempt = this.nextAttemptNumber(issueNumber);
    return formatRunId(issueNumber, attempt);
  }

  createRunAttempt(input: CreateRunAttemptInput): RunAttempt {
    const now = new Date().toISOString();

    this.db.exec("BEGIN IMMEDIATE TRANSACTION");
    try {
      const attempt = this.nextAttemptNumber(input.issueNumber);
      const runId = formatRunId(input.issueNumber, attempt);
      this.db
        .prepare(
          `
            INSERT INTO run_attempts (
              run_id,
              issue_number,
              attempt,
              trigger_type,
              trigger_comment_id,
              status,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
          `,
        )
        .run(
          runId,
          input.issueNumber,
          attempt,
          input.triggerType,
          input.triggerCommentId ?? null,
          now,
          now,
        );
      this.db.exec("COMMIT");
      return this.getRunAttempt(runId);
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  advanceCommentCursor(issueNumber: number, observedCommentIds: number[]): number {
    if (observedCommentIds.length === 0) {
      return this.getCommentCursor(issueNumber);
    }

    const currentCursor = this.getCommentCursor(issueNumber);
    const uniqueSorted = [...new Set(observedCommentIds)].sort((a, b) => a - b);
    const nextCursor = uniqueSorted[uniqueSorted.length - 1];
    if (nextCursor <= currentCursor) {
      return currentCursor;
    }

    this.db
      .prepare(
        `
          INSERT INTO issue_comment_cursors (
            issue_number,
            last_comment_id,
            updated_at
          )
          VALUES (?, ?, ?)
          ON CONFLICT(issue_number) DO UPDATE SET
            last_comment_id = excluded.last_comment_id,
            updated_at = excluded.updated_at
        `,
      )
      .run(issueNumber, nextCursor, new Date().toISOString());

    return nextCursor;
  }

  getUnconsumedCommentIds(issueNumber: number, observedCommentIds: number[]): number[] {
    if (observedCommentIds.length === 0) {
      return [];
    }
    const cursor = this.getCommentCursor(issueNumber);
    return [...new Set(observedCommentIds)].sort((a, b) => a - b).filter((id) => id > cursor);
  }

  getCommentCursor(issueNumber: number): number {
    const row = this.db
      .prepare(
        `
          SELECT last_comment_id
          FROM issue_comment_cursors
          WHERE issue_number = ?
        `,
      )
      .get(issueNumber) as CursorRow | undefined;
    return row?.last_comment_id ?? 0;
  }

  updateRunStatus(
    runId: string,
    status: Exclude<RunStatus, "queued">,
    options: { failureReason?: string } = {},
  ): RunAttempt {
    this.db
      .prepare(
        `
          UPDATE run_attempts
          SET status = ?, failure_reason = ?, updated_at = ?
          WHERE run_id = ?
        `,
      )
      .run(status, options.failureReason ?? null, new Date().toISOString(), runId);
    return this.getRunAttempt(runId);
  }

  getRunAttempt(runId: string): RunAttempt {
    const row = this.db
      .prepare(
        `
          SELECT
            run_id,
            issue_number,
            attempt,
            trigger_type,
            trigger_comment_id,
            status,
            created_at,
            updated_at,
            failure_reason
          FROM run_attempts
          WHERE run_id = ?
        `,
      )
      .get(runId) as RunAttemptRow | undefined;

    if (!row) {
      throw new Error(`Run attempt not found for runId=${runId}`);
    }

    return {
      runId: row.run_id,
      issueNumber: row.issue_number,
      attempt: row.attempt,
      triggerType: row.trigger_type,
      triggerCommentId: row.trigger_comment_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      failureReason: row.failure_reason,
    };
  }

  listRunAttemptsByStatus(status: RunStatus): RunAttempt[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            run_id,
            issue_number,
            attempt,
            trigger_type,
            trigger_comment_id,
            status,
            created_at,
            updated_at,
            failure_reason
          FROM run_attempts
          WHERE status = ?
          ORDER BY created_at ASC
        `,
      )
      .all(status) as RunAttemptRow[];

    return rows.map((row) => ({
      runId: row.run_id,
      issueNumber: row.issue_number,
      attempt: row.attempt,
      triggerType: row.trigger_type,
      triggerCommentId: row.trigger_comment_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      failureReason: row.failure_reason,
    }));
  }

  private nextAttemptNumber(issueNumber: number): number {
    const row = this.db
      .prepare(
        `
          SELECT COALESCE(MAX(attempt), 0) + 1 AS next_attempt
          FROM run_attempts
          WHERE issue_number = ?
        `,
      )
      .get(issueNumber) as NextAttemptRow;
    return row.next_attempt;
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS run_attempts (
        run_id TEXT PRIMARY KEY,
        issue_number INTEGER NOT NULL,
        attempt INTEGER NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_comment_id INTEGER,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        failure_reason TEXT,
        UNIQUE(issue_number, attempt)
      );

      CREATE TABLE IF NOT EXISTS issue_comment_cursors (
        issue_number INTEGER PRIMARY KEY,
        last_comment_id INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }
}
