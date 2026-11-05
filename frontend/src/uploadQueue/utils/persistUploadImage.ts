import {
  Image as ImageCompressor,
  getFileSize,
} from 'react-native-compressor';

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type AllowedImageType,
} from '../../screens/CreateScreen/createReportForm.schema';

function asAllowedContentType(value: string): AllowedImageType {
  const raw = value.trim().toLowerCase();
  const normalized = raw === 'image/jpg' ? 'image/jpeg' : raw;
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized)) {
    return normalized as AllowedImageType;
  }
  return 'image/jpeg';
}

function normalizeLocalUri(uri: string): string {
  let next = uri.trim();
  while (next.startsWith('file://file://')) {
    next = next.replace('file://file://', 'file://');
  }
  if (next.startsWith('/') && !next.startsWith('file:')) {
    next = `file://${next}`;
  }
  return next;
}

async function readSizeBytes(uri: string): Promise<number> {
  try {
    const size = Number(await getFileSize(uri));
    return Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
}

/**
 * Copy the prepared photo into a durable compressor-managed path and re-measure
 * size. Picker/cache URIs can vanish before TUS runs — that looked like
 * “3 MB never uploads”.
 */
export async function persistUploadImage(params: {
  reportId: string;
  attachmentId: string;
  sourceUri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): Promise<{
  uri: string;
  fileName: string;
  sizeBytes: number;
  contentType: AllowedImageType;
}> {
  const contentType = asAllowedContentType(params.contentType);
  const sourceUri = normalizeLocalUri(params.sourceUri);

  if (!(params.sizeBytes > 0 && params.sizeBytes <= MAX_IMAGE_BYTES)) {
    throw new Error('Image must be under 5 MB before save');
  }

  let durableUri = sourceUri;
  try {
    // Light re-encode into app-owned storage (not the image-picker temp).
    durableUri = normalizeLocalUri(
      await ImageCompressor.compress(sourceUri, {
        compressionMethod: 'auto',
        maxWidth: 2560,
        maxHeight: 2560,
        quality: 0.92,
        output: 'jpg',
      }),
    );
  } catch {
    durableUri = sourceUri;
  }

  const measured = await readSizeBytes(durableUri);
  const sizeBytes = measured > 0 ? measured : params.sizeBytes;

  if (!(sizeBytes > 0 && sizeBytes <= MAX_IMAGE_BYTES)) {
    throw new Error('Image must be under 5 MB before save');
  }

  return {
    uri: durableUri,
    fileName: params.fileName.replace(/\.\w+$/, '.jpg'),
    sizeBytes,
    contentType: 'image/jpeg',
  };
}
