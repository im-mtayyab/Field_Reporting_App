import { listReportsService } from '../../services/reportService/reportService';
import type { ListReportsParams, Report } from '../../types/report';

export type ListReportsActionResult =
  | {
      ok: true;
      reports: Report[];
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    }
  | {
      ok: false;
      message: string;
      details?: unknown;
      retryable: boolean;
    };

/** Load a page of delivered reports for the Reports tab. */
export async function listReportsAction(
  params: ListReportsParams = {},
): Promise<ListReportsActionResult> {
  const res = await listReportsService(params);

  return res.match(
    (page) => ({
      ok: true as const,
      reports: page.reports,
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      hasMore: page.hasMore,
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
