import { DeviceEventEmitter, Platform } from 'react-native';
import {
  createUploadTask,
  type UploadTask,
} from '@kesha-antonov/react-native-background-downloader';

import { useUploadProgress } from '../../../store/uploadProgress';
import { ensureUploadNativeReady } from '../../native/ensureUploadNativeReady';
import { uploadTaskRegistry } from '../../native/uploadTaskRegistry';
import { logSync } from '../../repository/syncLog.repository';
import { publishUploadProgress } from './publishUploadProgress';

const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export type TusPatchResult =
  | { ok: true }
  | { ok: false; message: string; cancelled?: boolean };

/**
 * Android New Arch often fails to deliver upload events through NativeEventEmitter.
 * Prefer DeviceEventEmitter there; keep task handlers on iOS.
 */
export function runNativeTusPatch(input: {
  jobId: string;
  attachmentId: string;
  fileName: string;
  reportId: string;
  uploadUrl: string;
  source: string;
  accessToken: string;
  apikey: string;
  offset: number;
  sizeBytes: number;
}): Promise<TusPatchResult> {
  return new Promise((resolve) => {
    let settled = false;
    const subscriptions: Array<{ remove: () => void }> = [];
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      for (const sub of subscriptions) {
        sub.remove();
      }
      subscriptions.length = 0;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const finish = (result: TusPatchResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      uploadTaskRegistry.delete(input.jobId);
      resolve(result);
    };

    ensureUploadNativeReady();

    publishUploadProgress(
      input.attachmentId,
      input.fileName,
      input.offset,
      input.sizeBytes,
    );

    let task: UploadTask;
    try {
      task = createUploadTask({
        id: input.jobId,
        url: input.uploadUrl,
        source: input.source,
        method: 'PATCH',
        mimeType: 'application/offset+octet-stream',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          apikey: input.apikey,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(input.offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        metadata: {
          kind: 'tus-patch',
          attachmentId: input.attachmentId,
          reportId: input.reportId,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Background uploader unavailable';
      finish({
        ok: false,
        message: /doesn'?t seem to be linked/i.test(message)
          ? 'Uploader native module not linked. Rebuild Android (run-android).'
          : message,
      });
      return;
    }

    uploadTaskRegistry.set(input.jobId, task, input.attachmentId);
    uploadTaskRegistry.setAbort(input.jobId, {
      abort: (reason) => {
        uploadTaskRegistry.markUserStopped(input.attachmentId);
        try {
          // Always stop — pause alone often leaves native "done" racing us.
          void task.stop();
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

    const onBegin = (expectedBytes: number) => {
      const total = expectedBytes > 0 ? expectedBytes : input.sizeBytes;
      publishUploadProgress(
        input.attachmentId,
        input.fileName,
        input.offset,
        total,
      );
      void logSync({
        reportId: input.reportId,
        attachmentId: input.attachmentId,
        event: 'upload_begin',
        message: `Transfer started (${input.sizeBytes} bytes)`,
        level: 'info',
      });
    };

    const onProgress = (bytesUploaded: number, bytesTotal: number) => {
      // Native reports bytes of this PATCH body; add trusted TUS offset.
      const absolute = Math.min(
        input.sizeBytes,
        input.offset + Math.max(0, bytesUploaded),
      );
      publishUploadProgress(
        input.attachmentId,
        input.fileName,
        absolute,
        input.sizeBytes,
      );
      void bytesTotal;
    };

    const onDone = (responseCode: number) => {
      // User already paused/cancelled — ignore a late native completion event.
      if (uploadTaskRegistry.isUserStopped(input.attachmentId)) {
        finish({
          ok: false,
          message: 'Paused',
          cancelled: true,
        });
        return;
      }
      // Keep bar at 100% until SQLite status flips — clearing here caused 0% flicker.
      useUploadProgress
        .getState()
        .markComplete(input.attachmentId, input.sizeBytes);
      if (responseCode >= 200 && responseCode < 300) {
        finish({ ok: true });
      } else {
        finish({
          ok: false,
          message: `TUS PATCH failed with HTTP ${responseCode}`,
        });
      }
    };

    const onError = (error: string, errorCode: number) => {
      const cancelled =
        /cancel|paused|stopp/i.test(error || '') || errorCode === -999;
      if (!cancelled) {
        useUploadProgress.getState().clear(input.attachmentId);
      }
      finish({
        ok: false,
        message: error || `Upload error ${errorCode}`,
        cancelled,
      });
    };

    if (Platform.OS === 'android') {
      // New Arch: DeviceEventEmitter is the reliable path — skip dual task handlers.
      subscriptions.push(
        DeviceEventEmitter.addListener('uploadBegin', (data) => {
          if (data?.id !== input.jobId) {
            return;
          }
          onBegin(Number(data.expectedBytes) || input.sizeBytes);
        }),
      );
      subscriptions.push(
        DeviceEventEmitter.addListener('uploadProgress', (events) => {
          const list = Array.isArray(events) ? events : [events];
          for (const event of list) {
            if (event?.id !== input.jobId) {
              continue;
            }
            onProgress(
              Number(event.bytesUploaded) || 0,
              Number(event.bytesTotal) || input.sizeBytes,
            );
          }
        }),
      );
      subscriptions.push(
        DeviceEventEmitter.addListener('uploadComplete', (data) => {
          if (data?.id !== input.jobId) {
            return;
          }
          onDone(Number(data.responseCode) || 0);
        }),
      );
      subscriptions.push(
        DeviceEventEmitter.addListener('uploadFailed', (data) => {
          if (data?.id !== input.jobId) {
            return;
          }
          onError(String(data.error || ''), Number(data.errorCode) || 0);
        }),
      );
    } else {
      task
        .begin(({ expectedBytes }) => onBegin(expectedBytes))
        .progress(({ bytesUploaded, bytesTotal }) =>
          onProgress(bytesUploaded, bytesTotal),
        )
        .done(({ responseCode }) => onDone(responseCode))
        .error(({ error, errorCode }) => onError(error, errorCode));
    }

    timeoutId = setTimeout(() => {
      try {
        void task.stop();
      } catch {
        // ignore
      }
      finish({
        ok: false,
        message: 'Upload timed out — check API URL / network and Retry',
      });
    }, UPLOAD_TIMEOUT_MS);

    try {
      task.start();
    } catch (error) {
      finish({
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not start upload',
      });
    }
  });
}
