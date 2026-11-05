import { ensureDbReady } from '../../db';
import { uploadQueueRepository, type UploadReport } from '../../uploadQueue';
import { toAppError } from '../result';

export type ListUploadQueueActionResult =
  | { ok: true; reports: UploadReport[] }
  | { ok: false; message: string };

/** Reads the local upload queue for the Uploads screen. */
export async function listUploadQueueAction(): Promise<ListUploadQueueActionResult> {
  try {
    await ensureDbReady();
    const reports = await uploadQueueRepository.listReports();
    return { ok: true, reports };
  } catch (error) {
    const appError = toAppError(error);
    return { ok: false, message: appError.message };
  }
}
