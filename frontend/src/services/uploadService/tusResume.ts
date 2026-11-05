/**
 * TUS resume helpers — HEAD the Location URL and trust Upload-Offset.
 * @see https://tus.io/protocols/resumable-upload
 */

export type TusHeadResult =
  | { ok: true; offset: number; length: number | null }
  | { ok: false; reason: 'missing' | 'unauthorized' | 'error'; message: string };

export async function headTusUpload(input: {
  uploadUrl: string;
  accessToken: string;
  apikey: string;
}): Promise<TusHeadResult> {
  try {
    const response = await fetch(input.uploadUrl, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        apikey: input.apikey,
        'Tus-Resumable': '1.0.0',
        'Cache-Control': 'no-store',
      },
    });

    if (response.status === 404 || response.status === 410) {
      return {
        ok: false,
        reason: 'missing',
        message: `Upload URL gone (HTTP ${response.status})`,
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        reason: 'unauthorized',
        message: `Upload URL not authorized (HTTP ${response.status})`,
      };
    }
    if (!(response.status === 200 || response.status === 204)) {
      return {
        ok: false,
        reason: 'error',
        message: `TUS HEAD failed (HTTP ${response.status})`,
      };
    }

    const offsetRaw = response.headers.get('Upload-Offset');
    const lengthRaw = response.headers.get('Upload-Length');
    const offset = Number.parseInt(offsetRaw ?? '', 10);
    if (!Number.isFinite(offset) || offset < 0) {
      return {
        ok: false,
        reason: 'error',
        message: 'TUS HEAD missing Upload-Offset',
      };
    }

    const length = Number.parseInt(lengthRaw ?? '', 10);
    return {
      ok: true,
      offset,
      length: Number.isFinite(length) && length >= 0 ? length : null,
    };
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      message:
        error instanceof Error ? error.message : 'TUS HEAD network failed',
    };
  }
}
