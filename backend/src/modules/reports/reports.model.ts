export enum ReportStatus {
  Pending = 'pending',
  Uploading = 'uploading',
  Delivered = 'delivered',
  Failed = 'failed',
}

export enum AttachmentStatus {
  Pending = 'pending',
  Uploading = 'uploading',
  Uploaded = 'uploaded',
  Failed = 'failed',
}

export type Attachment = {
  id: string;
  reportId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256?: string;
  objectPath: string;
  downloadUrl?: string;
  status: AttachmentStatus;
  failureReason?: string;
  uploadedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Report = {
  id: string;
  description: string;
  status: ReportStatus;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
};

export type ListReportsPage = {
  reports: Report[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type CreateAttachmentInput = {
  attachmentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256?: string;
};

export type CreateReportInput = {
  reportId: string;
  description: string;
  attachments: CreateAttachmentInput[];
};

export type UploadSession = {
  bucket: string;
  objectPath: string;
  uploadEndpoint: string;
  contentType: string;
  sizeBytes: number;
  accessToken: string;
  apikey: string;
  resumable: true;
};

export function deriveReportStatus(attachments: Attachment[]): ReportStatus {
  if (attachments.length === 0) {
    return ReportStatus.Pending;
  }

  if (attachments.some((a) => a.status === AttachmentStatus.Failed)) {
    return ReportStatus.Failed;
  }

  if (attachments.every((a) => a.status === AttachmentStatus.Uploaded)) {
    return ReportStatus.Delivered;
  }

  if (
    attachments.some(
      (a) =>
        a.status === AttachmentStatus.Uploading ||
        a.status === AttachmentStatus.Uploaded,
    )
  ) {
    return ReportStatus.Uploading;
  }

  return ReportStatus.Pending;
}

export function isAttachmentRetryable(status: AttachmentStatus): boolean {
  return status !== AttachmentStatus.Uploaded;
}
