/** Encode Supabase TUS Upload-Metadata values (ASCII → base64). */
function b64(value: string): string {
  const btoaFn = (globalThis as { btoa?: (data: string) => string }).btoa;
  if (typeof btoaFn === 'function') {
    return btoaFn(value);
  }
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = Array.from(value).map((c) => c.charCodeAt(0));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += chars[(triple >> 18) & 63];
    out += chars[(triple >> 12) & 63];
    out += b === undefined ? '=' : chars[(triple >> 6) & 63];
    out += c === undefined ? '=' : chars[triple & 63];
  }
  return out;
}

/**
 * Supabase requires these exact metadata keys (not `bucket`).
 * See: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
 */
export function buildTusUploadMetadata(input: {
  bucket: string;
  objectPath: string;
  contentType: string;
}): string {
  return [
    `bucketName ${b64(input.bucket)}`,
    `objectName ${b64(input.objectPath)}`,
    `contentType ${b64(input.contentType)}`,
    `cacheControl ${b64('3600')}`,
  ].join(',');
}

/** Strip file:// so native upload APIs get a filesystem path. */
export function toNativePath(uri: string): string {
  if (uri.startsWith('file://')) {
    return decodeURIComponent(uri.replace('file://', ''));
  }
  return uri;
}
