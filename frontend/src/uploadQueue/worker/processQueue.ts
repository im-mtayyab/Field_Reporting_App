import { ensureDbReady } from '../../db';
import {
  beginReportUploadNotify,
  clearReportUploadNotify,
  notifyReportDelivered,
  notifyReportFailed,
} from '../../services/notifyService';
import { createReportService } from '../../services/reportService';
import { getParallelUploadsEnabled } from '../../store/testerSettings';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadAttachment,
  type UploadReport,
} from '../../types/uploadQueue';
import { logSync } from '../repository/syncLog.repository';
import { uploadQueueRepository } from '../repository/uploadQueue.repository';
import { uploadAttachment } from './runAttachmentUpload';

let running = false;
/** Set when processQueue is called while a pass is already in flight. */
let wakeRequested = false;

export type ProcessQueueResult = {
  processed: number;
  delivered: number;
  failed: number;
  /** True when more work remains (pending create or failed retries). */
  hasMore: boolean;
};

function isRetryableCreateError(reason: string): boolean {
  return (
    reason === 'Connection' ||
    reason === 'Timeout' ||
    reason === 'Server' ||
    reason === 'Rejected'
  );
}

function createErrorMessage(error: {
  reason: string;
  message?: string;
}): string {
  return error.message ?? `Create failed (${error.reason})`;
}

function isReadyToUpload(attachment: UploadAttachment): boolean {
  return (
    attachment.prepared &&
    (attachment.status === UploadAttachmentStatus.Pending ||
      attachment.status === UploadAttachmentStatus.Uploading)
  );
}

function isStillPreparing(attachment: UploadAttachment): boolean {
  return (
    !attachment.prepared &&
    attachment.status === UploadAttachmentStatus.Preparing
  );
}

function countUploadable(report: UploadReport): {
  total: number;
  uploaded: number;
} {
  const uploadable = report.attachments.filter(
    (item) => item.status !== UploadAttachmentStatus.Cancelled,
  );
  return {
    total: uploadable.length,
    uploaded: uploadable.filter(
      (item) => item.status === UploadAttachmentStatus.Uploaded,
    ).length,
  };
}

/**
 * Recover jobs interrupted mid-create after a force-quit.
 * Reports already created remotely stay `uploading` (awaiting binary upload).
 */
export async function recoverInterruptedJobs(): Promise<void> {
  await ensureDbReady();
  const reports = await uploadQueueRepository.listReports();
  for (const report of reports) {
    if (report.status !== UploadReportStatus.Uploading) {
      continue;
    }

    // Mid-transfer after force-quit — return binaries to pending so the queue
    // can restart (native tasks do not survive process death).
    for (const attachment of report.attachments) {
      if (attachment.status === UploadAttachmentStatus.Uploading) {
        await uploadQueueRepository.updateAttachment(attachment.id, {
          status: UploadAttachmentStatus.Pending,
          lastError: null,
          uploadJobId: null,
        });
      }
    }

    if (!report.remoteCreated) {
      await uploadQueueRepository.updateReport(report.id, {
        status: UploadReportStatus.Pending,
        lastError: null,
      });
      await logSync({
        reportId: report.id,
        event: 'recover_interrupted',
        message: 'Reset interrupted create to pending',
        level: 'warn',
      });
      continue;
    }

    await uploadQueueRepository.updateReport(report.id, {
      status: UploadReportStatus.Pending,
      lastError: null,
    });
    await logSync({
      reportId: report.id,
      event: 'recover_interrupted',
      message: 'Reset interrupted upload to pending',
      level: 'warn',
    });
  }
}

async function ensureRemoteReport(report: UploadReport): Promise<boolean> {
  if (report.remoteCreated) {
    return true;
  }

  await logSync({
    reportId: report.id,
    event: 'create_start',
    message: 'POST /reports (metadata)',
    level: 'info',
  });

  const result = await createReportService({
    reportId: report.id,
    description: report.description,
    attachments: report.attachments.map((item) => ({
      attachmentId: item.id,
      fileName: item.fileName,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
    })),
  });

  if (result.isErr()) {
    const error = result.error;
    const message = createErrorMessage(error);

    await uploadQueueRepository.updateReport(report.id, {
      status: UploadReportStatus.Failed,
      attemptCount: report.attemptCount + 1,
      lastError: message,
    });

    // Per-file Retry (no report-level Retry).
    for (const attachment of report.attachments) {
      if (attachment.status !== UploadAttachmentStatus.Uploaded) {
        await uploadQueueRepository.updateAttachment(attachment.id, {
          status: UploadAttachmentStatus.Failed,
          lastError: message,
        });
      }
    }

    notifyReportFailed(report.description, message);
    clearReportUploadNotify(report.id);

    await logSync({
      reportId: report.id,
      event: 'create_failed',
      message,
      level: 'error',
      meta: {
        reason: error.reason,
        retryable: isRetryableCreateError(error.reason),
      },
    });
    return false;
  }

  await uploadQueueRepository.updateReport(report.id, {
    remoteCreated: true,
    lastError: null,
  });

  await logSync({
    reportId: report.id,
    event: 'create_ok',
    message: result.value.deduped
      ? 'Report metadata deduped on server'
      : 'Report metadata created on server',
    level: 'success',
    meta: { deduped: result.value.deduped },
  });
  return true;
}

async function uploadOneAttachment(
  reportId: string,
  attachmentId: string,
): Promise<
  | { kind: 'ok' }
  | { kind: 'parked' }
  | { kind: 'failed' }
  | { kind: 'skipped' }
> {
  const latest = await uploadQueueRepository.getReport(reportId);
  const attachment = latest?.attachments.find((a) => a.id === attachmentId);
  if (!attachment) {
    return { kind: 'skipped' };
  }
  if (
    attachment.status === UploadAttachmentStatus.Paused ||
    attachment.status === UploadAttachmentStatus.Cancelled ||
    attachment.status === UploadAttachmentStatus.Uploaded ||
    attachment.status === UploadAttachmentStatus.Failed
  ) {
    return attachment.status === UploadAttachmentStatus.Paused
      ? { kind: 'parked' }
      : { kind: 'skipped' };
  }
  if (
    attachment.status !== UploadAttachmentStatus.Pending &&
    attachment.status !== UploadAttachmentStatus.Uploading
  ) {
    return { kind: 'skipped' };
  }

  const upload = await uploadAttachment(reportId, attachment);
  if (upload.ok) {
    return { kind: 'ok' };
  }
  if (upload.cancelled) {
    return { kind: 'parked' };
  }
  return { kind: 'failed' };
}

async function uploadPendingAttachments(
  report: UploadReport,
  pendingFiles: UploadAttachment[],
): Promise<{ attachmentFailed: boolean; userParked: boolean }> {
  const counts = countUploadable(report);
  beginReportUploadNotify({
    reportId: report.id,
    totalCount: Math.max(counts.total, pendingFiles.length),
    alreadyUploaded: counts.uploaded,
    description: report.description,
  });

  const parallel = getParallelUploadsEnabled();

  if (parallel) {
    const results = await Promise.all(
      pendingFiles.map((file) => uploadOneAttachment(report.id, file.id)),
    );
    let attachmentFailed = false;
    let userParked = false;
    for (const result of results) {
      if (result.kind === 'failed') {
        attachmentFailed = true;
      }
      if (result.kind === 'parked') {
        userParked = true;
      }
    }
    if (attachmentFailed) {
      await uploadQueueRepository.updateReport(report.id, {
        status: UploadReportStatus.Failed,
        lastError: null,
      });
    }
    return { attachmentFailed, userParked };
  }

  let attachmentFailed = false;
  let userParked = false;

  // Re-read each iteration so Pause on photo 1 doesn't start photo 2.
  for (let i = 0; i < pendingFiles.length; i += 1) {
    const result = await uploadOneAttachment(
      report.id,
      pendingFiles[i]!.id,
    );
    if (result.kind === 'parked') {
      userParked = true;
      break;
    }
    if (result.kind === 'failed') {
      attachmentFailed = true;
      await uploadQueueRepository.updateReport(report.id, {
        status: UploadReportStatus.Failed,
        lastError: null,
      });
      break;
    }
  }

  return { attachmentFailed, userParked };
}

async function runQueuePass(): Promise<ProcessQueueResult> {
  let processed = 0;
  let delivered = 0;
  let failed = 0;

  await ensureDbReady();
  await logSync({
    event: 'queue_pass_start',
    message: 'Upload queue started',
    level: 'info',
  });

  while (true) {
    // Another prepare/resume asked us to keep going after this claim set.
    if (wakeRequested) {
      wakeRequested = false;
    }

    const report = await uploadQueueRepository.claimNextReport();
    if (!report) {
      break;
    }

    processed += 1;
    await uploadQueueRepository.updateReport(report.id, {
      status: UploadReportStatus.Uploading,
    });

    const fresh = (await uploadQueueRepository.getReport(report.id)) ?? report;

    const remoteOk = await ensureRemoteReport({
      ...fresh,
      attemptCount: report.attemptCount,
    });
    if (!remoteOk) {
      failed += 1;
      continue;
    }

    // Only upload photos that finished local prepare (compress + durable copy).
    const pendingFiles = fresh.attachments.filter(isReadyToUpload);

    // Still preparing — keep report alive; next prepare kick re-wakes the queue.
    const stillPreparing = fresh.attachments.some(isStillPreparing);
    if (stillPreparing && pendingFiles.length === 0) {
      await uploadQueueRepository.updateReport(report.id, {
        status: UploadReportStatus.Uploading,
        lastError: null,
      });
      continue;
    }

    if (pendingFiles.length === 0) {
      continue;
    }

    const { attachmentFailed, userParked } = await uploadPendingAttachments(
      fresh,
      pendingFiles,
    );

    if (attachmentFailed) {
      failed += 1;
      continue;
    }

    const after = await uploadQueueRepository.getReport(report.id);
    const stillPending = after?.attachments.some(
      (item) => isStillPreparing(item) || isReadyToUpload(item),
    );
    const hasPaused = after?.attachments.some(
      (item) => item.status === UploadAttachmentStatus.Paused,
    );
    const blocked = after?.attachments.some(
      (item) =>
        item.status === UploadAttachmentStatus.Cancelled ||
        item.status === UploadAttachmentStatus.Failed,
    );

    // User paused — park; leave remaining Pending for Resume/Retry.
    if (userParked || hasPaused) {
      await uploadQueueRepository.updateReport(report.id, {
        status: UploadReportStatus.Uploading,
        lastError: null,
      });
      continue;
    }

    if (stillPending) {
      continue;
    }

    if (blocked) {
      await uploadQueueRepository.updateReport(report.id, {
        status: UploadReportStatus.Failed,
        lastError: null,
      });
      clearReportUploadNotify(report.id);
      continue;
    }

    await uploadQueueRepository.updateReport(report.id, {
      status: UploadReportStatus.Delivered,
      lastError: null,
    });
    delivered += 1;
    notifyReportDelivered(fresh.description, fresh.id);

    await logSync({
      reportId: report.id,
      event: 'report_delivered',
      message: 'Report fully delivered',
      level: 'success',
    });
  }

  await logSync({
    event: 'queue_pass_end',
    message: `Processed ${processed}, delivered ${delivered}, failed ${failed}`,
    level: 'info',
    meta: { processed, delivered, failed },
  });

  const counts = await uploadQueueRepository.countByStatus();
  // Failed is manual-only — do not treat as remaining auto-work.
  const hasMore =
    counts[UploadReportStatus.Pending] > 0 ||
    counts[UploadReportStatus.Uploading] > 0;

  return { processed, delivered, failed, hasMore };
}

/**
 * Headless upload worker — metadata create + background TUS binary upload.
 * Exercisable without rendering a screen (assessment requirement).
 */
export async function processQueue(): Promise<ProcessQueueResult> {
  if (running) {
    // Caller (prepare finish, resume, NetInfo) has new work — re-drain after.
    wakeRequested = true;
    return { processed: 0, delivered: 0, failed: 0, hasMore: true };
  }

  running = true;
  let processed = 0;
  let delivered = 0;
  let failed = 0;
  let hasMore = false;

  try {
    do {
      wakeRequested = false;
      const pass = await runQueuePass();
      processed += pass.processed;
      delivered += pass.delivered;
      failed += pass.failed;
      hasMore = pass.hasMore;
    } while (wakeRequested);
  } finally {
    running = false;
  }

  // Lost a wake between do-while exit and finally — drain once more.
  if (wakeRequested) {
    wakeRequested = false;
    const again = await processQueue();
    return {
      processed: processed + again.processed,
      delivered: delivered + again.delivered,
      failed: failed + again.failed,
      hasMore: again.hasMore,
    };
  }

  return { processed, delivered, failed, hasMore };
}
