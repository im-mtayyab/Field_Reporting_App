/**
 * Formats a byte count for upload progress labels.
 *
 * @param bytes - Size in bytes. Non-finite or non-positive values render as `0 B`.
 * @returns A human-readable size string (`B`, `KB`, or `MB`).
 */
export function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
