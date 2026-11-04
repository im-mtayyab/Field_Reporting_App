import { deleteReportsService } from '../../services/reportService/reportService';

export type DeleteReportsActionResult =
  | { ok: true; removedReports: number }
  | {
      ok: false;
      message: string;
      details?: unknown;
      retryable: boolean;
    };

/** Wipe all reports on the server (dev/reset). */
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
            message: 'Got an unexpected response from the server.',
            details: error.details,
            retryable: true,
          };
        case 'Connection':
          return {
            ok: false as const,
            message:
              'Cannot reach the server. Check Wi‑Fi or that the API is running.',
            retryable: true,
          };
        case 'Timeout':
          return {
            ok: false as const,
            message: 'The server took too long to respond. Try again.',
            retryable: true,
          };
        case 'Conflict':
          return {
            ok: false as const,
            message:
              error.message ||
              'This conflicts with data already on the server.',
            retryable: false,
          };
        case 'Rejected':
          return {
            ok: false as const,
            message: error.message || 'The server refused this delete.',
            retryable: false,
          };
        case 'Server':
          return {
            ok: false as const,
            message: 'The server hit an error. You can retry in a moment.',
            retryable: true,
          };
        case 'Unexpected':
          return {
            ok: false as const,
            message: error.message || 'Something went wrong. Please try again.',
            retryable: true,
          };
        default:
          throw new Error(`Unhandled error: ${reason satisfies never}`);
      }
    },
  );
}
