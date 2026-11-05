import {
  ALLOWED_IMAGE_TYPES,
  type AllowedImageType,
  type FormImage,
} from '../../screens/CreateScreen/createReportForm.schema';
import { compressFormImage } from '../../screens/CreateScreen/utils/prepareFormImage';
import { createReportService } from '../../services/reportService';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadAttachment,
  type UploadReport,
} from '../../types/uploadQueue';
import { logSync } from '../repository/syncLog.repository';
import { uploadQueueRepository } from '../repository/uploadQueue.repository';
import { persistUploadImage } from '../utils/persistUploadImage';
import { toUserUploadMessage } from '../utils/userUploadMessage';
import { processQueue } from '../worker/processQueue';

type PrepareResult = { ok: true } | { ok: false; message: string };

function toFormImage(attachment: UploadAttachment): FormImage {
  const raw = attachment.contentType.trim().toLowerCase();
  const normalized = (raw === 'image/jpg' ? 'image/jpeg' : raw) as AllowedImageType;
  const contentType = (ALLOWED_IMAGE_TYPES as readonly string[]).includes(
    normalized,
  )
    ? normalized
    : ('image/jpeg' as AllowedImageType);

  return {
    uri: attachment.localUri,
    fileName: attachment.fileName,
    contentType,
    sizeBytes: attachment.sizeBytes,
  };
}

function createErrorMessage(
  error: { reason: string; message?: string },
): string {
  return error.message ?? `Create failed (${error.reason})`;
}

function toCreateBody(report: UploadReport) {
  return {
    reportId: report.id,
    description: report.description,
    attachments: report.attachments.map((item) => ({
      attachmentId: item.id,
      fileName: item.fileName,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
    })),
  };
}

async function getLiveAttachment(
  reportId: string,
  attachmentId: string,
): Promise<UploadAttachment | null> {
  const report = await uploadQueueRepository.getReport(reportId);
  return report?.attachments.find((item) => item.id === attachmentId) ?? null;
}

async function isCancelled(
  reportId: string,
  attachmentId: string,
): Promise<boolean> {
  const live = await getLiveAttachment(reportId, attachmentId);
  return !live || live.status === UploadAttachmentStatus.Cancelled;
}

async function markPrepareFailed(
  reportId: string,
  attachment: UploadAttachment,
  rawMessage: string,
): Promise<string> {
  const message = toUserUploadMessage(rawMessage);
  await uploadQueueRepository.updateAttachment(attachment.id, {
    status: UploadAttachmentStatus.Failed,
    lastError: message,
    prepared: false,
  });
  await uploadQueueRepository.updateReport(reportId, {
    status: UploadReportStatus.Failed,
    lastError: message,
  });
  await logSync({
    reportId,
    attachmentId: attachment.id,
    event: 'prepare_failed',
    message,
    level: 'error',
  });
  return message;
}

/**
 * POST /reports as soon as local UUIDs exist (draft sizes OK).
 * Runs beside compress — local enqueue already finished.
 */
export async function createRemoteReportEarly(reportId: string): Promise<boolean> {
  const report = await uploadQueueRepository.getReport(reportId);
  if (!report) {
    return false;
  }
  if (report.remoteCreated) {
    return true;
  }

  await logSync({
    reportId,
    event: 'create_start',
    message: 'POST /reports (metadata, early while preparing photos)',
    level: 'info',
  });

  const result = await createReportService(toCreateBody(report));
  if (result.isErr()) {
    const message = createErrorMessage(result.error);
    await logSync({
      reportId,
      event: 'create_failed',
      message: `${message} (will retry after prepare)`,
      level: 'warn',
      meta: { reason: result.error.reason, early: true },
    });
    return false;
  }

  await uploadQueueRepository.updateReport(reportId, {
    remoteCreated: true,
    lastError: null,
  });
  await logSync({
    reportId,
    event: 'create_ok',
    message: result.value.deduped
      ? 'Report metadata deduped (early)'
      : 'Report metadata created (early)',
    level: 'success',
    meta: { deduped: result.value.deduped, early: true },
  });
  return true;
}

async function prepareOneAttachment(
  reportId: string,
  attachment: UploadAttachment,
): Promise<PrepareResult> {
  if (attachment.prepared) {
    if (attachment.status === UploadAttachmentStatus.Preparing) {
      await uploadQueueRepository.updateAttachment(attachment.id, {
        status: UploadAttachmentStatus.Pending,
      });
    }
    return { ok: true };
  }

  if (
    attachment.status === UploadAttachmentStatus.Cancelled ||
    attachment.status === UploadAttachmentStatus.Uploaded
  ) {
    return { ok: true };
  }

  await logSync({
    reportId,
    attachmentId: attachment.id,
    event: 'prepare_start',
    message: `Preparing ${attachment.fileName}`,
    level: 'info',
  });

  if (await isCancelled(reportId, attachment.id)) {
    return { ok: true };
  }

  const compressed = await compressFormImage(toFormImage(attachment));

  if (!compressed.ok) {
    const message = await markPrepareFailed(
      reportId,
      attachment,
      compressed.reason === 'too_large'
        ? 'Photo too large'
        : 'Could not prepare photo',
    );
    return { ok: false, message };
  }

  if (await isCancelled(reportId, attachment.id)) {
    return { ok: true };
  }

  try {
    const persisted = await persistUploadImage({
      reportId,
      attachmentId: attachment.id,
      sourceUri: compressed.image.uri,
      fileName: compressed.image.fileName,
      contentType: compressed.image.contentType,
      sizeBytes: compressed.image.sizeBytes,
    });

    await uploadQueueRepository.updateAttachment(attachment.id, {
      localUri: persisted.uri,
      fileName: persisted.fileName,
      contentType: persisted.contentType,
      sizeBytes: persisted.sizeBytes,
      prepared: true,
      status: UploadAttachmentStatus.Pending,
      lastError: null,
    });

    await logSync({
      reportId,
      attachmentId: attachment.id,
      event: 'prepare_ok',
      message: `Prepared ${persisted.fileName} (${persisted.sizeBytes} bytes)`,
      level: 'success',
    });

    // Kick the queue as each photo becomes upload-ready.
    void processQueue();
    return { ok: true };
  } catch (error) {
    const message = await markPrepareFailed(
      reportId,
      attachment,
      error instanceof Error ? error.message : 'Could not save prepared photo',
    );
    return { ok: false, message };
  }
}

/** Compress + durable-persist each draft until every photo is upload-ready. */
export async function prepareReportAttachments(
  reportId: string,
): Promise<PrepareResult> {
  const report = await uploadQueueRepository.getReport(reportId);
  if (!report) {
    return { ok: false, message: 'Report not found' };
  }

  for (const attachment of report.attachments) {
    const result = await prepareOneAttachment(reportId, attachment);
    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}

/** After local enqueue: create metadata + prepare photos, then drain the queue. */
export async function finishReportAfterLocalEnqueue(
  reportId: string,
): Promise<void> {
  await Promise.all([
    createRemoteReportEarly(reportId),
    prepareReportAttachments(reportId),
  ]);
}
