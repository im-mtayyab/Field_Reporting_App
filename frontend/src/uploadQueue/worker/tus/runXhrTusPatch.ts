import { useUploadProgress } from '../../../store/uploadProgress';
import { uploadTaskRegistry } from '../../native/uploadTaskRegistry';
import { logSync } from '../../repository/syncLog.repository';
import { uploadQueueRepository } from '../../repository/uploadQueue.repository';
import { publishUploadProgress } from './publishUploadProgress';
import type { TusPatchResult } from './runNativeTusPatch';

function patchOneTusChunk(input: {
  uploadUrl: string;
  accessToken: string;
  apikey: string;
  offset: number;
  body: ArrayBuffer;
  onProgress: (absoluteBytes: number) => void;
  isAborted: () => boolean;
  setXhr: (xhr: XMLHttpRequest | null) => void;
}): Promise<
  | { ok: true; nextOffset: number }
  | { ok: false; message: string; cancelled?: boolean }
> {
  return new Promise((resolve) => {
    if (input.isAborted()) {
      resolve({ ok: false, message: 'Paused', cancelled: true });
      return;
    }

    const xhr = new XMLHttpRequest();
    input.setXhr(xhr);
    xhr.open('PATCH', input.uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${input.accessToken}`);
    xhr.setRequestHeader('apikey', input.apikey);
    xhr.setRequestHeader('Tus-Resumable', '1.0.0');
    xhr.setRequestHeader('Upload-Offset', String(input.offset));
    xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');

    xhr.upload.onprogress = (event) => {
      const loaded = event.loaded || 0;
      input.onProgress(input.offset + loaded);
    };

    xhr.onload = () => {
      input.setXhr(null);
      if (input.isAborted()) {
        resolve({ ok: false, message: 'Paused', cancelled: true });
        return;
      }
      const code = xhr.status;
      if (code >= 200 && code < 300) {
        const headerOffset = Number.parseInt(
          xhr.getResponseHeader('Upload-Offset') ?? '',
          10,
        );
        const nextOffset = Number.isFinite(headerOffset)
          ? headerOffset
          : input.offset + input.body.byteLength;
        resolve({ ok: true, nextOffset });
        return;
      }
      resolve({
        ok: false,
        message: `TUS PATCH failed with HTTP ${code}`,
      });
    };

    xhr.onerror = () => {
      input.setXhr(null);
      resolve({ ok: false, message: 'Network error during upload' });
    };

    xhr.onabort = () => {
      input.setXhr(null);
      resolve({ ok: false, message: 'Paused', cancelled: true });
    };

    xhr.send(input.body);
  });
}

/**
 * PATCH remaining bytes via XHR (resume and/or configurable chunk size).
 * Native background upload always streams the full file — wrong for offset > 0
 * and cannot honor Test tools chunk size. Caps at ≤5MB so memory is fine.
 */
export function runXhrTusPatch(input: {
  jobId: string;
  attachmentId: string;
  fileName: string;
  reportId: string;
  uploadUrl: string;
  sourceUri: string;
  accessToken: string;
  apikey: string;
  offset: number;
  sizeBytes: number;
  /** 0 = send remaining in one PATCH. */
  chunkBytes: number;
}): Promise<TusPatchResult> {
  return new Promise((resolve) => {
    let settled = false;
    let xhr: XMLHttpRequest | null = null;

    const finish = (result: TusPatchResult) => {
      if (settled) {
        return;
      }
      settled = true;
      uploadTaskRegistry.delete(input.jobId);
      resolve(result);
    };

    publishUploadProgress(
      input.attachmentId,
      input.fileName,
      input.offset,
      input.sizeBytes,
    );

    uploadTaskRegistry.bind(input.jobId, input.attachmentId);
    uploadTaskRegistry.setAbort(input.jobId, {
      abort: (reason) => {
        uploadTaskRegistry.markUserStopped(input.attachmentId);
        try {
          xhr?.abort();
        } catch {
          // ignore
        }
        finish({
          ok: false,
          message: reason === 'paused' ? 'Paused' : 'Cancelled',
          cancelled: true,
        });
      },
    });

    void (async () => {
      try {
        const fileRes = await fetch(input.sourceUri);
        if (!fileRes.ok) {
          finish({
            ok: false,
            message: `Could not read photo (${fileRes.status})`,
          });
          return;
        }
        const buffer = await fileRes.arrayBuffer();
        if (buffer.byteLength < input.offset) {
          finish({
            ok: false,
            message: 'Photo on disk is smaller than the server offset',
          });
          return;
        }

        let offset = input.offset;
        const chunkLimit =
          input.chunkBytes > 0 ? input.chunkBytes : Number.POSITIVE_INFINITY;

        await logSync({
          reportId: input.reportId,
          attachmentId: input.attachmentId,
          event: 'upload_begin',
          message:
            input.chunkBytes > 0
              ? `Chunked PATCH from ${offset} (chunk=${input.chunkBytes} bytes)`
              : `PATCH from offset ${offset} (${buffer.byteLength - offset} bytes left)`,
          level: 'info',
        });

        while (offset < input.sizeBytes) {
          if (uploadTaskRegistry.isUserStopped(input.attachmentId)) {
            finish({
              ok: false,
              message: 'Paused',
              cancelled: true,
            });
            return;
          }

          const end = Math.min(
            input.sizeBytes,
            offset + chunkLimit,
            buffer.byteLength,
          );
          const body = buffer.slice(offset, end);
          if (body.byteLength === 0) {
            break;
          }

          const chunkResult = await patchOneTusChunk({
            uploadUrl: input.uploadUrl,
            accessToken: input.accessToken,
            apikey: input.apikey,
            offset,
            body,
            onProgress: (absolute) => {
              publishUploadProgress(
                input.attachmentId,
                input.fileName,
                Math.min(input.sizeBytes, absolute),
                input.sizeBytes,
              );
            },
            isAborted: () =>
              uploadTaskRegistry.isUserStopped(input.attachmentId),
            setXhr: (next) => {
              xhr = next;
            },
          });

          if (!chunkResult.ok) {
            finish(chunkResult);
            return;
          }

          offset = Math.max(offset + body.byteLength, chunkResult.nextOffset);
          await uploadQueueRepository.updateAttachment(input.attachmentId, {
            uploadOffset: offset,
          });
          useUploadProgress
            .getState()
            .setTrustedProgress(input.attachmentId, offset, input.sizeBytes);
        }

        useUploadProgress
          .getState()
          .markComplete(input.attachmentId, input.sizeBytes);
        finish({ ok: true });
      } catch (error) {
        finish({
          ok: false,
          message:
            error instanceof Error ? error.message : 'Resume upload failed',
        });
      }
    })();
  });
}
