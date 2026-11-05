/** Local upload-queue report lifecycle (SQLite source of truth). */
export enum UploadReportStatus {
  Pending = 'pending',
  Uploading = 'uploading',
  Delivered = 'delivered',
  Failed = 'failed',
}

/** Local attachment lifecycle before / during binary upload. */
export enum UploadAttachmentStatus {
  /** Local compress / durable copy still running. */
  Preparing = 'preparing',
  Pending = 'pending',
  Uploading = 'uploading',
  Paused = 'paused',
  /** Stopped by user — keep progress; Retry continues. */
  Cancelled = 'cancelled',
  Uploaded = 'uploaded',
  Failed = 'failed',
}
