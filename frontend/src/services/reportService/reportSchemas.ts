import { z } from 'zod';

import { AttachmentStatus, ReportStatus } from '../../types/report';

const reportStatusSchema = z.nativeEnum(ReportStatus);
const attachmentStatusSchema = z.nativeEnum(AttachmentStatus);

export const attachmentSchema = z.object({
  id: z.string().min(1),
  reportId: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().nonnegative(),
  sha256: z.string().optional(),
  objectPath: z.string().min(1),
  downloadUrl: z.string().url().optional(),
  status: attachmentStatusSchema,
  failureReason: z.string().optional(),
  uploadedAt: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const reportSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  status: reportStatusSchema,
  attachments: z.array(attachmentSchema).default([]),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const listReportsResponseSchema = z.object({
  reports: z.array(reportSchema).nullable().optional(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export const getReportResponseSchema = z.object({
  report: reportSchema,
});

export const resetReportsResponseSchema = z.object({
  ok: z.boolean(),
  removedReports: z.number().int().nonnegative(),
});
