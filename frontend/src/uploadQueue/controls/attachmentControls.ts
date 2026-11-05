import { ensureDbReady } from '../../db';
import { useUploadProgress } from '../../store/uploadProgress';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadAttachment,
  type UploadReport,
} from '../../types/uploadQueue';
import {
  uploadTaskRegistry,
  type UploadAbortReason,
} from '../native/uploadTaskRegistry';
import { logSync } from '../repository/syncLog.repository';
import { uploadQueueRepository } from '../repository/uploadQueue.repository';
import { processQueue } from '../worker/processQueue';

type ControlResult = { ok: true } | { ok: false; message: string };

async function loadAttachment(
  reportId: string,
  attachmentId: string,
): Promise<
  | { ok: true; report: UploadReport; attachment: UploadAttachment }
  | { ok: false; message: string }
> {
  await ensureDbReady();
  const report = await uploadQueueRepository.getReport(reportId);
  const attachment = report?.attachments.find((item) => item.id === attachmentId);
  if (!report || !attachment) {
    return { ok: false, message: 'Photo not found' };
  }
  return { ok: true, report, attachment };
}

function resolveJobId(
  attachmentId: string,
  storedJobId: string | null,
): string | null {
  return (
    storedJobId ||
    uploadTaskRegistry.getJobIdForAttachment(attachmentId) ||
    null
  );
}

function freezeProgressBar(attachment: UploadAttachment): {
  offset: number;
  total: number;
} {
  const live = useUploadProgress.getState().byAttachmentId[attachment.id];
  const offset = live?.bytesUploaded ?? attachment.uploadOffset ?? 0;
  const total = live?.bytesTotal || attachment.sizeBytes || 1;
  useUploadProgress.getState().setProgress(attachment.id, offset, total);
  return { offset, total };
}

async function stopNativeJob(
  attachmentId: string,
  storedJobId: string | null,
  reason: UploadAbortReason,
  options?: { deleteTask?: boolean },
): Promise<void> {
  uploadTaskRegistry.markUserStopped(attachmentId);
  const jobId = resolveJobId(attachmentId, storedJobId);
  if (!jobId) {
    return;
  }

  uploadTaskRegistry.abort(jobId, reason);
  try {
    await uploadTaskRegistry.get(jobId)?.stop();
  } catch {
    // Native stop is best-effort.
  }
  if (options?.deleteTask) {
    uploadTaskRegistry.delete(jobId);
  }
}

async function refreshReportStatus(reportId: string): Promise<void> {
  const report = await uploadQueueRepository.getReport(reportId);
  if (!report) {
    return;
  }

  const { attachments } = report;
  const allUploaded = attachments.every(
    (item) => item.status === UploadAttachmentStatus.Uploaded,
  );
  if (allUploaded) {
    await uploadQueueRepository.updateReport(reportId, {
      status: UploadReportStatus.Delivered,
      lastError: null,
    });
    return;
  }

  const anyUploading = attachments.some(
    (item) => item.status === UploadAttachmentStatus.Uploading,
  );
  if (anyUploading) {
    await uploadQueueRepository.updateReport(reportId, {
      status: UploadReportStatus.Uploading,
      lastError: null,
    });
    return;
  }

  const anyFailed = attachments.some(
    (item) => item.status === UploadAttachmentStatus.Failed,
  );
  const anyCancelled = attachments.some(
    (item) => item.status === UploadAttachmentStatus.Cancelled,
  );
  const anyPaused = attachments.some(
    (item) => item.status === UploadAttachmentStatus.Paused,
  );

  if (anyPaused && !anyFailed && !anyCancelled) {
    await uploadQueueRepository.updateReport(reportId, {
      status: UploadReportStatus.Uploading,
      lastError: null,
    });
    return;
  }

  if (anyFailed || anyCancelled) {
    await uploadQueueRepository.updateReport(reportId, {
      status: UploadReportStatus.Failed,
      lastError: null,
    });
  }
}

export async function pauseAttachmentUpload(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  const loaded = await loadAttachment(reportId, attachmentId);
  if (!loaded.ok) {
    return loaded;
  }
  const { attachment } = loaded;

  if (
    attachment.status === UploadAttachmentStatus.Uploaded ||
    attachment.status === UploadAttachmentStatus.Paused
  ) {
    return { ok: true };
  }

  const { offset } = freezeProgressBar(attachment);
  await stopNativeJob(attachmentId, attachment.uploadJobId, 'paused');

  await uploadQueueRepository.updateAttachment(attachmentId, {
    status: UploadAttachmentStatus.Paused,
    lastError: null,
    uploadOffset: offset,
    uploadJobId: null,
  });
  await logSync({
    reportId,
    attachmentId,
    event: 'attachment_paused',
    message: `Paused ${attachment.fileName}`,
    level: 'warn',
  });
  await refreshReportStatus(reportId);
  return { ok: true };
}

export async function resumeAttachmentUpload(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  const loaded = await loadAttachment(reportId, attachmentId);
  if (!loaded.ok) {
    return loaded;
  }
  const { attachment } = loaded;

  if (attachment.status === UploadAttachmentStatus.Uploaded) {
    await refreshReportStatus(reportId);
    return { ok: true };
  }

  await stopNativeJob(attachmentId, attachment.uploadJobId, 'cancelled', {
    deleteTask: true,
  });
  uploadTaskRegistry.clearUserStopped(attachmentId);

  const live = useUploadProgress.getState().byAttachmentId[attachmentId];
  const keepOffset = Math.max(
    0,
    live?.bytesUploaded ?? attachment.uploadOffset ?? 0,
  );
  const keepTotal = Math.max(
    attachment.sizeBytes || 0,
    live?.bytesTotal || 0,
    keepOffset,
    1,
  );
  useUploadProgress
    .getState()
    .setTrustedProgress(attachmentId, keepOffset, keepTotal);

  await uploadQueueRepository.updateAttachment(attachmentId, {
    status: UploadAttachmentStatus.Pending,
    lastError: null,
    uploadJobId: null,
    uploadOffset: keepOffset,
  });
  await logSync({
    reportId,
    attachmentId,
    event: 'attachment_resumed',
    message: `Resume ${attachment.fileName} (url=${attachment.uploadUrl ? 'kept' : 'none'}, offset=${keepOffset})`,
    level: 'info',
  });
  await uploadQueueRepository.updateReport(reportId, {
    status: UploadReportStatus.Pending,
    lastError: null,
  });

  void processQueue();
  return { ok: true };
}

export async function cancelAttachmentUpload(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  const loaded = await loadAttachment(reportId, attachmentId);
  if (!loaded.ok) {
    return loaded;
  }
  const { attachment } = loaded;

  if (attachment.status === UploadAttachmentStatus.Uploaded) {
    return { ok: true };
  }

  const { offset } = freezeProgressBar(attachment);
  await stopNativeJob(attachmentId, attachment.uploadJobId, 'cancelled', {
    deleteTask: true,
  });

  await uploadQueueRepository.updateAttachment(attachmentId, {
    status: UploadAttachmentStatus.Cancelled,
    lastError: null,
    uploadOffset: offset,
    uploadJobId: null,
    uploadUrl: null,
  });
  await logSync({
    reportId,
    attachmentId,
    event: 'attachment_cancelled',
    message: `Cancelled ${attachment.fileName}`,
    level: 'warn',
  });
  await refreshReportStatus(reportId);
  return { ok: true };
}

/** Manual retry for a failed report (create or files). Never automatic. */
export async function retryFailedReport(
  reportId: string,
): Promise<ControlResult> {
  await ensureDbReady();
  const report = await uploadQueueRepository.getReport(reportId);
  if (!report) {
    return { ok: false, message: 'Report not found' };
  }

  for (const attachment of report.attachments) {
    const retryable =
      attachment.status === UploadAttachmentStatus.Failed ||
      attachment.status === UploadAttachmentStatus.Cancelled ||
      attachment.status === UploadAttachmentStatus.Paused;
    if (!retryable) {
      continue;
    }

    uploadTaskRegistry.clearUserStopped(attachment.id);
    const dropUrl = attachment.status === UploadAttachmentStatus.Cancelled;
    await uploadQueueRepository.updateAttachment(attachment.id, {
      status: UploadAttachmentStatus.Pending,
      lastError: null,
      uploadJobId: null,
      ...(dropUrl
        ? { uploadUrl: null, uploadOffset: 0 }
        : { uploadOffset: Math.max(0, attachment.uploadOffset ?? 0) }),
    });
  }

  await uploadQueueRepository.updateReport(reportId, {
    status: UploadReportStatus.Pending,
    lastError: null,
  });
  await logSync({
    reportId,
    event: 'report_retry',
    message: 'Manual retry',
    level: 'info',
  });
  return { ok: true };
}

export async function retryAttachmentUpload(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  const loaded = await loadAttachment(reportId, attachmentId);
  if (!loaded.ok) {
    return loaded;
  }
  const { attachment } = loaded;

  if (attachment.status === UploadAttachmentStatus.Uploaded) {
    await refreshReportStatus(reportId);
    return { ok: true };
  }

  await stopNativeJob(attachmentId, attachment.uploadJobId, 'cancelled', {
    deleteTask: true,
  });
  uploadTaskRegistry.clearUserStopped(attachmentId);

  const dropUrl = attachment.status === UploadAttachmentStatus.Cancelled;
  const live = useUploadProgress.getState().byAttachmentId[attachmentId];
  const keepOffset = dropUrl
    ? 0
    : Math.max(0, live?.bytesUploaded ?? attachment.uploadOffset ?? 0);

  await uploadQueueRepository.updateAttachment(attachmentId, {
    status: UploadAttachmentStatus.Pending,
    lastError: null,
    uploadJobId: null,
    ...(dropUrl
      ? { uploadUrl: null, uploadOffset: 0 }
      : { uploadOffset: keepOffset }),
  });

  if (!dropUrl && keepOffset > 0) {
    useUploadProgress
      .getState()
      .setProgress(attachmentId, keepOffset, attachment.sizeBytes || keepOffset);
  } else if (dropUrl) {
    useUploadProgress.getState().clear(attachmentId);
  }

  await logSync({
    reportId,
    attachmentId,
    event: 'attachment_retry',
    message: `Retry ${attachment.fileName} (url=${dropUrl || !attachment.uploadUrl ? 'new' : 'kept'}, offset=${keepOffset})`,
    level: 'info',
  });
  await uploadQueueRepository.updateReport(reportId, {
    status: UploadReportStatus.Pending,
    lastError: null,
  });

  void processQueue();
  return { ok: true };
}
