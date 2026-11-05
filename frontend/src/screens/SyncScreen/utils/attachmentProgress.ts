import {
  UploadAttachmentStatus,
  type UploadAttachment,
} from '../../../types/uploadQueue';
import { toUserUploadMessage } from '../../../uploadQueue/utils/userUploadMessage';
import { colors } from '../../../theme';
import { formatUploadBytes } from './formatUploadBytes';

export type AttachmentProgressView = {
  /** Progress percentage from 0 to 100. */
  pct: number;
  /** Status subtitle shown under the file name. */
  statusLine: string;
  statusColor: 'textSoft' | 'statusFailedText' | 'statusDeliveredText';
  fillColor: string;
  uploading: boolean;
  paused: boolean;
  /** True while local compression or durable copy is still running. */
  preparing: boolean;
  canRetry: boolean;
  done: boolean;
  /** Whether the thin progress track should be visible. */
  showBar: boolean;
  /** Alias of {@link AttachmentProgressView.statusLine} for older callers. */
  meta: string;
  metaColor: 'textSoft' | 'statusFailedText' | 'statusDeliveredText';
};

/**
 * Derives progress UI state for a single upload-queue attachment.
 *
 * @param attachment - Local attachment row from the upload queue.
 * @param live - Optional live byte counters from the in-memory progress store.
 * @returns View model used by the Uploads attachment row.
 */
export function getAttachmentProgressView(
  attachment: UploadAttachment,
  live?: { bytesUploaded: number; bytesTotal: number },
): AttachmentProgressView {
  const preparing =
    attachment.status === UploadAttachmentStatus.Preparing ||
    (!attachment.prepared &&
      attachment.status !== UploadAttachmentStatus.Failed &&
      attachment.status !== UploadAttachmentStatus.Cancelled &&
      attachment.status !== UploadAttachmentStatus.Uploaded);
  const uploading = attachment.status === UploadAttachmentStatus.Uploading;
  const pending = attachment.status === UploadAttachmentStatus.Pending;
  const paused = attachment.status === UploadAttachmentStatus.Paused;
  const cancelled = attachment.status === UploadAttachmentStatus.Cancelled;
  const failed = attachment.status === UploadAttachmentStatus.Failed;
  const done = attachment.status === UploadAttachmentStatus.Uploaded;

  const bytesTotal = Math.max(
    live?.bytesTotal || 0,
    attachment.sizeBytes || 0,
    1,
  );
  const bytesUploaded = Math.min(
    bytesTotal,
    Math.max(
      live?.bytesUploaded ?? 0,
      attachment.uploadOffset ?? 0,
      done ? attachment.sizeBytes : 0,
    ),
  );

  const pct = Math.min(
    100,
    Math.max(0, Math.round((bytesUploaded / bytesTotal) * 100)),
  );
  const safePct = Math.max(pct, bytesUploaded > 0 ? 1 : 0);
  const sizePair = `${formatUploadBytes(bytesUploaded)} / ${formatUploadBytes(bytesTotal)}`;

  const pack = (
    partial: Omit<AttachmentProgressView, 'meta' | 'metaColor'> & {
      statusLine: string;
      statusColor: AttachmentProgressView['statusColor'];
    },
  ): AttachmentProgressView => ({
    ...partial,
    meta: partial.statusLine,
    metaColor: partial.statusColor,
  });

  if (done) {
    return pack({
      pct: 100,
      statusLine: `${formatUploadBytes(attachment.sizeBytes)} · Done`,
      statusColor: 'textSoft',
      fillColor: colors.statusDeliveredText,
      uploading: false,
      paused: false,
      preparing: false,
      canRetry: false,
      done: true,
      showBar: false,
    });
  }

  // Quiet start — same Chrome "0 B / size" as a fresh upload; no "Preparing" label.
  if (preparing) {
    return pack({
      pct: 0,
      statusLine: `0 B / ${formatUploadBytes(attachment.sizeBytes)}`,
      statusColor: 'textSoft',
      fillColor: colors.accent,
      uploading: false,
      paused: false,
      preparing: true,
      canRetry: false,
      done: false,
      showBar: true,
    });
  }

  if (uploading) {
    return pack({
      pct: safePct,
      statusLine:
        safePct >= 99 ? `Finishing · ${formatUploadBytes(bytesTotal)}` : sizePair,
      statusColor: 'textSoft',
      fillColor: colors.accent,
      uploading: true,
      paused: false,
      preparing: false,
      canRetry: false,
      done: false,
      showBar: true,
    });
  }

  // Pending (fresh queue or resume) — same active row as Uploading.
  if (pending) {
    return pack({
      pct: safePct,
      statusLine: bytesUploaded > 0 ? sizePair : `0 B / ${formatUploadBytes(bytesTotal)}`,
      statusColor: 'textSoft',
      fillColor: colors.accent,
      uploading: true,
      paused: false,
      preparing: false,
      canRetry: false,
      done: false,
      showBar: true,
    });
  }

  if (paused) {
    return pack({
      pct: safePct,
      statusLine: safePct > 0 ? `Paused · ${sizePair}` : 'Paused',
      statusColor: 'textSoft',
      fillColor: colors.textSoft,
      uploading: false,
      paused: true,
      preparing: false,
      canRetry: false,
      done: false,
      showBar: true,
    });
  }

  if (cancelled) {
    return pack({
      pct: safePct,
      statusLine: 'Cancelled.',
      statusColor: 'statusFailedText',
      fillColor: colors.textSoft,
      uploading: false,
      paused: false,
      preparing: false,
      canRetry: true,
      done: false,
      showBar: true,
    });
  }

  if (failed) {
    return pack({
      pct: safePct,
      statusLine: toUserUploadMessage(attachment.lastError),
      statusColor: 'statusFailedText',
      fillColor: colors.statusFailedText,
      uploading: false,
      paused: false,
      preparing: false,
      canRetry: true,
      done: false,
      showBar: true,
    });
  }

  return pack({
    pct: 0,
    statusLine: `0 B / ${formatUploadBytes(attachment.sizeBytes)}`,
    statusColor: 'textSoft',
    fillColor: colors.accent,
    uploading: true,
    paused: false,
    preparing: false,
    canRetry: false,
    done: false,
    showBar: true,
  });
}
