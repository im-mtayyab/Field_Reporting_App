import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadReport,
} from '../../../types/uploadQueue';

export type ReportUploadSummary = {
  /** Compact progress line, for example `2 of 5 uploaded`. */
  line: string;
  /** True when any attachment failed or was cancelled, or report create failed. */
  failed: boolean;
  /** True when report metadata create failed and a report-level retry is available. */
  canRetryCreate: boolean;
};

/**
 * Builds a compact upload summary for a local queue report.
 *
 * @param report - Local upload-queue report including attachment statuses.
 * @returns Progress line and failure flags for the Uploads UI.
 */
export function formatReportUploadSummary(
  report: UploadReport,
): ReportUploadSummary {
  const total = report.attachments.length;
  const uploaded = report.attachments.filter(
    (item) => item.status === UploadAttachmentStatus.Uploaded,
  ).length;
  const failedCount = report.attachments.filter(
    (item) =>
      item.status === UploadAttachmentStatus.Failed ||
      item.status === UploadAttachmentStatus.Cancelled,
  ).length;

  const canRetryCreate =
    report.status === UploadReportStatus.Failed && Boolean(report.lastError);

  return {
    line: `${uploaded} of ${total} uploaded`,
    failed: failedCount > 0 || canRetryCreate,
    canRetryCreate,
  };
}
