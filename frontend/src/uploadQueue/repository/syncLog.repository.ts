import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { getDb } from '../../db';
import { isSyncLoggingEnabled } from '../../store/testerSettings';
import type { AppendSyncLogInput, SyncLog } from '../../types/syncLog';

type SyncLogRow = {
  id: string;
  report_id: string | null;
  attachment_id: string | null;
  level: string;
  event: string;
  message: string;
  meta_json: string | null;
  created_at: string;
};

function mapRow(row: SyncLogRow): SyncLog {
  return {
    id: row.id,
    reportId: row.report_id,
    attachmentId: row.attachment_id,
    level: row.level as SyncLog['level'],
    event: row.event,
    message: row.message,
    metaJson: row.meta_json,
    createdAt: row.created_at,
  };
}

export const syncLogRepository = {
  async append(input: AppendSyncLogInput): Promise<SyncLog> {
    const db = getDb();
    const log: SyncLog = {
      id: uuidv4(),
      reportId: input.reportId ?? null,
      attachmentId: input.attachmentId ?? null,
      level: input.level ?? 'info',
      event: input.event,
      message: input.message,
      metaJson: input.meta ? JSON.stringify(input.meta) : null,
      createdAt: new Date().toISOString(),
    };

    await db.execute(
      `INSERT INTO sync_logs (
        id, report_id, attachment_id, level, event, message, meta_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.reportId,
        log.attachmentId,
        log.level,
        log.event,
        log.message,
        log.metaJson,
        log.createdAt,
      ],
    );

    return log;
  },

  async list(limit = 100): Promise<SyncLog[]> {
    const db = getDb();
    const result = await db.execute(
      `SELECT id, report_id, attachment_id, level, event, message, created_at
       FROM sync_logs
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
    );
    return (result.rows as SyncLogRow[]).map((row) =>
      mapRow({ ...row, meta_json: null }),
    );
  },

  /** Fast path: one report’s logs only (keeps Sync Logs snappy). */
  async listByReportId(reportId: string, limit = 80): Promise<SyncLog[]> {
    const db = getDb();
    const result = await db.execute(
      `SELECT id, report_id, attachment_id, level, event, message, created_at
       FROM sync_logs
       WHERE report_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [reportId, limit],
    );
    return (result.rows as SyncLogRow[]).map((row) =>
      mapRow({ ...row, meta_json: null }),
    );
  },

  async clear(): Promise<void> {
    const db = getDb();
    await db.execute('DELETE FROM sync_logs');
  },

  async clearByReportId(reportId: string): Promise<void> {
    const db = getDb();
    await db.execute('DELETE FROM sync_logs WHERE report_id = ?', [reportId]);
  },
};

/** Fire-and-forget log helper for the worker. */
export async function logSync(input: AppendSyncLogInput): Promise<void> {
  if (!isSyncLoggingEnabled()) {
    return;
  }
  try {
    await syncLogRepository.append(input);
  } catch {
    // Never break uploads because logging failed.
  }
}
