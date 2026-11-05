import {
  cancelAttachmentUpload,
  pauseAttachmentUpload,
  processQueue,
  resumeAttachmentUpload,
  retryAttachmentUpload,
  retryFailedReport,
} from '../../uploadQueue';

type ControlResult = { ok: true } | { ok: false; message: string };

export async function pauseAttachmentAction(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  return pauseAttachmentUpload(reportId, attachmentId);
}

export async function resumeAttachmentAction(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  return resumeAttachmentUpload(reportId, attachmentId);
}

export async function cancelAttachmentAction(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  return cancelAttachmentUpload(reportId, attachmentId);
}

export async function retryAttachmentAction(
  reportId: string,
  attachmentId: string,
): Promise<ControlResult> {
  return retryAttachmentUpload(reportId, attachmentId);
}

export async function retryReportAction(
  reportId: string,
): Promise<ControlResult> {
  const result = await retryFailedReport(reportId);
  if (!result.ok) {
    return result;
  }
  void processQueue();
  return { ok: true };
}
