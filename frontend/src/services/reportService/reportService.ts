import { err, ok, type Result } from 'neverthrow';

import { api } from '../../config/api';
import type { AppError } from '../../errors/AppError';
import type {
  ListReportsParams,
  ListReportsResponse,
  Report,
} from '../../types/report';
import type {
  DeleteReportsError,
  GetReportError,
  ListReportsError,
} from './reportErrors';
import {
  getReportResponseSchema,
  listReportsResponseSchema,
  resetReportsResponseSchema,
} from './reportSchemas';

const DEFAULT_PAGE_SIZE = 10;

function listFromAppError(error: AppError): ListReportsError {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return { reason: 'Connection' } as const;
    case 'TIMEOUT':
      return { reason: 'Timeout' } as const;
    case 'SERVER':
      return { reason: 'Server' } as const;
    case 'NOT_FOUND':
    case 'VALIDATION':
    case 'CONFLICT':
    case 'REJECTED':
    case 'BAD_DATA':
    case 'UNKNOWN':
      return { reason: 'Unexpected', message: error.message } as const;
    default: {
      const _exhaustive: never = error.code;
      return _exhaustive;
    }
  }
}

function getFromAppError(error: AppError): GetReportError {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return { reason: 'Connection' } as const;
    case 'TIMEOUT':
      return { reason: 'Timeout' } as const;
    case 'NOT_FOUND':
      return { reason: 'NotFound', message: error.message } as const;
    case 'VALIDATION':
      return { reason: 'Validation', message: error.message } as const;
    case 'CONFLICT':
      return { reason: 'Conflict', message: error.message } as const;
    case 'REJECTED':
      return { reason: 'Rejected', message: error.message } as const;
    case 'SERVER':
      return { reason: 'Server' } as const;
    case 'BAD_DATA':
    case 'UNKNOWN':
      return { reason: 'Unexpected', message: error.message } as const;
    default: {
      const _exhaustive: never = error.code;
      return _exhaustive;
    }
  }
}

function deleteFromAppError(error: AppError): DeleteReportsError {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return { reason: 'Connection' } as const;
    case 'TIMEOUT':
      return { reason: 'Timeout' } as const;
    case 'CONFLICT':
      return { reason: 'Conflict', message: error.message } as const;
    case 'REJECTED':
      return { reason: 'Rejected', message: error.message } as const;
    case 'SERVER':
      return { reason: 'Server' } as const;
    case 'NOT_FOUND':
    case 'VALIDATION':
    case 'BAD_DATA':
    case 'UNKNOWN':
      return { reason: 'Unexpected', message: error.message } as const;
    default: {
      const _exhaustive: never = error.code;
      return _exhaustive;
    }
  }
}

/** GET /api/reports — delivered only, paged. */
export async function listReportsService(
  params: ListReportsParams = {},
): Promise<Result<ListReportsResponse, ListReportsError>> {
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;
  const offset = params.offset ?? 0;

  const response = await api.get<unknown>('/api/reports', {
    params: { limit, offset },
  });
  if (response.isErr()) {
    return err(listFromAppError(response.error));
  }

  const parsed = listReportsResponseSchema.safeParse(response.value);
  if (!parsed.success) {
    return err({ reason: 'InvalidData', details: parsed.error } as const);
  }

  return ok({
    reports: parsed.data.reports ?? [],
    total: parsed.data.total,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    hasMore: parsed.data.hasMore,
  });
}

export async function getReportService(
  reportId: string,
): Promise<Result<Report, GetReportError>> {
  const id = reportId.trim();
  if (!id) {
    return err({
      reason: 'Validation',
      message: 'Report id is required',
    } as const);
  }

  const response = await api.get<unknown>(
    `/api/reports/${encodeURIComponent(id)}`,
  );
  if (response.isErr()) {
    return err(getFromAppError(response.error));
  }

  const parsed = getReportResponseSchema.safeParse(response.value);
  if (!parsed.success) {
    return err({ reason: 'InvalidData', details: parsed.error } as const);
  }

  return ok(parsed.data.report);
}

export async function deleteReportsService(): Promise<
  Result<{ ok: boolean; removedReports: number }, DeleteReportsError>
> {
  const response = await api.delete<unknown>('/api/reports');
  if (response.isErr()) {
    return err(deleteFromAppError(response.error));
  }

  const parsed = resetReportsResponseSchema.safeParse(response.value);
  if (!parsed.success) {
    return err({ reason: 'InvalidData', details: parsed.error } as const);
  }

  return ok(parsed.data);
}
