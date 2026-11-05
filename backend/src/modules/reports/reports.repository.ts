import type { PoolClient } from 'pg';

import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/index.js';
import { getPool, withTransaction } from '../../config/db.js';
import {
  AttachmentStatus,
  deriveReportStatus,
  type Attachment,
  type Report,
} from './reports.model.js';

type ReportRow = {
  id: string;
  description: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type AttachmentRow = {
  id: string;
  report_id: string;
  file_name: string;
  content_type: string;
  size_bytes: string | number;
  sha256: string | null;
  object_path: string;
  status: AttachmentStatus;
  failure_reason: string | null;
  uploaded_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type Queryable = PoolClient | Awaited<ReturnType<typeof getPool>>;

function asIso(value: Date | string | null | undefined): string | undefined {
  if (value == null) {
    return undefined;
  }
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function mapAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    reportId: row.report_id,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256 ?? undefined,
    objectPath: row.object_path,
    status: row.status,
    failureReason: row.failure_reason ?? undefined,
    uploadedAt: asIso(row.uploaded_at),
    createdAt: asIso(row.created_at)!,
    updatedAt: asIso(row.updated_at)!,
  };
}

function mapReport(row: ReportRow, attachments: Attachment[]): Report {
  return {
    id: row.id,
    description: row.description,
    status: deriveReportStatus(attachments),
    attachments,
    createdAt: asIso(row.created_at)!,
    updatedAt: asIso(row.updated_at)!,
  };
}

async function loadAttachments(
  client: Queryable,
  reportId: string,
): Promise<Attachment[]> {
  const result = await client.query<AttachmentRow>(
    `SELECT * FROM public.attachments
     WHERE report_id = $1
     ORDER BY created_at ASC`,
    [reportId],
  );
  return result.rows.map(mapAttachment);
}

async function loadReport(client: Queryable, row: ReportRow): Promise<Report> {
  return mapReport(row, await loadAttachments(client, row.id));
}

async function syncReportStatus(client: PoolClient, reportId: string) {
  const status = deriveReportStatus(await loadAttachments(client, reportId));
  await client.query(
    `UPDATE public.reports
     SET status = $2, updated_at = NOW()
     WHERE id = $1`,
    [reportId, status],
  );
}

function throwIfUniqueViolation(error: unknown): never {
  const pgError = error as {
    code?: string;
    detail?: string;
    constraint?: string;
  };
  const code = String(pgError.code ?? '');
  const detail = String(pgError.detail ?? '');
  const constraint = String(pgError.constraint ?? '');

  if (code === '23505') {
    if (constraint.includes('object_path') || detail.includes('object_path')) {
      throw new ConflictError('Storage path already exists');
    }
    if (constraint.includes('attachments') || detail.includes('attachments')) {
      throw new ConflictError('Attachment id already exists');
    }
    if (constraint.includes('reports') || detail.includes('reports')) {
      throw new ConflictError('Report id already exists');
    }
  }

  throw error;
}

export const reportsRepository = {
  async list(): Promise<Report[]> {
    const db = await getPool();
    const result = await db.query<ReportRow>(
      `SELECT * FROM public.reports
       ORDER BY created_at DESC`,
    );
    return Promise.all(result.rows.map((row) => loadReport(db, row)));
  },

  async listPage(input: {
    limit: number;
    offset: number;
  }): Promise<{ reports: Report[]; total: number }> {
    const db = await getPool();
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM public.reports`,
    );
    const total = Number(countResult.rows[0]?.count ?? 0);

    const result = await db.query<ReportRow>(
      `SELECT * FROM public.reports
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [input.limit, input.offset],
    );

    const reports = await Promise.all(
      result.rows.map((row) => loadReport(db, row)),
    );
    return { reports, total };
  },

  async getById(id: string): Promise<Report | undefined> {
    const db = await getPool();
    const result = await db.query<ReportRow>(
      'SELECT * FROM public.reports WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    return row ? loadReport(db, row) : undefined;
  },

  async insert(report: Report): Promise<Report> {
    try {
      await withTransaction(async (client) => {
        if (report.attachments.length > 0) {
          const ids = report.attachments.map((a) => a.id);
          const paths = report.attachments.map((a) => a.objectPath);

          const existingAttachment = await client.query(
            `SELECT id FROM public.attachments
             WHERE id = ANY($1::text[])
             LIMIT 1`,
            [ids],
          );
          if (existingAttachment.rowCount) {
            throw new ConflictError('Attachment id already exists');
          }

          const existingPath = await client.query(
            `SELECT object_path FROM public.attachments
             WHERE object_path = ANY($1::text[])
             LIMIT 1`,
            [paths],
          );
          if (existingPath.rowCount) {
            throw new ConflictError('Storage path already exists');
          }
        }

        await client.query(
          `INSERT INTO public.reports (id, description, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)`,
          [
            report.id,
            report.description,
            report.status,
            report.createdAt,
            report.updatedAt,
          ],
        );

        for (const attachment of report.attachments) {
          await client.query(
            `INSERT INTO public.attachments (
               id, report_id, file_name, content_type, size_bytes, sha256,
               object_path, status, failure_reason, uploaded_at, created_at, updated_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10::timestamptz, $11::timestamptz, $12::timestamptz
             )`,
            [
              attachment.id,
              attachment.reportId,
              attachment.fileName,
              attachment.contentType,
              attachment.sizeBytes,
              attachment.sha256 ?? null,
              attachment.objectPath,
              attachment.status,
              attachment.failureReason ?? null,
              attachment.uploadedAt ?? null,
              attachment.createdAt,
              attachment.updatedAt,
            ],
          );
        }
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throwIfUniqueViolation(error);
    }

    return (await this.getById(report.id))!;
  },

  async setAttachmentStatus(
    reportId: string,
    attachmentId: string,
    status: AttachmentStatus,
    failureReason?: string | null,
  ): Promise<Report> {
    await withTransaction(async (client) => {
      const result =
        status === AttachmentStatus.Uploaded
          ? await client.query(
              `UPDATE public.attachments
               SET status = $3,
                   failure_reason = NULL,
                   uploaded_at = COALESCE(uploaded_at, NOW()),
                   updated_at = NOW()
               WHERE id = $1 AND report_id = $2`,
              [attachmentId, reportId, status],
            )
          : await client.query(
              `UPDATE public.attachments
               SET status = $3,
                   failure_reason = $4,
                   uploaded_at = NULL,
                   updated_at = NOW()
               WHERE id = $1 AND report_id = $2`,
              [
                attachmentId,
                reportId,
                status,
                status === AttachmentStatus.Failed
                  ? (failureReason ?? 'rejected')
                  : null,
              ],
            );

      if (!result.rowCount) {
        throw new NotFoundError('Attachment');
      }

      await syncReportStatus(client, reportId);
    });

    return (await this.getById(reportId))!;
  },

  async clear(): Promise<number> {
    return withTransaction(async (client) => {
      const count = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM public.reports',
      );
      await client.query('DELETE FROM public.attachments');
      await client.query('DELETE FROM public.reports');
      return Number(count.rows[0]?.count ?? 0);
    });
  },

  async deleteById(reportId: string): Promise<boolean> {
    const db = await getPool();
    const result = await db.query(
      'DELETE FROM public.reports WHERE id = $1',
      [reportId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async getAttachment(
    reportId: string,
    attachmentId: string,
  ): Promise<{ report: Report; attachment: Attachment } | undefined> {
    const report = await this.getById(reportId);
    if (!report) {
      return undefined;
    }

    const attachment = report.attachments.find((a) => a.id === attachmentId);
    if (!attachment) {
      return undefined;
    }

    return { report, attachment };
  },
};
