import { z } from 'zod';

import {
  ALLOWED_CONTENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_IMAGE_BYTES,
  MIN_ATTACHMENTS,
} from '../../common/constants/index.js';

const idSchema = z
  .string()
  .trim()
  .min(8)
  .max(80)
  .regex(/^[0-9a-zA-Z_-]+$/, 'Invalid id format');

const attachmentSchema = z.object({
  attachmentId: idSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => (ALLOWED_CONTENT_TYPES as readonly string[]).includes(value),
      'Unsupported content type — use jpeg/png/webp/heic',
    ),
  sizeBytes: z
    .number({ invalid_type_error: 'sizeBytes must be a number' })
    .int('sizeBytes must be an integer')
    .positive('sizeBytes must be > 0')
    .refine(
      (value) => value < MAX_IMAGE_BYTES,
      `Each image must be under ${MAX_IMAGE_BYTES} bytes (5 MB)`,
    ),
  sha256: z.string().trim().min(16).max(128).optional(),
});

export const createReportSchema = z.object({
  reportId: idSchema,
  description: z.string().trim().min(1, 'Description is required').max(4000),
  attachments: z
    .array(attachmentSchema)
    .min(MIN_ATTACHMENTS, 'At least 1 image is required')
    .max(MAX_ATTACHMENTS, 'At most 5 images are allowed')
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      for (const [index, item] of items.entries()) {
        if (seen.has(item.attachmentId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Duplicate attachmentId',
            path: [index, 'attachmentId'],
          });
        }
        seen.add(item.attachmentId);
      }
    }),
});

export const failAttachmentSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const listReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateReportBody = z.infer<typeof createReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;
