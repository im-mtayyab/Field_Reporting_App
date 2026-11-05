import type {
  UploadAttachmentStatus,
  UploadReportStatus,
} from './uploadQueue.enums';

export type UploadAttachment = {
  id: string;
  reportId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  localUri: string;
  status: UploadAttachmentStatus;
  attemptCount: number;
  lastError: string | null;
  sortOrder: number;
  /**
   * True once compress + durable persist finished.
   * Upload must not start until prepared.
   */
  prepared: boolean;
  /** TUS Location URL for resume. */
  uploadUrl: string | null;
  uploadOffset: number;
  accessToken: string | null;
  objectPath: string | null;
  /** Background-downloader task id. */
  uploadJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UploadReport = {
  id: string;
  description: string;
  status: UploadReportStatus;
  attemptCount: number;
  lastError: string | null;
  /** 1 once POST /reports succeeded (idempotent create). */
  remoteCreated: boolean;
  createdAt: string;
  updatedAt: string;
  attachments: UploadAttachment[];
};

export type EnqueueReportInput = {
  description: string;
  images: Array<{
    uri: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }>;
};
