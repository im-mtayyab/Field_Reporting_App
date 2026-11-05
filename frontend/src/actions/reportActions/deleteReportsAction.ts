import { deleteReportsService } from '../../services/reportService';

export type DeleteReportsActionResult =
  | { ok: true; removedReports: number }
  | {
      ok: false;
      message: string;
      details?: unknown;
      retryable: boolean;
    };

/** Removes all reports on the server (development and reset tooling). */
export async function deleteReportsAction(): Promise<DeleteReportsActionResult> {
  const res = await deleteReportsService();

  return res.match(
    (data) => ({
      ok: true as const,
      removedReports: data.removedReports,
    }),
    (error) => {
      const reason = error.reason;
      switch (reason) {
        case 'InvalidData':
          return {
            ok: false as const,
            message: 'The server returned an unexpected response.',
            details: error.details,
            retryable: true,
          };
        case 'Connection':
          return {
            ok: false as const,
            message:
              'Unable to reach the server. Please check your network connection and try again.',
            retryable: true,
          };
        case 'Timeout':
          return {
            ok: false as const,
            message:
              'The server did not respond in time. Please try again shortly.',
            retryable: true,
          };
        case 'Conflict':
          return {
            ok: false as const,
            message:
              error.message ||
              'This request conflicts with data already stored on the server.',
            retryable: false,
          };
        case 'Rejected':
          return {
            ok: false as const,
            message:
              error.message || 'The server declined this delete request.',
            retryable: false,
          };
        case 'Server':
          return {
            ok: false as const,
            message:
              'The server encountered an error. Please try again in a moment.',
            retryable: true,
          };
        case 'Unexpected':
          return {
            ok: false as const,
            message:
              error.message ||
              'An unexpected error occurred. Please try again.',
            retryable: true,
          };
        default:
          throw new Error(`Unhandled error: ${reason satisfies never}`);
      }
    },
  );
}
