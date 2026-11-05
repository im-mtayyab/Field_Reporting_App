import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../common/errors/index.js';
import { isStorageConfigured } from '../../config/env.js';
import {
  AttachmentStatus,
  ReportStatus,
  deriveReportStatus,
  isAttachmentRetryable,
  type Attachment,
  type CreateReportInput,
  type ListReportsPage,
  type Report,
  type UploadSession,
} from './reports.model.js';
import { reportsRepository } from './reports.repository.js';
import {
  createSignedDownloadUrls,
  createUploadSession,
} from './storage.service.js';

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

function buildObjectPath(
  reportId: string,
  attachmentId: string,
  contentType: string,
): string {
  const ext = EXT_BY_TYPE[contentType.toLowerCase()] ?? '.jpg';
  return `reports/${reportId}/${attachmentId}${ext}`;
}

function sameCreatePayload(existing: Report, input: CreateReportInput): boolean {
  if (existing.description !== input.description) {
    return false;
  }
  if (existing.attachments.length !== input.attachments.length) {
    return false;
  }

  const byId = new Map(existing.attachments.map((item) => [item.id, item]));
  for (const item of input.attachments) {
    const current = byId.get(item.attachmentId);
    if (!current) {
      return false;
    }
    if (
      current.fileName !== item.fileName ||
      current.contentType !== item.contentType ||
      current.sizeBytes !== item.sizeBytes ||
      (item.sha256 && current.sha256 && item.sha256 !== current.sha256)
    ) {
      return false;
    }
  }

  return true;
}

function withDerivedStatus(report: Report): Report {
  return { ...report, status: deriveReportStatus(report.attachments) };
}

function requireStorage() {
  if (!isStorageConfigured()) {
    throw new ServiceUnavailableError(
      'Supabase storage is not configured on the server',
    );
  }
}

async function withSignedDownloadUrls(reports: Report[]): Promise<Report[]> {
  const paths = reports.flatMap((report) =>
    report.attachments
      .filter(
        (attachment) =>
          attachment.status === AttachmentStatus.Uploaded &&
          Boolean(attachment.objectPath),
      )
      .map((attachment) => attachment.objectPath),
  );

  const urls = await createSignedDownloadUrls(paths);
  if (urls.size === 0) {
    return reports;
  }

  return reports.map((report) => ({
    ...report,
    attachments: report.attachments.map((attachment) => {
      const downloadUrl = urls.get(attachment.objectPath);
      return downloadUrl ? { ...attachment, downloadUrl } : attachment;
    }),
  }));
}

export async function listReports(input: {
  limit: number;
  offset: number;
}): Promise<ListReportsPage> {
  const page = await reportsRepository.listPage(input);
  const reports = await withSignedDownloadUrls(
    page.reports.map(withDerivedStatus),
  );

  return {
    reports,
    total: page.total,
    limit: input.limit,
    offset: input.offset,
    hasMore: input.offset + reports.length < page.total,
  };
}

export async function getReport(reportId: string): Promise<Report> {
  const report = await reportsRepository.getById(reportId);
  if (!report) {
    throw new NotFoundError('Report');
  }
  const [enriched] = await withSignedDownloadUrls([withDerivedStatus(report)]);
  return enriched!;
}

export async function createReport(
  input: CreateReportInput,
): Promise<{ report: Report; created: boolean; deduped: boolean }> {
  const existing = await reportsRepository.getById(input.reportId);
  if (existing) {
    if (!sameCreatePayload(existing, input)) {
      throw new ConflictError(
        'Report id already exists with a different payload',
      );
    }
    return {
      report: withDerivedStatus(existing),
      created: false,
      deduped: true,
    };
  }

  const now = new Date().toISOString();
  const attachments: Attachment[] = input.attachments.map((item) => ({
    id: item.attachmentId,
    reportId: input.reportId,
    fileName: item.fileName,
    contentType: item.contentType,
    sizeBytes: item.sizeBytes,
    sha256: item.sha256,
    objectPath: buildObjectPath(
      input.reportId,
      item.attachmentId,
      item.contentType,
    ),
    status: AttachmentStatus.Pending,
    createdAt: now,
    updatedAt: now,
  }));

  const report: Report = {
    id: input.reportId,
    description: input.description,
    status: ReportStatus.Pending,
    attachments,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await reportsRepository.insert(report);
  return { report: withDerivedStatus(saved), created: true, deduped: false };
}

export async function createAttachmentUploadSession(
  reportId: string,
  attachmentId: string,
): Promise<UploadSession> {
  requireStorage();

  const found = await reportsRepository.getAttachment(reportId, attachmentId);
  if (!found) {
    throw new NotFoundError('Attachment');
  }
  if (found.attachment.status === AttachmentStatus.Uploaded) {
    throw new ConflictError('Attachment is already uploaded');
  }

  await reportsRepository.setAttachmentStatus(
    reportId,
    attachmentId,
    AttachmentStatus.Uploading,
  );

  return createUploadSession({
    objectPath: found.attachment.objectPath,
    contentType: found.attachment.contentType,
    sizeBytes: found.attachment.sizeBytes,
  });
}

export async function completeAttachment(
  reportId: string,
  attachmentId: string,
): Promise<{ report: Report; attachment: Attachment }> {
  requireStorage();

  const found = await reportsRepository.getAttachment(reportId, attachmentId);
  if (!found) {
    throw new NotFoundError('Attachment');
  }

  if (found.attachment.status === AttachmentStatus.Uploaded) {
    return {
      report: withDerivedStatus(found.report),
      attachment: found.attachment,
    };
  }

  if (found.attachment.status === AttachmentStatus.Failed) {
    throw new ConflictError(
      'Attachment failed — request a new upload-session to retry',
    );
  }

  const saved = await reportsRepository.setAttachmentStatus(
    reportId,
    attachmentId,
    AttachmentStatus.Uploaded,
  );
  const savedAttachment = saved.attachments.find((a) => a.id === attachmentId)!;
  return { report: withDerivedStatus(saved), attachment: savedAttachment };
}

export async function failAttachment(
  reportId: string,
  attachmentId: string,
  reason?: string,
): Promise<{ report: Report; attachment: Attachment }> {
  const found = await reportsRepository.getAttachment(reportId, attachmentId);
  if (!found) {
    throw new NotFoundError('Attachment');
  }
  if (found.attachment.status === AttachmentStatus.Uploaded) {
    throw new ConflictError('Cannot fail an already uploaded attachment');
  }
  if (found.attachment.status === AttachmentStatus.Failed) {
    return {
      report: withDerivedStatus(found.report),
      attachment: found.attachment,
    };
  }

  const saved = await reportsRepository.setAttachmentStatus(
    reportId,
    attachmentId,
    AttachmentStatus.Failed,
    reason ?? 'Upload refused',
  );
  const savedAttachment = saved.attachments.find((a) => a.id === attachmentId)!;
  return { report: withDerivedStatus(saved), attachment: savedAttachment };
}

export async function getAttachmentStatus(reportId: string, attachmentId: string) {
  const found = await reportsRepository.getAttachment(reportId, attachmentId);
  if (!found) {
    throw new NotFoundError('Attachment');
  }

  const retryable = isAttachmentRetryable(found.attachment.status);
  return {
    reportId,
    attachment: found.attachment,
    reportStatus: withDerivedStatus(found.report).status,
    retryable,
    resumable: retryable,
  };
}

export async function resetAllReports() {
  return { removedReports: await reportsRepository.clear() };
}

export async function deleteReport(reportId: string) {
  const existing = await reportsRepository.getById(reportId);
  if (!existing) {
    throw new NotFoundError('Report');
  }
  await reportsRepository.deleteById(reportId);
  return { ok: true, reportId };
}
