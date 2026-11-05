import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { ensureDbReady } from '../../db';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type EnqueueReportInput,
  type UploadAttachment,
  type UploadReport,
} from '../../types/uploadQueue';
import { uploadQueueRepository } from '../repository/uploadQueue.repository';

/**
 * Inserts a draft report into local storage immediately.
 * Compression, durable persistence, and server registration continue afterward.
 */
export async function enqueueReport(
  input: EnqueueReportInput,
): Promise<UploadReport> {
  await ensureDbReady();

  const now = new Date().toISOString();
  const reportId = uuidv4();

  const attachments: UploadAttachment[] = input.images.map((image, index) => ({
    id: uuidv4(),
    reportId,
    fileName: image.fileName,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    localUri: image.uri,
    status: UploadAttachmentStatus.Preparing,
    attemptCount: 0,
    lastError: null,
    sortOrder: index,
    prepared: false,
    uploadUrl: null,
    uploadOffset: 0,
    accessToken: null,
    objectPath: null,
    uploadJobId: null,
    createdAt: now,
    updatedAt: now,
  }));

  const report: UploadReport = {
    id: reportId,
    description: input.description.trim(),
    status: UploadReportStatus.Pending,
    attemptCount: 0,
    lastError: null,
    remoteCreated: false,
    createdAt: now,
    updatedAt: now,
    attachments,
  };

  await uploadQueueRepository.insertReport(report);
  return report;
}
