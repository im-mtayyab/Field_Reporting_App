import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { api } from '../../config/api';
import type { AppError } from '../../errors/AppError';
import type { Report } from '../../types/report';
import { reportSchema } from './reportSchemas';

const createReportResponseSchema = z.object({
  report: reportSchema,
  deduped: z.boolean().optional(),
});

export type CreateReportBody = {
  reportId: string;
  description: string;
  attachments: Array<{
    attachmentId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }>;
};

export type CreateReportError =
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Validation'; message: string }
  | { reason: 'Conflict'; message: string }
  | { reason: 'Rejected'; message: string }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message: string };

function fromAppError(error: AppError): CreateReportError {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return { reason: 'Connection' };
    case 'TIMEOUT':
      return { reason: 'Timeout' };
    case 'VALIDATION':
      return { reason: 'Validation', message: error.message };
    case 'CONFLICT':
      return { reason: 'Conflict', message: error.message };
    case 'REJECTED':
      return { reason: 'Rejected', message: error.message };
    case 'SERVER':
      return { reason: 'Server' };
    default:
      return { reason: 'Unexpected', message: error.message };
  }
}

/** Idempotent POST /reports — creates metadata only (no binary yet). */
export async function createReportService(
  body: CreateReportBody,
): Promise<Result<{ report: Report; deduped: boolean }, CreateReportError>> {
  const res = await api.post<unknown>('/reports', body);
  if (res.isErr()) {
    return err(fromAppError(res.error));
  }

  const parsed = createReportResponseSchema.safeParse(res.value);
  if (!parsed.success) {
    return err({
      reason: 'Unexpected',
      message: 'Invalid create report response',
    });
  }

  return ok({
    report: parsed.data.report,
    deduped: parsed.data.deduped ?? false,
  });
}
