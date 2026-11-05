/**
 * Maps a raw upload or transport error into concise, user-facing copy.
 * Technical payloads stay in sync logs, not the primary UI.
 */
export function toUserUploadMessage(
  raw: string | null | undefined,
): string {
  const message = (raw ?? '').trim();
  const lower = message.toLowerCase();

  if (!message) {
    return 'The upload could not be completed. Please retry.';
  }

  if (/already uploaded|already complete|already exists/i.test(lower)) {
    return 'This photo is already on the server.';
  }
  if (/cancel/i.test(lower) && !/paused/i.test(lower)) {
    return 'Upload cancelled.';
  }
  if (/paused/i.test(lower)) {
    return 'Upload paused.';
  }
  if (/source file not found|no such file|enoent|unreadable/i.test(lower)) {
    return 'The photo file is no longer available on this device.';
  }
  if (/timed out|timeout/i.test(lower)) {
    return 'The connection timed out. Please check your network and retry.';
  }
  if (
    /network|connection|failed to connect|unable to resolve|econnreset|enotfound|offline/i.test(
      lower,
    )
  ) {
    return 'Unable to reach the server. Please check your network and retry.';
  }
  if (
    /upload-session|session|tus create|tus-resumable|upload-length|location header/i.test(
      lower,
    )
  ) {
    return 'The upload could not be started. Please retry.';
  }
  if (/tus patch|http 4\d\d|http 5\d\d|interrupted/i.test(lower)) {
    return 'The upload was interrupted. Please retry.';
  }
  if (/not linked|native module|background uploader unavailable/i.test(lower)) {
    return 'The uploader is unavailable. Please reopen the application.';
  }
  if (/under 5 mb|too large|file size/i.test(lower)) {
    return 'This photo exceeds the maximum allowed size.';
  }
  if (/reject|forbidden|401|403/i.test(lower)) {
    return 'The server declined this upload.';
  }
  if (/conflict/i.test(lower)) {
    return 'This photo is already on the server.';
  }

  if (message.length > 60 || /https?:\/\//i.test(message) || /\{/.test(message)) {
    return 'The upload could not be completed. Please retry.';
  }

  return message;
}
