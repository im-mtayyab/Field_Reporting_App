import { open, type DB } from '@op-engineering/op-sqlite';

const DB_NAME = 'field_reports.db';

let db: DB | null = null;

/** Shared SQLite connection (local source of truth for the upload queue). */
export function getDb(): DB {
  if (!db) {
    // First open() can feel slow in Debug (native load) — never gate the whole UI on it.
    db = open({ name: DB_NAME });
  }
  return db;
}
