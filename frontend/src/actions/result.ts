import { createAppError, type AppError } from '../errors/AppError';
import { isAppError } from '../errors/mapAxiosError';

export { isAppError };

/** Normalize unknown catch values into AppError for UI boundaries. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  if (error instanceof Error) {
    return createAppError('UNKNOWN', error.message);
  }
  return createAppError('UNKNOWN', 'Unknown error');
}
