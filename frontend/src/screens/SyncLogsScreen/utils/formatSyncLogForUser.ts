import type { SyncLog } from '../../../types/syncLog';
import { toUserUploadMessage } from '../../../uploadQueue/utils/userUploadMessage';

const EVENT_TITLE: Record<string, string> = {
  queue_pass_start: 'Checking the upload queue',
  queue_pass_end: 'Upload queue pass complete',
  create_start: 'Submitting report details',
  create_ok: 'Report details saved on the server',
  create_failed: 'Report details could not be submitted',
  recover_interrupted: 'Resumed after an interruption',
  attachment_upload_start: 'Starting photo upload',
  upload_session_ok: 'Upload session ready',
  upload_session_failed: 'Upload session could not be created',
  upload_begin: 'Uploading photo',
  upload_source: 'Preparing photo file',
  prepare_start: 'Preparing photo',
  prepare_ok: 'Photo ready for upload',
  prepare_failed: 'Photo could not be prepared',
  tus_create_failed: 'Upload could not be opened',
  tus_patch_failed: 'Photo upload interrupted',
  complete_failed: 'Server did not confirm the photo',
  attachment_uploaded: 'Photo uploaded',
  attachment_paused: 'Photo upload paused',
  attachment_cancelled: 'Photo upload cancelled',
  attachment_resumed: 'Photo upload resumed',
  attachment_retry: 'Retrying photo upload',
  attachment_resume_restart: 'Restarting photo upload',
  report_retry: 'Retrying report',
  report_delivered: 'Report delivered',
  upload_source_missing: 'Photo file missing',
  reattach_done: 'Background transfer finished',
  reattach_error: 'Background transfer failed',
};

/**
 * Formats a sync log entry for display in the activity list.
 * Prefers the photo file name over identifiers or protocol terms.
 *
 * @param log - Persisted sync log event.
 * @param fileNameByAttachmentId - Map of attachment id to display file name.
 * @returns Title and detail strings for a log row.
 */
export function formatSyncLogForUser(
  log: SyncLog,
  fileNameByAttachmentId: Record<string, string>,
): { title: string; detail: string } {
  const fileName = log.attachmentId
    ? fileNameByAttachmentId[log.attachmentId]
    : undefined;
  const photoLabel = fileName ? `“${fileName}”` : 'Photo';

  const baseTitle = EVENT_TITLE[log.event] ?? 'Update';
  const title = fileName
    ? baseTitle.replace(/^Photo\b/i, photoLabel).replace(/\bphoto\b/i, photoLabel)
    : baseTitle;

  let detail = toUserUploadMessage(log.message);

  if (log.event === 'attachment_uploaded' && fileName) {
    detail = `${photoLabel} has been uploaded successfully.`;
  } else if (log.event === 'attachment_upload_start' && fileName) {
    detail = `Uploading ${photoLabel}.`;
  } else if (log.event === 'create_ok') {
    detail =
      'Report details are on the server. Photo uploads may still be in progress.';
  } else if (log.event === 'report_delivered') {
    detail = 'All content for this report has reached the server.';
  } else if (log.event === 'queue_pass_end') {
    detail = 'Finished processing saved reports in the queue.';
  } else if (log.event === 'upload_source' || log.event === 'upload_begin') {
    detail = fileName
      ? `Processing ${photoLabel}.`
      : 'Processing a photo.';
  } else if (log.level === 'error' || log.level === 'warn') {
    detail = fileName
      ? `${toUserUploadMessage(log.message)} (${photoLabel})`
      : toUserUploadMessage(log.message);
  }

  return { title, detail };
}
