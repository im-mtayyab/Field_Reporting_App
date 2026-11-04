import type { ZodError } from 'zod';

/** listReportsService failures */
export type ListReportsError =
  | { reason: 'InvalidData'; details: ZodError }
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message?: string };

/** getReportService failures */
export type GetReportError =
  | { reason: 'Validation'; message: string }
  | { reason: 'NotFound'; message?: string }
  | { reason: 'InvalidData'; details: ZodError }
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Conflict'; message?: string }
  | { reason: 'Rejected'; message?: string }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message?: string };

/** deleteReportsService failures */
export type DeleteReportsError =
  | { reason: 'InvalidData'; details: ZodError }
  | { reason: 'Connection' }
  | { reason: 'Timeout' }
  | { reason: 'Conflict'; message?: string }
  | { reason: 'Rejected'; message?: string }
  | { reason: 'Server' }
  | { reason: 'Unexpected'; message?: string };
