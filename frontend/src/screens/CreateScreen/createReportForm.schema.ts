import { z } from 'zod';

/** Max size of the temporary local copy before compression. */
export const MAX_LOCAL_COPY_BYTES = 150 * 1024 * 1024;

/** Max size after compression (upload / form). Matches brief. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const MIN_IMAGES = 1;
export const MAX_IMAGES = 5;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Draft photo in the compose form — may still be a large camera original.
 * Compression to ≤5 MB runs when the user taps Save.
 */
export const formImageSchema = z.object({
  uri: z.string().min(1),
  fileName: z.string().min(1),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    message: 'Use a JPEG, PNG, WebP, or HEIC photo',
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_LOCAL_COPY_BYTES, 'This photo exceeds the size limit for this device'),
});

export const createReportFormSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(4000, 'Description is too long'),
  images: z
    .array(formImageSchema)
    .min(MIN_IMAGES, 'Add at least 1 photo')
    .max(MAX_IMAGES, 'At most 5 photos'),
});

export type FormImage = z.infer<typeof formImageSchema>;
export type CreateReportFormValues = z.infer<typeof createReportFormSchema>;
