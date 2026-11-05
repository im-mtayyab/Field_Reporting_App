import type { Request, Response } from 'express';

import { ValidationError } from '../../common/errors/index.js';
import { routeParam } from '../../common/utils/params.js';
import * as reportsService from './reports.service.js';
import {
  createReportSchema,
  failAttachmentSchema,
  listReportsQuerySchema,
} from './reports.validation.js';

export async function list(req: Request, res: Response) {
  const parsed = listReportsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Invalid query',
      parsed.error.issues,
    );
  }

  const page = await reportsService.listReports(parsed.data);
  res.json(page);
}

export async function getById(req: Request, res: Response) {
  const report = await reportsService.getReport(routeParam(req.params.reportId));
  res.json({ report });
}

export async function create(req: Request, res: Response) {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Invalid request body',
      parsed.error.issues,
    );
  }

  const { report, created, deduped } = await reportsService.createReport(
    parsed.data,
  );
  res.status(created ? 201 : 200).json({ report, deduped });
}

export async function createUploadSession(req: Request, res: Response) {
  const session = await reportsService.createAttachmentUploadSession(
    routeParam(req.params.reportId),
    routeParam(req.params.attachmentId),
  );
  res.status(201).json(session);
}

export async function completeAttachment(req: Request, res: Response) {
  const result = await reportsService.completeAttachment(
    routeParam(req.params.reportId),
    routeParam(req.params.attachmentId),
  );
  res.json(result);
}

export async function failAttachment(req: Request, res: Response) {
  const parsed = failAttachmentSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues[0]?.message ?? 'Invalid request body',
      parsed.error.issues,
    );
  }

  const result = await reportsService.failAttachment(
    routeParam(req.params.reportId),
    routeParam(req.params.attachmentId),
    parsed.data.reason,
  );
  res.json(result);
}

export async function attachmentStatus(req: Request, res: Response) {
  const status = await reportsService.getAttachmentStatus(
    routeParam(req.params.reportId),
    routeParam(req.params.attachmentId),
  );
  res.json(status);
}

export async function resetAll(_req: Request, res: Response) {
  const result = await reportsService.resetAllReports();
  res.json({ ok: true, ...result });
}

export async function deleteById(req: Request, res: Response) {
  const result = await reportsService.deleteReport(
    routeParam(req.params.reportId),
  );
  res.json(result);
}
