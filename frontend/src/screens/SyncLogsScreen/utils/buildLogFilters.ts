import type { SearchMultiSelectOption } from '../../../components';
import type { SyncLog } from '../../../types/syncLog';
import {
  UploadAttachmentStatus,
  type UploadReport,
} from '../../../types/uploadQueue';

/** Fixed severity options shown in the sync-log filter bar. */
export const LOG_LEVEL_OPTIONS: SearchMultiSelectOption[] = [
  { value: 'error', label: 'Problems' },
  { value: 'warn', label: 'Paused' },
  { value: 'success', label: 'Done' },
  { value: 'info', label: 'Updates' },
];

/**
 * Builds image filter options from local reports and any attachment ids in logs.
 *
 * @param reports - Local upload-queue reports with attachment metadata.
 * @param logs - Sync log entries that may reference attachments no longer listed.
 * @returns Deduplicated select options keyed by attachment id.
 */
export function buildImageFilterOptions(
  reports: UploadReport[],
  logs: SyncLog[],
): SearchMultiSelectOption[] {
  const options: SearchMultiSelectOption[] = [];
  const known = new Set<string>();

  for (const report of reports) {
    for (const attachment of report.attachments) {
      known.add(attachment.id);
      options.push({
        value: attachment.id,
        label: attachment.fileName,
      });
    }
  }

  for (const log of logs) {
    if (!log.attachmentId || known.has(log.attachmentId)) {
      continue;
    }
    known.add(log.attachmentId);
    options.push({
      value: log.attachmentId,
      label: `Image ${log.attachmentId.slice(0, 8)}`,
    });
  }

  return options;
}

/**
 * Summarizes attachment progress for a report shown in sync-log headers.
 *
 * @param report - Local upload-queue report to summarize.
 * @returns A compact status line such as `2 of 5 uploaded`.
 */
export function formatAttachmentStatusLine(report: UploadReport): string {
  const total = report.attachments.length;
  let uploaded = 0;
  let failed = 0;
  let uploading = 0;

  for (const attachment of report.attachments) {
    if (attachment.status === UploadAttachmentStatus.Uploaded) {
      uploaded += 1;
    } else if (
      attachment.status === UploadAttachmentStatus.Failed ||
      attachment.status === UploadAttachmentStatus.Cancelled
    ) {
      failed += 1;
    } else if (
      attachment.status === UploadAttachmentStatus.Uploading ||
      attachment.status === UploadAttachmentStatus.Paused ||
      attachment.status === UploadAttachmentStatus.Pending
    ) {
      uploading += 1;
    }
  }

  if (uploaded === total && total > 0 && failed === 0) {
    return `${uploaded} of ${total} uploaded`;
  }

  return [
    uploading > 0 ? `${uploading} of ${total} in progress` : null,
    failed > 0 ? `${failed} of ${total} need attention` : null,
    `${uploaded} of ${total} uploaded`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Filters sync logs by severity and optional attachment ids.
 *
 * @param logs - Full sync log list for the current report or device.
 * @param levels - Selected severity values; empty means all levels.
 * @param attachmentIds - Selected attachment ids; empty means all images.
 * @returns Logs that match every active filter.
 */
export function filterSyncLogs(
  logs: SyncLog[],
  levels: string[],
  attachmentIds: string[],
): SyncLog[] {
  return logs.filter((log) => {
    if (levels.length > 0 && !levels.includes(log.level)) {
      return false;
    }
    if (attachmentIds.length > 0) {
      if (!log.attachmentId || !attachmentIds.includes(log.attachmentId)) {
        return false;
      }
    }
    return true;
  });
}
