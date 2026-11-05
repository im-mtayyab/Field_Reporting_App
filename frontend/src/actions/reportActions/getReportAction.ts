import { getReportService } from '../../services/reportService';
import type { Report } from '../../types/report';

export type GetReportActionResult =
  | { ok: true; report: Report }
  | {
      ok: false;
      message: string;
      details?: unknown;
      retryable: boolean;
    };

/** Loads a single report by id for the detail screen. */
export async function getReportAction(
  reportId: string,
): Promise<GetReportActionResult> {
  const res = await getReportService(reportId);

  return res.match(
    (report) => ({ ok: true as const, report }),
    (error) => {
      const reason = error.reason;
      switch (reason) {
        case 'Validation':
          return {
            ok: false as const,
            message: error.message,
            retryable: false,
          };
        case 'NotFound':
          return {
            ok: false as const,
            message: error.message || 'The requested report could not be found.',
            retryable: false,
          };
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
            message: error.message || 'The server declined this request.',
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
