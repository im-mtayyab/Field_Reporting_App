import { err, ok, type Result } from 'neverthrow';

import { api } from '../../config/api';
import type { AppError } from '../../errors/AppError';

export type FailAttachmentError =
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Rejected'; message: string }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message: string };

function fromAppError(error: AppError): FailAttachmentError {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return { reason: 'Connection' };
    case 'TIMEOUT':
      return { reason: 'Timeout' };
    case 'REJECTED':
      return { reason: 'Rejected', message: error.message };
    case 'SERVER':
      return { reason: 'Server' };
    default:
      return { reason: 'Unexpected', message: error.message };
  }
}

/** Tell the API an attachment upload failed (best-effort). */
export async function failAttachmentService(
  reportId: string,
  attachmentId: string,
  reason?: string,
): Promise<Result<void, FailAttachmentError>> {
  const res = await api.post<unknown>(
    `/api/reports/${reportId}/attachments/${attachmentId}/fail`,
    reason ? { reason } : undefined,
  );
  if (res.isErr()) {
    return err(fromAppError(res.error));
  }
  return ok(undefined);
}
