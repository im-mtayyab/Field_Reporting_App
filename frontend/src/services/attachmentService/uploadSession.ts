import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { api } from '../../config/api';
import type { AppError } from '../../errors/AppError';
import type { UploadSession } from '../../types/report';

const uploadSessionSchema = z.object({
  bucket: z.string(),
  objectPath: z.string(),
  uploadEndpoint: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  accessToken: z.string(),
  apikey: z.string(),
  resumable: z.literal(true),
});

export type UploadSessionError =
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Conflict'; message: string }
  | { reason: 'Rejected'; message: string }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message: string };

function fromAppError(error: AppError): UploadSessionError {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return { reason: 'Connection' };
    case 'TIMEOUT':
      return { reason: 'Timeout' };
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

/** POST upload-session — signed TUS target for one attachment. */
export async function createUploadSessionService(
  reportId: string,
  attachmentId: string,
): Promise<Result<UploadSession, UploadSessionError>> {
  const res = await api.post<unknown>(
    `/api/reports/${reportId}/attachments/${attachmentId}/upload-session`,
  );
  if (res.isErr()) {
    return err(fromAppError(res.error));
  }

  const parsed = uploadSessionSchema.safeParse(res.value);
  if (!parsed.success) {
    return err({
      reason: 'Unexpected',
      message: 'Invalid upload-session response',
    });
  }

  return ok(parsed.data);
}
