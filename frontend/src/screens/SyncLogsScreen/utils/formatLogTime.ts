/**
 * Formats an ISO timestamp as a localized clock time for log rows.
 *
 * @param iso - ISO-8601 date string from the sync log store.
 * @returns A locale time string (`HH:MM:SS`), or the original value if parsing fails.
 */
export function formatLogTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
