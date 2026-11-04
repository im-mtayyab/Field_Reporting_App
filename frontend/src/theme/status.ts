import { AttachmentStatus, ReportStatus } from '../types/report';
import { colors } from './colors';

/** Shared chip look — reuse for reports, attachments, logs, sync, etc. */
export type StatusTone = {
  backgroundColor: string;
  color: string;
  label: string;
};

/** Look up a tone from any status → tone map. */
export function statusTone<T extends string>(
  map: Record<T, StatusTone>,
  status: T,
): StatusTone {
  return map[status];
}

export const reportStatusTones: Record<ReportStatus, StatusTone> = {
  [ReportStatus.Pending]: {
    backgroundColor: colors.statusPendingBg,
    color: colors.statusPendingText,
    label: 'Pending',
  },
  [ReportStatus.Uploading]: {
    backgroundColor: colors.statusUploadingBg,
    color: colors.statusUploadingText,
    label: 'Uploading',
  },
  [ReportStatus.Delivered]: {
    backgroundColor: colors.statusDeliveredBg,
    color: colors.statusDeliveredText,
    label: 'Delivered',
  },
  [ReportStatus.Failed]: {
    backgroundColor: colors.statusFailedBg,
    color: colors.statusFailedText,
    label: 'Failed',
  },
};

export const attachmentStatusTones: Record<AttachmentStatus, StatusTone> = {
  [AttachmentStatus.Pending]: {
    backgroundColor: colors.statusPendingBg,
    color: colors.statusPendingText,
    label: 'Pending',
  },
  [AttachmentStatus.Uploading]: {
    backgroundColor: colors.statusUploadingBg,
    color: colors.statusUploadingText,
    label: 'Uploading',
  },
  [AttachmentStatus.Uploaded]: {
    backgroundColor: colors.statusDeliveredBg,
    color: colors.statusDeliveredText,
    label: 'Uploaded',
  },
  [AttachmentStatus.Failed]: {
    backgroundColor: colors.statusFailedBg,
    color: colors.statusFailedText,
    label: 'Failed',
  },
};

export function reportStatusTone(status: ReportStatus): StatusTone {
  return statusTone(reportStatusTones, status);
}

export function attachmentStatusTone(status: AttachmentStatus): StatusTone {
  return statusTone(attachmentStatusTones, status);
}
