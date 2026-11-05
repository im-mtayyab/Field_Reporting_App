import { ensureDbReady } from '../../db';
import {
  syncLogRepository,
  uploadQueueRepository,
} from '../../uploadQueue';
import type { SyncLog } from '../../types/syncLog';

export type ListSyncLogsActionResult =
  | { ok: true; logs: SyncLog[] }
  | { ok: false; message: string };

export async function listSyncLogsAction(
  reportId?: string,
): Promise<ListSyncLogsActionResult> {
  try {
    await ensureDbReady();
    const logs = reportId
      ? await syncLogRepository.listByReportId(reportId, 100)
      : await syncLogRepository.list(80);
    return { ok: true, logs };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Could not load sync logs',
    };
  }
}

export async function clearSyncLogsAction(
  reportId?: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await ensureDbReady();
    if (reportId) {
      await syncLogRepository.clearByReportId(reportId);
    } else {
      await syncLogRepository.clear();
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Could not clear sync logs',
    };
  }
}

export async function clearLocalUploadQueueAction(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  try {
    await ensureDbReady();
    await uploadQueueRepository.clearLocalQueue();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : 'Could not clear local queue',
    };
  }
}
