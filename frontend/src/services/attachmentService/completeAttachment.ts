import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { api } from '../../config/api';
import type { AppError } from '../../errors/AppError';
import { reportSchema } from '../reportService/reportSchemas';

const completeResponseSchema = z.object({
  report: reportSchema,
  attachment: z.record(z.string(), z.unknown()).optional(),
});

export type CompleteAttachmentError =
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Rejected'; message: string }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message: string };

function fromAppError(error: AppError): CompleteAttachmentError {
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

/** Mark attachment uploaded after TUS finishes. */
export async function completeAttachmentService(
  reportId: string,
  attachmentId: string,
): Promise<Result<{ reportId: string }, CompleteAttachmentError>> {
  const res = await api.post<unknown>(
    `/api/reports/${reportId}/attachments/${attachmentId}/complete`,
  );
  if (res.isErr()) {
    return err(fromAppError(res.error));
  }

  const parsed = completeResponseSchema.safeParse(res.value);
  if (!parsed.success) {
    return err({
      reason: 'Unexpected',
      message: 'Invalid complete response',
    });
  }

  return ok({ reportId: parsed.data.report.id });
}
