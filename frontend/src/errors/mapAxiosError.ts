import { AxiosError, isAxiosError } from 'axios';

import {
  type AppError,
  type AppErrorCode,
  createAppError,
} from './AppError';

/** Adding a new AppErrorCode without a key here is a TypeScript error. */
const CODE_FLAGS = {
  CONNECTION_ERR: true,
  TIMEOUT: true,
  NOT_FOUND: true,
  VALIDATION: true,
  CONFLICT: true,
  REJECTED: true,
  SERVER: true,
  BAD_DATA: true,
  UNKNOWN: true,
} as const satisfies Record<AppErrorCode, true>;

const KNOWN_CODES = new Set<string>(Object.keys(CODE_FLAGS));

export function isAppError(error: unknown): error is AppError {
  if (!error || typeof error !== 'object' || isAxiosError(error)) {
    return false;
  }
  const value = error as Record<string, unknown>;
  return (
    typeof value.message === 'string' &&
    typeof value.code === 'string' &&
    KNOWN_CODES.has(value.code as AppErrorCode)
  );
}

function readBody(data: unknown) {
  if (!data || typeof data !== 'object') {
    return { message: undefined as string | undefined, retryable: undefined as boolean | undefined };
  }
  const body = data as Record<string, unknown>;
  const message =
    typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : undefined;
  const retryable =
    typeof body.retryable === 'boolean' ? body.retryable : undefined;
  return { message, retryable };
}

function codeForStatus(status: number): AppErrorCode {
  if (status === 400) {
    return 'VALIDATION';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  if (status === 422) {
    return 'REJECTED';
  }
  if (status >= 500) {
    return 'SERVER';
  }
  return 'UNKNOWN';
}

export function mapAxiosError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (!isAxiosError(error)) {
    if (error instanceof Error) {
      return createAppError('UNKNOWN', error.message);
    }
    return createAppError('UNKNOWN', 'Unexpected error');
  }

  const axiosError = error as AxiosError;

  if (axiosError.code === 'ECONNABORTED') {
    return createAppError('TIMEOUT', 'Request timed out', { retryable: true });
  }

  if (!axiosError.response) {
    return createAppError('CONNECTION_ERR', 'Unable to reach the server', {
      retryable: true,
      details: axiosError.message,
    });
  }

  const status = axiosError.response.status;
  const { message, retryable } = readBody(axiosError.response.data);
  const code = codeForStatus(status);

  return createAppError(code, message || axiosError.message || 'Request failed', {
    status,
    details: axiosError.response.data,
    retryable: retryable ?? (code === 'SERVER' || code === 'TIMEOUT'),
  });
}
