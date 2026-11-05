import type { SQLBatchTuple } from '@op-engineering/op-sqlite';

import { getDb } from './client';

const LATEST_VERSION = 3;

const MIGRATION_V1: SQLBatchTuple[] = [
  [
    `CREATE TABLE IF NOT EXISTS outbox_reports (
      id TEXT PRIMARY KEY NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      remote_created INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ],
  [
    `CREATE TABLE IF NOT EXISTS outbox_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      report_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      local_uri TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES outbox_reports(id) ON DELETE CASCADE
    )`,
  ],
  [
    `CREATE INDEX IF NOT EXISTS idx_outbox_reports_status
      ON outbox_reports(status, created_at)`,
  ],
  [
    `CREATE INDEX IF NOT EXISTS idx_outbox_attachments_report
      ON outbox_attachments(report_id, sort_order)`,
  ],
];

/** TUS resume fields + sync event log with FKs. */
const MIGRATION_V2: SQLBatchTuple[] = [
  [`ALTER TABLE outbox_attachments ADD COLUMN upload_url TEXT`],
  [`ALTER TABLE outbox_attachments ADD COLUMN upload_offset INTEGER NOT NULL DEFAULT 0`],
  [`ALTER TABLE outbox_attachments ADD COLUMN access_token TEXT`],
  [`ALTER TABLE outbox_attachments ADD COLUMN object_path TEXT`],
  [`ALTER TABLE outbox_attachments ADD COLUMN upload_job_id TEXT`],
  [
    `CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY NOT NULL,
      report_id TEXT,
      attachment_id TEXT,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      message TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES outbox_reports(id) ON DELETE SET NULL,
      FOREIGN KEY (attachment_id) REFERENCES outbox_attachments(id) ON DELETE SET NULL
    )`,
  ],
  [
    `CREATE INDEX IF NOT EXISTS idx_sync_logs_created
      ON sync_logs(created_at DESC)`,
  ],
  [
    `CREATE INDEX IF NOT EXISTS idx_sync_logs_report
      ON sync_logs(report_id, created_at DESC)`,
  ],
];

/** Track whether each photo finished local compress/persist. */
const MIGRATION_V3: SQLBatchTuple[] = [
  [
    `ALTER TABLE outbox_attachments ADD COLUMN prepared INTEGER NOT NULL DEFAULT 1`,
  ],
];

/** In-process: schema work already finished this session. */
let schemaReady = false;

/**
 * Apply SQL migrations **once per install** (tracked in `schema_migrations`).
 * On later reopens: only a version check — tables are not rebuilt.
 */
export async function migrateDb(): Promise<void> {
  if (schemaReady) {
    return;
  }

  const db = getDb();
  await db.execute('PRAGMA foreign_keys = ON');
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = await db.execute('SELECT version FROM schema_migrations');
  const done = new Set(
    (applied.rows ?? []).map((row) => Number(row.version)),
  );

  if (!done.has(1)) {
    await db.executeBatch(MIGRATION_V1);
    await db.execute(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [1, new Date().toISOString()],
    );
  }

  if (!done.has(2)) {
    await db.executeBatch(MIGRATION_V2);
    await db.execute(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [2, new Date().toISOString()],
    );
  }

  if (!done.has(3)) {
    await db.executeBatch(MIGRATION_V3);
    await db.execute(
      'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
      [3, new Date().toISOString()],
    );
  }

  // Keep LATEST_VERSION referenced so bumps are intentional.
  void LATEST_VERSION;
  schemaReady = true;
}
