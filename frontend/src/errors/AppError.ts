import { assertNever } from '../utils/assertNever';

export type AppErrorCode =
  | 'CONNECTION_ERR'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'REJECTED'
  | 'SERVER'
  | 'BAD_DATA'
  | 'UNKNOWN';

export type AppError = {
  code: AppErrorCode;
  message: string;
  status?: number;
  details?: unknown;
  retryable: boolean;
};

export function createAppError(
  code: AppErrorCode,
  message: string,
  extras?: Partial<Omit<AppError, 'code' | 'message'>>,
): AppError {
  return {
    code,
    message,
    ...extras,
    retryable: extras?.retryable ?? false,
  };
}

export type ErrorViewModel = {
  title: string;
  message: string;
  retryable: boolean;
};

/**
 * Exhaustive UI copy per AppErrorCode.
 * Adding a new code (e.g. DUPLICATE) without a case is a TypeScript error.
 */
export function getErrorView(error: AppError): ErrorViewModel {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return {
        title: 'Cannot reach the server',
        message:
          'Check Wi‑Fi or that the API is running, then try again.',
        retryable: true,
      };
    case 'TIMEOUT':
      return {
        title: 'Request timed out',
        message: 'The server took too long to respond. Try again.',
        retryable: true,
      };
    case 'NOT_FOUND':
      return {
        title: 'Not found',
        message: error.message || 'That report was not found.',
        retryable: false,
      };
    case 'VALIDATION':
      return {
        title: 'Invalid request',
        message:
          error.message || 'Some fields look invalid. Check and try again.',
        retryable: false,
      };
    case 'CONFLICT':
      return {
        title: 'Conflict',
        message:
          error.message ||
          'This conflicts with data already on the server.',
        retryable: false,
      };
    case 'REJECTED':
      return {
        title: 'Rejected',
        message: error.message || 'The server refused this upload.',
        retryable: false,
      };
    case 'SERVER':
      return {
        title: 'Server error',
        message: 'The server hit an error. You can retry in a moment.',
        retryable: true,
      };
    case 'BAD_DATA':
      return {
        title: 'Unexpected response',
        message: 'Got an unexpected response from the server.',
        retryable: true,
      };
    case 'UNKNOWN':
      return {
        title: 'Something went wrong',
        message: error.message || 'Please try again.',
        retryable: error.retryable,
      };
    default:
      return assertNever(error.code);
  }
}

/** Short, specific copy for toasts / empty states (exhaustive). */
export function getErrorMessage(error: AppError): string {
  return getErrorView(error).message;
}
