import {
  processQueue,
  type ProcessQueueResult,
} from '../../uploadQueue';
import { toAppError } from '../result';

export type ProcessQueueActionResult =
  | { ok: true; result: ProcessQueueResult }
  | { ok: false; message: string };

/** UI / headless boundary: run one upload-queue drain pass. */
export async function processQueueAction(): Promise<ProcessQueueActionResult> {
  try {
    const result = await processQueue();
    return { ok: true, result };
  } catch (error) {
    const appError = toAppError(error);
    return { ok: false, message: appError.message };
  }
}
