/**
 * Formats an ISO timestamp as a short calendar date for report lists.
 *
 * @param value - ISO-8601 date string from the server or local store.
 * @returns A locale date such as `Nov 4, 2026`, or the original value if invalid.
 */
export function formatReportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
