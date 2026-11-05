import { getDb } from '../../db';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadAttachment,
  type UploadReport,
} from '../../types/uploadQueue';

type ReportRow = {
  id: string;
  description: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  remote_created: number;
  created_at: string;
  updated_at: string;
};

type AttachmentRow = {
  id: string;
  report_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  local_uri: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  sort_order: number;
  prepared?: number | null;
  upload_url?: string | null;
  upload_offset?: number | null;
  access_token?: string | null;
  object_path?: string | null;
  upload_job_id?: string | null;
  created_at: string;
  updated_at: string;
};

function mapAttachment(row: AttachmentRow): UploadAttachment {
  return {
    id: row.id,
    reportId: row.report_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    localUri: row.local_uri,
    status: row.status as UploadAttachmentStatus,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    sortOrder: row.sort_order,
    // Pre-v3 rows default prepared; new drafts set 0 until compress finishes.
    prepared: row.prepared == null ? true : row.prepared === 1,
    uploadUrl: row.upload_url ?? null,
    uploadOffset: row.upload_offset ?? 0,
    accessToken: row.access_token ?? null,
    objectPath: row.object_path ?? null,
    uploadJobId: row.upload_job_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReport(
  row: ReportRow,
  attachments: UploadAttachment[],
): UploadReport {
  return {
    id: row.id,
    description: row.description,
    status: row.status as UploadReportStatus,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    remoteCreated: row.remote_created === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachments,
  };
}

async function loadAttachments(reportId: string): Promise<UploadAttachment[]> {
  const db = getDb();
  const result = await db.execute(
    `SELECT * FROM outbox_attachments
     WHERE report_id = ?
     ORDER BY sort_order ASC`,
    [reportId],
  );
  return (result.rows as AttachmentRow[]).map(mapAttachment);
}

export const uploadQueueRepository = {
  async insertReport(report: UploadReport): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        `INSERT INTO outbox_reports (
          id, description, status, attempt_count, last_error,
          remote_created, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          report.id,
          report.description,
          report.status,
          report.attemptCount,
          report.lastError,
          report.remoteCreated ? 1 : 0,
          report.createdAt,
          report.updatedAt,
        ],
      );

      for (const item of report.attachments) {
        await tx.execute(
          `INSERT INTO outbox_attachments (
            id, report_id, file_name, content_type, size_bytes, local_uri,
            status, attempt_count, last_error, sort_order, prepared,
            upload_url, upload_offset, access_token, object_path, upload_job_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.reportId,
            item.fileName,
            item.contentType,
            item.sizeBytes,
            item.localUri,
            item.status,
            item.attemptCount,
            item.lastError,
            item.sortOrder,
            item.prepared ? 1 : 0,
            item.uploadUrl,
            item.uploadOffset,
            item.accessToken,
            item.objectPath,
            item.uploadJobId,
            item.createdAt,
            item.updatedAt,
          ],
        );
      }
    });
  },

  async listReports(): Promise<UploadReport[]> {
    const db = getDb();
    const result = await db.execute(
      `SELECT * FROM outbox_reports ORDER BY created_at DESC`,
    );
    const rows = result.rows as ReportRow[];
    const reports: UploadReport[] = [];
    for (const row of rows) {
      reports.push(mapReport(row, await loadAttachments(row.id)));
    }
    return reports;
  },

  async getReport(id: string): Promise<UploadReport | null> {
    const db = getDb();
    const result = await db.execute(
      `SELECT * FROM outbox_reports WHERE id = ?`,
      [id],
    );
    const row = (result.rows as ReportRow[])[0];
    if (!row) {
      return null;
    }
    return mapReport(row, await loadAttachments(row.id));
  },

  /**
   * Next job: pending creates only, or uploading reports that still have
   * pending files. Failed stays failed until the user taps Retry.
   */
  async claimNextReport(): Promise<UploadReport | null> {
    const db = getDb();
    // Skip reports with any paused photo — user owns that report until Resume.
    const result = await db.execute(
      `SELECT r.* FROM outbox_reports r
       WHERE (
          r.status = ?
          OR (
            r.status = ?
            AND r.remote_created = 1
            AND EXISTS (
              SELECT 1 FROM outbox_attachments a
              WHERE a.report_id = r.id
                AND a.status IN (?, ?)
                AND a.prepared = 1
            )
          )
       )
       AND NOT EXISTS (
         SELECT 1 FROM outbox_attachments p
         WHERE p.report_id = r.id
           AND p.status = ?
       )
       ORDER BY r.created_at ASC
       LIMIT 1`,
      [
        UploadReportStatus.Pending,
        UploadReportStatus.Uploading,
        UploadAttachmentStatus.Pending,
        UploadAttachmentStatus.Uploading,
        UploadAttachmentStatus.Paused,
      ],
    );
    const row = (result.rows as ReportRow[])[0];
    if (!row) {
      return null;
    }
    return mapReport(row, await loadAttachments(row.id));
  },

  async updateReport(
    id: string,
    patch: Partial<{
      status: UploadReportStatus;
      attemptCount: number;
      lastError: string | null;
      remoteCreated: boolean;
    }>,
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const current = await db.execute(
      `SELECT * FROM outbox_reports WHERE id = ?`,
      [id],
    );
    const row = (current.rows as ReportRow[])[0];
    if (!row) {
      return;
    }

    await db.execute(
      `UPDATE outbox_reports SET
        status = ?,
        attempt_count = ?,
        last_error = ?,
        remote_created = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        patch.status ?? row.status,
        patch.attemptCount ?? row.attempt_count,
        patch.lastError === undefined ? row.last_error : patch.lastError,
        patch.remoteCreated === undefined
          ? row.remote_created
          : patch.remoteCreated
            ? 1
            : 0,
        now,
        id,
      ],
    );
  },

  async updateAttachment(
    id: string,
    patch: Partial<{
      status: UploadAttachmentStatus;
      attemptCount: number;
      lastError: string | null;
      localUri: string;
      sizeBytes: number;
      contentType: string;
      fileName: string;
      prepared: boolean;
      uploadUrl: string | null;
      uploadOffset: number;
      accessToken: string | null;
      objectPath: string | null;
      uploadJobId: string | null;
    }>,
  ): Promise<void> {
    const db = getDb();
    const now = new Date().toISOString();
    const current = await db.execute(
      `SELECT * FROM outbox_attachments WHERE id = ?`,
      [id],
    );
    const row = (current.rows as AttachmentRow[])[0];
    if (!row) {
      return;
    }

    await db.execute(
      `UPDATE outbox_attachments SET
        status = ?,
        attempt_count = ?,
        last_error = ?,
        local_uri = ?,
        size_bytes = ?,
        content_type = ?,
        file_name = ?,
        prepared = ?,
        upload_url = ?,
        upload_offset = ?,
        access_token = ?,
        object_path = ?,
        upload_job_id = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        patch.status ?? row.status,
        patch.attemptCount ?? row.attempt_count,
        patch.lastError === undefined ? row.last_error : patch.lastError,
        patch.localUri ?? row.local_uri,
        patch.sizeBytes ?? row.size_bytes,
        patch.contentType ?? row.content_type,
        patch.fileName ?? row.file_name,
        patch.prepared === undefined
          ? row.prepared == null
            ? 1
            : row.prepared
          : patch.prepared
            ? 1
            : 0,
        patch.uploadUrl === undefined ? row.upload_url ?? null : patch.uploadUrl,
        patch.uploadOffset ?? row.upload_offset ?? 0,
        patch.accessToken === undefined
          ? row.access_token ?? null
          : patch.accessToken,
        patch.objectPath === undefined
          ? row.object_path ?? null
          : patch.objectPath,
        patch.uploadJobId === undefined
          ? row.upload_job_id ?? null
          : patch.uploadJobId,
        now,
        id,
      ],
    );
  },

  async countByStatus(): Promise<Record<UploadReportStatus, number>> {
    const db = getDb();
    const result = await db.execute(
      `SELECT status, COUNT(*) AS count FROM outbox_reports GROUP BY status`,
    );
    const counts: Record<UploadReportStatus, number> = {
      [UploadReportStatus.Pending]: 0,
      [UploadReportStatus.Uploading]: 0,
      [UploadReportStatus.Delivered]: 0,
      [UploadReportStatus.Failed]: 0,
    };
    for (const row of result.rows ?? []) {
      const status = String(row.status) as UploadReportStatus;
      counts[status] = Number(row.count) || 0;
    }
    return counts;
  },

  async clearLocalQueue(): Promise<void> {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.execute('DELETE FROM sync_logs');
      await tx.execute('DELETE FROM outbox_attachments');
      await tx.execute('DELETE FROM outbox_reports');
    });
  },
};
