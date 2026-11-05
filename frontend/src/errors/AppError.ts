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
 * Exhaustive user-facing copy for each AppErrorCode.
 * Adding a code without a matching case is a TypeScript error.
 */
export function getErrorView(error: AppError): ErrorViewModel {
  switch (error.code) {
    case 'CONNECTION_ERR':
      return {
        title: 'Unable to reach the server',
        message:
          'Please verify your network connection and that the service is available, then try again.',
        retryable: true,
      };
    case 'TIMEOUT':
      return {
        title: 'Request timed out',
        message:
          'The server did not respond in time. Please try again shortly.',
        retryable: true,
      };
    case 'NOT_FOUND':
      return {
        title: 'Not found',
        message: error.message || 'The requested report could not be found.',
        retryable: false,
      };
    case 'VALIDATION':
      return {
        title: 'Invalid request',
        message:
          error.message ||
          'One or more fields are invalid. Please review and try again.',
        retryable: false,
      };
    case 'CONFLICT':
      return {
        title: 'Conflict',
        message:
          error.message ||
          'This request conflicts with data already stored on the server.',
        retryable: false,
      };
    case 'REJECTED':
      return {
        title: 'Request declined',
        message: error.message || 'The server declined this request.',
        retryable: false,
      };
    case 'SERVER':
      return {
        title: 'Server error',
        message:
          'The server encountered an error. Please try again in a moment.',
        retryable: true,
      };
    case 'BAD_DATA':
      return {
        title: 'Unexpected response',
        message: 'The server returned an unexpected response. Please try again.',
        retryable: true,
      };
    case 'UNKNOWN':
      return {
        title: 'Something went wrong',
        message: error.message || 'An unexpected error occurred. Please try again.',
        retryable: error.retryable,
      };
    default:
      return assertNever(error.code);
  }
}

/** Short message for toasts and empty states. */
export function getErrorMessage(error: AppError): string {
  return getErrorView(error).message;
}
