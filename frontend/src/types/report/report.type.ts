import type { AttachmentStatus, ReportStatus } from './report.enums';

export type Attachment = {
  id: string;
  reportId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sha256?: string;
  objectPath: string;
  /** Temporary image URL from the API (expires). */
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

export type ListReportsResponse = {
  reports: Report[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type ListReportsParams = {
  limit?: number;
  offset?: number;
};

export type GetReportResponse = {
  report: Report;
};
