import { getFileSize } from 'react-native-compressor';

import {
  completeAttachmentService,
  createUploadSessionService,
  failAttachmentService,
} from '../../services/attachmentService';
import {
  bindAttachmentToReport,
  clearUploadProgressNotification,
  notifyUploadFailed,
  notifyUploadSuccess,
} from '../../services/notifyService';
import {
  createTusLocation,
  headTusUpload,
  toNativePath,
} from '../../services/uploadService';
import { getUploadChunkBytes } from '../../store/testerSettings';
import { useUploadProgress } from '../../store/uploadProgress';
import {
  UploadAttachmentStatus,
  type UploadAttachment,
} from '../../types/uploadQueue';
import { uploadTaskRegistry } from '../native/uploadTaskRegistry';
import { logSync } from '../repository/syncLog.repository';
import { uploadQueueRepository } from '../repository/uploadQueue.repository';
import { toUserUploadMessage } from '../utils/userUploadMessage';
import { runNativeTusPatch } from './tus/runNativeTusPatch';
import { runXhrTusPatch } from './tus/runXhrTusPatch';

export type UploadAttachmentResult =
  | { ok: true }
  | { ok: false; message: string; retryable: boolean; cancelled?: boolean };

async function measureFileBytes(uri: string, fallback: number): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    if (Number.isFinite(size) && size > 0) {
      return size;
    }
  } catch {
    // fall through
  }
  return fallback > 0 ? fallback : 0;
}

function isAlreadyUploadedError(message: string): boolean {
  return /already uploaded|already complete|already exists|conflict/i.test(
    message,
  );
}

async function currentAttachmentStatus(
  reportId: string,
  attachmentId: string,
): Promise<UploadAttachmentStatus | null> {
  const report = await uploadQueueRepository.getReport(reportId);
  return (
    report?.attachments.find((item) => item.id === attachmentId)?.status ?? null
  );
}

async function markUploadFailed(input: {
  reportId: string;
  attachmentId: string;
  fileName: string;
  rawMessage: string;
  event: string;
  clearProgress?: boolean;
  notifyServer?: boolean;
  patch?: Parameters<typeof uploadQueueRepository.updateAttachment>[1];
}): Promise<UploadAttachmentResult> {
  const message = toUserUploadMessage(input.rawMessage);
  await uploadQueueRepository.updateAttachment(input.attachmentId, {
    status: UploadAttachmentStatus.Failed,
    lastError: message,
    ...input.patch,
  });
  if (input.notifyServer !== false) {
    await failAttachmentService(
      input.reportId,
      input.attachmentId,
      input.rawMessage,
    );
  }
  notifyUploadFailed(input.fileName, message, input.attachmentId);
  if (input.clearProgress) {
    useUploadProgress.getState().clear(input.attachmentId);
  }
  await logSync({
    reportId: input.reportId,
    attachmentId: input.attachmentId,
    event: input.event,
    message: input.rawMessage,
    level: 'error',
  });
  return { ok: false, message, retryable: true };
}

export async function uploadAttachment(
  reportId: string,
  attachment: UploadAttachment,
): Promise<UploadAttachmentResult> {
  uploadTaskRegistry.clearUserStopped(attachment.id);
  bindAttachmentToReport(attachment.id, reportId);

  await logSync({
    reportId,
    attachmentId: attachment.id,
    event: 'attachment_upload_start',
    message: `Uploading ${attachment.fileName}`,
    level: 'info',
  });

  await uploadQueueRepository.updateAttachment(attachment.id, {
    status: UploadAttachmentStatus.Uploading,
    attemptCount: attachment.attemptCount + 1,
    lastError: null,
  });

  const sizeBytes = await measureFileBytes(
    attachment.localUri,
    attachment.sizeBytes,
  );
  if (!(sizeBytes > 0)) {
    return markUploadFailed({
      reportId,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      rawMessage: `Source file not found uri=${attachment.localUri}`,
      event: 'upload_source_missing',
    });
  }

  if (sizeBytes !== attachment.sizeBytes) {
    await uploadQueueRepository.updateAttachment(attachment.id, { sizeBytes });
  }

  const session = await createUploadSessionService(reportId, attachment.id);
  if (session.isErr()) {
    const raw =
      'message' in session.error
        ? session.error.message
        : `upload-session failed (${session.error.reason})`;

    if (isAlreadyUploadedError(raw)) {
      await uploadQueueRepository.updateAttachment(attachment.id, {
        status: UploadAttachmentStatus.Uploaded,
        lastError: null,
        uploadOffset: sizeBytes,
        sizeBytes,
      });
      useUploadProgress.getState().markComplete(attachment.id, sizeBytes);
      await logSync({
        reportId,
        attachmentId: attachment.id,
        event: 'attachment_uploaded',
        message: `${attachment.fileName} already on server`,
        level: 'success',
      });
      return { ok: true };
    }

    return markUploadFailed({
      reportId,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      rawMessage: raw,
      event: 'upload_session_failed',
    });
  }

  const tus = session.value;
  await uploadQueueRepository.updateAttachment(attachment.id, {
    accessToken: tus.accessToken,
    objectPath: tus.objectPath,
  });

  await logSync({
    reportId,
    attachmentId: attachment.id,
    event: 'upload_session_ok',
    message: `Upload session ready (disk=${sizeBytes}, session=${tus.sizeBytes})`,
    level: 'info',
  });

  // Upload-Length MUST match the bytes on disk.
  const uploadLength = sizeBytes;

  let uploadUrl = attachment.uploadUrl;
  let offset = 0;

  // Resume path: validate existing Location and trust server Upload-Offset.
  if (uploadUrl) {
    const head = await headTusUpload({
      uploadUrl,
      accessToken: tus.accessToken,
      apikey: tus.apikey,
    });
    if (head.ok) {
      offset = head.offset;
      await uploadQueueRepository.updateAttachment(attachment.id, {
        uploadOffset: offset,
      });
      useUploadProgress
        .getState()
        .setTrustedProgress(attachment.id, offset, uploadLength);
      await logSync({
        reportId,
        attachmentId: attachment.id,
        event: 'tus_head_ok',
        message: `Trusted Upload-Offset=${offset} length=${head.length ?? uploadLength}`,
        level: 'info',
      });

      if (offset >= uploadLength) {
        useUploadProgress.getState().markComplete(attachment.id, uploadLength);
        await logSync({
          reportId,
          attachmentId: attachment.id,
          event: 'tus_already_complete',
          message: `${attachment.fileName} TUS offset already at length`,
          level: 'info',
        });
        const completeEarly = await completeAttachmentService(
          reportId,
          attachment.id,
        );
        if (
          completeEarly.isOk() ||
          (completeEarly.isErr() &&
            isAlreadyUploadedError(
              'message' in completeEarly.error
                ? completeEarly.error.message
                : '',
            ))
        ) {
          await uploadQueueRepository.updateAttachment(attachment.id, {
            status: UploadAttachmentStatus.Uploaded,
            lastError: null,
            uploadOffset: uploadLength,
            sizeBytes: uploadLength,
          });
          notifyUploadSuccess(attachment.fileName, attachment.id);
          await logSync({
            reportId,
            attachmentId: attachment.id,
            event: 'attachment_uploaded',
            message: `${attachment.fileName} already complete on TUS`,
            level: 'success',
          });
          return { ok: true };
        }
        const raw =
          completeEarly.isErr() && 'message' in completeEarly.error
            ? completeEarly.error.message
            : 'complete failed';
        return markUploadFailed({
          reportId,
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          rawMessage: raw,
          event: 'complete_failed',
          notifyServer: false,
          patch: { uploadOffset: uploadLength },
        });
      }
    } else {
      await logSync({
        reportId,
        attachmentId: attachment.id,
        event: 'tus_head_miss',
        message: head.message,
        level: 'warn',
      });
      uploadUrl = null;
      offset = 0;
      await uploadQueueRepository.updateAttachment(attachment.id, {
        uploadUrl: null,
        uploadOffset: 0,
      });
    }
  }

  if (!uploadUrl) {
    const created = await createTusLocation({
      uploadEndpoint: tus.uploadEndpoint,
      accessToken: tus.accessToken,
      apikey: tus.apikey,
      bucket: tus.bucket,
      objectPath: tus.objectPath,
      contentType: tus.contentType || attachment.contentType,
      sizeBytes: uploadLength,
    });
    if ('error' in created) {
      return markUploadFailed({
        reportId,
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        rawMessage: created.error,
        event: 'tus_create_failed',
      });
    }
    uploadUrl = created.location;
    offset = 0;
    await uploadQueueRepository.updateAttachment(attachment.id, {
      uploadUrl,
      uploadOffset: 0,
    });
  }

  const jobId = `${uploadTaskRegistry.jobIdForAttachment(attachment.id)}_${Date.now()}`;
  await uploadQueueRepository.updateAttachment(attachment.id, {
    uploadJobId: jobId,
  });

  const source = toNativePath(attachment.localUri);
  await logSync({
    reportId,
    attachmentId: attachment.id,
    event: 'upload_source',
    message: `source=${source} size=${uploadLength} offset=${offset}`,
    level: 'info',
  });

  const chunkBytes = getUploadChunkBytes();
  // Auto + offset 0 → native background full-file PATCH.
  // Any resume offset or explicit chunk size → XHR (supports slicing).
  const patch =
    offset > 0 || chunkBytes > 0
      ? await runXhrTusPatch({
          jobId,
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          reportId,
          uploadUrl,
          sourceUri: attachment.localUri,
          accessToken: tus.accessToken,
          apikey: tus.apikey,
          offset,
          sizeBytes: uploadLength,
          chunkBytes,
        })
      : await runNativeTusPatch({
          jobId,
          attachmentId: attachment.id,
          fileName: attachment.fileName,
          reportId,
          uploadUrl,
          source,
          accessToken: tus.accessToken,
          apikey: tus.apikey,
          offset: 0,
          sizeBytes: uploadLength,
        });

  const statusAfterPatch = await currentAttachmentStatus(
    reportId,
    attachment.id,
  );
  const patchCancelled = !patch.ok && Boolean(patch.cancelled);
  const stoppedByUser =
    patchCancelled ||
    uploadTaskRegistry.isUserStopped(attachment.id) ||
    statusAfterPatch === UploadAttachmentStatus.Paused ||
    statusAfterPatch === UploadAttachmentStatus.Cancelled;

  if (!patch.ok) {
    if (patchCancelled || stoppedByUser) {
      clearUploadProgressNotification(attachment.id);
      // Pause/cancel already wrote status — do not overwrite with Failed/Uploaded.
      return {
        ok: false,
        message: patch.message,
        retryable: true,
        cancelled: true,
      };
    }
    return markUploadFailed({
      reportId,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      rawMessage: patch.message,
      event: 'tus_patch_failed',
      clearProgress: true,
    });
  }

  // Native "done" raced after Pause — honor the user's pause, do not complete.
  if (stoppedByUser) {
    return {
      ok: false,
      message: 'Paused',
      retryable: true,
      cancelled: true,
    };
  }

  const complete = await completeAttachmentService(reportId, attachment.id);
  if (complete.isErr()) {
    const raw =
      'message' in complete.error
        ? complete.error.message
        : `complete failed (${complete.error.reason})`;

    // Server already has this photo — treat as success (idempotent retry).
    if (isAlreadyUploadedError(raw)) {
      await uploadQueueRepository.updateAttachment(attachment.id, {
        status: UploadAttachmentStatus.Uploaded,
        lastError: null,
        uploadOffset: uploadLength,
        sizeBytes: uploadLength,
      });
      useUploadProgress.getState().markComplete(attachment.id, uploadLength);
      await logSync({
        reportId,
        attachmentId: attachment.id,
        event: 'attachment_uploaded',
        message: `${attachment.fileName} already on server`,
        level: 'success',
      });
      return { ok: true };
    }

    // User paused while complete was in flight.
    if (
      uploadTaskRegistry.isUserStopped(attachment.id) ||
      (await currentAttachmentStatus(reportId, attachment.id)) ===
        UploadAttachmentStatus.Paused
    ) {
      return {
        ok: false,
        message: 'Paused',
        retryable: true,
        cancelled: true,
      };
    }

    return markUploadFailed({
      reportId,
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      rawMessage: raw,
      event: 'complete_failed',
      clearProgress: true,
      notifyServer: false,
    });
  }

  // Final guard — never overwrite Pause/Cancel with Uploaded.
  const statusBeforeComplete = await currentAttachmentStatus(
    reportId,
    attachment.id,
  );
  if (
    uploadTaskRegistry.isUserStopped(attachment.id) ||
    statusBeforeComplete === UploadAttachmentStatus.Paused ||
    statusBeforeComplete === UploadAttachmentStatus.Cancelled
  ) {
    return {
      ok: false,
      message: 'Paused',
      retryable: true,
      cancelled: true,
    };
  }

  await uploadQueueRepository.updateAttachment(attachment.id, {
    status: UploadAttachmentStatus.Uploaded,
    lastError: null,
    uploadOffset: uploadLength,
    sizeBytes: uploadLength,
  });
  useUploadProgress.getState().markComplete(attachment.id, uploadLength);

  notifyUploadSuccess(attachment.fileName, attachment.id);
  await logSync({
    reportId,
    attachmentId: attachment.id,
    event: 'attachment_uploaded',
    message: `Uploaded ${attachment.fileName} (${uploadLength} bytes)`,
    level: 'success',
  });

  return { ok: true };
}
