import { getReportService } from '../../services/reportService/reportService';
import type { Report } from '../../types/report';

export type GetReportActionResult =
  | { ok: true; report: Report }
  | {
      ok: false;
      message: string;
      details?: unknown;
      retryable: boolean;
    };

/** Load a single report by id. */
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
            message: error.message || 'That report was not found.',
            retryable: false,
          };
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
            message: error.message || 'The server refused this request.',
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
