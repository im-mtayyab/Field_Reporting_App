import { Platform } from 'react-native';
import notifee, { AndroidImportance } from 'react-native-notify-kit';

const CHANNEL_ID = 'field-reports-sync';
const PROGRESS_CHANNEL_ID = 'field-reports-upload-progress';

let channelReady = false;
let progressChannelReady = false;
let permissionAsked = false;

type ReportNotifyState = {
  total: number;
  done: number;
  description: string;
  lastAt: number;
  lastCurrent: number;
};

const reportNotify = new Map<string, ReportNotifyState>();
const attachmentToReport = new Map<string, string>();

async function ensureReady(): Promise<void> {
  if (!permissionAsked) {
    permissionAsked = true;
    try {
      await notifee.requestPermission();
    } catch {
      // Denied — skip silently.
    }
  }

  if (channelReady || Platform.OS !== 'android') {
    return;
  }

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Sync & uploads',
    importance: AndroidImportance.HIGH,
  });
  channelReady = true;
}

async function ensureProgressChannel(): Promise<void> {
  await ensureReady();
  if (progressChannelReady || Platform.OS !== 'android') {
    return;
  }

  await notifee.createChannel({
    id: PROGRESS_CHANNEL_ID,
    name: 'Upload progress',
    importance: AndroidImportance.LOW,
  });
  progressChannelReady = true;
}

function reportProgressId(reportId: string): string {
  return `upload-progress-report-${reportId}`;
}

function attachmentFailId(attachmentId: string): string {
  return `fail-${attachmentId}`;
}

export async function notifyOs(input: {
  title: string;
  body: string;
  id?: string;
  progress?: { max: number; current: number; indeterminate?: boolean };
  ongoing?: boolean;
  onlyAlertOnce?: boolean;
  channelId?: string;
  importance?: AndroidImportance;
}): Promise<void> {
  try {
    if (input.progress) {
      await ensureProgressChannel();
    } else {
      await ensureReady();
    }

    await notifee.displayNotification({
      id: input.id,
      title: input.title,
      body: input.body,
      android: {
        channelId:
          input.channelId ??
          (input.progress ? PROGRESS_CHANNEL_ID : CHANNEL_ID),
        pressAction: { id: 'default' },
        smallIcon: 'ic_launcher',
        importance:
          input.importance ??
          (input.progress ? AndroidImportance.LOW : AndroidImportance.HIGH),
        onlyAlertOnce: input.onlyAlertOnce ?? Boolean(input.progress),
        ongoing: input.ongoing ?? Boolean(input.progress),
        progress: input.progress,
      },
      ios: {
        sound: input.progress ? undefined : 'default',
      },
    });
  } catch {
    // Upload flow continues even if notification display fails.
  }
}

async function cancelNotification(id: string): Promise<void> {
  try {
    await notifee.cancelNotification(id);
  } catch {
    // ignore
  }
}

function shortName(fileName: string, max = 40): string {
  if (fileName.length <= max) {
    return fileName;
  }
  const ext = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.'))
    : '';
  return `${fileName.slice(0, Math.max(8, max - ext.length - 1))}…${ext}`;
}

function shortText(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

function publishReportProgress(
  reportId: string,
  state: ReportNotifyState,
  fileFraction = 0,
): void {
  const total = Math.max(1, state.total);
  const done = Math.max(0, Math.min(total, state.done));
  const current = Math.min(total, done + (done >= total ? 0 : 1));
  const now = Date.now();

  // Throttle OS updates — keep UI store snappy, notifications quieter.
  if (
    current === state.lastCurrent &&
    fileFraction < 0.99 &&
    now - state.lastAt < 800
  ) {
    return;
  }

  state.lastAt = now;
  state.lastCurrent = current;
  reportNotify.set(reportId, state);

  const barMax = total * 100;
  const barCurrent = Math.min(
    barMax,
    done * 100 + Math.floor(Math.max(0, Math.min(1, fileFraction)) * 100),
  );

  void notifyOs({
    id: reportProgressId(reportId),
    title: 'Uploading photos',
    body: `${current} of ${total} complete`,
    progress: {
      max: barMax,
      current: Math.max(1, barCurrent),
      indeterminate: done === 0 && fileFraction <= 0,
    },
    ongoing: true,
    onlyAlertOnce: true,
    channelId: PROGRESS_CHANNEL_ID,
    importance: AndroidImportance.LOW,
  });
}

/** Start / refresh the single progress notification for a report. */
export function beginReportUploadNotify(input: {
  reportId: string;
  totalCount: number;
  alreadyUploaded: number;
  description: string;
}): void {
  const total = Math.max(1, input.totalCount);
  const done = Math.max(0, Math.min(total, input.alreadyUploaded));
  const state: ReportNotifyState = {
    total,
    done,
    description: input.description,
    lastAt: 0,
    lastCurrent: -1,
  };
  reportNotify.set(input.reportId, state);
  if (done < total) {
    publishReportProgress(input.reportId, state, 0);
  }
}

export function bindAttachmentToReport(
  attachmentId: string,
  reportId: string,
): void {
  attachmentToReport.set(attachmentId, reportId);
}

export function notifyUploadProgress(
  attachmentId: string,
  _fileName: string,
  bytesUploaded: number,
  bytesTotal: number,
): void {
  const reportId = attachmentToReport.get(attachmentId);
  if (!reportId) {
    return;
  }
  const state = reportNotify.get(reportId);
  if (!state || state.done >= state.total) {
    return;
  }

  const total = Math.max(1, bytesTotal || 0);
  const uploaded = Math.max(0, Math.min(total, bytesUploaded || 0));
  publishReportProgress(reportId, state, uploaded / total);
}

export function clearUploadProgressNotification(attachmentId: string): void {
  attachmentToReport.delete(attachmentId);
}

/**
 * One photo finished. Updates "N of M"; does not fire a separate success toast.
 * Returns true when this was the last photo (caller may show the final notice).
 */
export function markReportPhotoUploaded(reportId: string): boolean {
  const state = reportNotify.get(reportId);
  if (!state) {
    return false;
  }
  state.done = Math.min(state.total, state.done + 1);
  state.lastAt = 0;
  state.lastCurrent = -1;
  if (state.done >= state.total) {
    void cancelNotification(reportProgressId(reportId));
    reportNotify.delete(reportId);
    return true;
  }
  publishReportProgress(reportId, state, 0);
  return false;
}

export function clearReportUploadNotify(reportId: string): void {
  reportNotify.delete(reportId);
  void cancelNotification(reportProgressId(reportId));
}

/** @deprecated Prefer report-level progress — kept as no-op success suppressor. */
export function notifyUploadSuccess(
  _fileName: string,
  attachmentId?: string,
): void {
  if (!attachmentId) {
    return;
  }
  const reportId = attachmentToReport.get(attachmentId);
  clearUploadProgressNotification(attachmentId);
  if (reportId) {
    markReportPhotoUploaded(reportId);
  }
}

export function notifyUploadFailed(
  fileName: string,
  reason?: string,
  attachmentId?: string,
): void {
  if (attachmentId) {
    const reportId = attachmentToReport.get(attachmentId);
    clearUploadProgressNotification(attachmentId);
    if (reportId) {
      const state = reportNotify.get(reportId);
      // Keep report progress alive if siblings are still uploading.
      if (!state || state.done + 1 >= state.total) {
        clearReportUploadNotify(reportId);
      }
    }
  }
  const clean = reason?.replace(/\s+/g, ' ').trim();
  void notifyOs({
    title: 'Photo upload failed',
    body: clean
      ? `${shortName(fileName)} — ${shortText(clean, 100)}`
      : shortName(fileName),
    id: attachmentFailId(attachmentId ?? fileName),
  });
}

export function notifyReportDelivered(description: string, reportId?: string): void {
  if (reportId) {
    clearReportUploadNotify(reportId);
  }
  void notifyOs({
    title: 'Photos uploaded',
    body:
      shortText(description, 80) ||
      'All photos for this report have reached the server.',
    id: reportId ? `delivered-${reportId}` : `delivered-${Date.now()}`,
  });
}

export function notifyReportFailed(description: string, reason?: string): void {
  const clean = reason?.replace(/\s+/g, ' ').trim();
  void notifyOs({
    title: 'Report could not be delivered',
    body: clean
      ? `${shortText(description, 40)} — ${shortText(clean, 80)}`
      : shortText(description, 80) ||
        'The report could not be delivered. Please retry from Uploads.',
    id: `report-fail-${Date.now()}`,
  });
}
