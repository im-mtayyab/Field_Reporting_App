export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MIN_ATTACHMENTS = 1;
export const MAX_ATTACHMENTS = 5;

export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const DEFAULT_BUCKET = 'field-report-images';
