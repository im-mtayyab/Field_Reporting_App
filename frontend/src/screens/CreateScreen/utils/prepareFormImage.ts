import {
  Image as ImageCompressor,
  getFileSize,
  getRealPath,
} from 'react-native-compressor';
import type { Asset } from 'react-native-image-picker';

import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_LOCAL_COPY_BYTES,
  type AllowedImageType,
  type FormImage,
} from '../createReportForm.schema';

// FormImage is the draft shape held in the compose form (may be >5 MB).

/**
 * Brief: app never sends an image over 5 MB. 18–40 MB+ camera originals are
 * valid input — they must arrive under the ceiling and still look usable.
 */
export const TARGET_IMAGE_BYTES = MAX_IMAGE_BYTES;

/**
 * Ladder for large camera JPEGs. Prefer keeping edge ≥640 so field photos stay
 * readable. `auto` uses Android inSampleSize (safe for 20–40 MB files); `manual`
 * full-decodes and OOMs on low-RAM devices — only used after a successful downsample.
 */
export const COMPRESS_STEPS = [
  { maxEdge: 1600, quality: 0.72 },
  { maxEdge: 1280, quality: 0.65 },
  { maxEdge: 1024, quality: 0.55 },
  { maxEdge: 800, quality: 0.45 },
  { maxEdge: 640, quality: 0.35 },
  { maxEdge: 512, quality: 0.28 },
  { maxEdge: 400, quality: 0.22 },
  { maxEdge: 320, quality: 0.16 },
] as const;

/** Skip the softest steps when the original is already huge (faster + safer). */
function startStepIndex(sizeBytes: number): number {
  if (sizeBytes >= 30 * 1024 * 1024) {
    return 2; // 1024
  }
  if (sizeBytes >= 15 * 1024 * 1024) {
    return 1; // 1280
  }
  return 0;
}

export type PrepareImageFailureReason =
  | 'missing_uri'
  | 'unsupported_type'
  | 'unreadable'
  | 'too_large'
  | 'compress_failed';

export type PrepareImageResult =
  | { ok: true; image: FormImage }
  | { ok: false; reason: PrepareImageFailureReason };

export type CompressAttempt = {
  uri: string;
  sizeBytes: number;
};

function normalizeContentType(
  value: string | undefined,
): AllowedImageType | null {
  const raw = (value ?? 'image/jpeg').trim().toLowerCase();
  const normalized = raw === 'image/jpg' ? 'image/jpeg' : raw;
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AllowedImageType)
    : null;
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

function stripFileScheme(uri: string): string {
  const normalized = normalizeLocalUri(uri);
  return normalized.startsWith('file://')
    ? normalized.slice('file://'.length)
    : normalized;
}

function sameLocalFile(a: string, b: string): boolean {
  const left = stripFileScheme(a);
  const right = stripFileScheme(b);
  return left.length > 0 && left === right;
}

/** content:// → app byte-copy. Never use gallery originalPath. */
async function saveLocalCopy(uri: string): Promise<string> {
  const normalized = normalizeLocalUri(uri);
  if (normalized.startsWith('content://')) {
    try {
      const real = await getRealPath(normalized, 'image');
      return normalizeLocalUri(real || normalized);
    } catch {
      return normalized;
    }
  }
  return normalized;
}

async function readSizeBytes(uri: string, fallback = 0): Promise<number> {
  const candidates = [uri, normalizeLocalUri(uri)];
  for (const candidate of candidates) {
    try {
      const size = Number(await getFileSize(candidate));
      if (Number.isFinite(size) && size > 0) {
        return size;
      }
    } catch {
      // try next
    }
  }
  return fallback;
}

async function deleteLocalCopy(uri: string): Promise<void> {
  const normalized = normalizeLocalUri(uri);
  if (!normalized.startsWith('file://')) {
    return;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-fs') as {
      unlink?: (path: string) => Promise<void>;
      exists?: (path: string) => Promise<boolean>;
    };
    const path = stripFileScheme(normalized);
    if (mod.exists && !(await mod.exists(path))) {
      return;
    }
    if (mod.unlink) {
      await mod.unlink(path);
    }
  } catch {
    // best-effort — MediaCache may reclaim intermediates later
  }
}

/**
 * One compress attempt. Prefer `auto` (sampled decode). Only try `manual`
 * after we already have a downsampled intermediate — full decode of an
 * 18–40 MB original OOMs on low-RAM Android.
 */
async function compressOnce(
  sourceUri: string,
  maxEdge: number,
  quality: number,
  allowManual: boolean,
): Promise<CompressAttempt | null> {
  const methods = allowManual
    ? (['auto', 'manual'] as const)
    : (['auto'] as const);

  for (const method of methods) {
    try {
      const outUri = normalizeLocalUri(
        await ImageCompressor.compress(sourceUri, {
          compressionMethod: method,
          maxWidth: maxEdge,
          maxHeight: maxEdge,
          quality,
          output: 'jpg',
        }),
      );
      const sizeBytes = await readSizeBytes(outUri);
      if (sizeBytes > 0) {
        return { uri: outUri, sizeBytes };
      }
    } catch {
      // try next method / step
    }
  }
  return null;
}

/**
 * Re-encodes an image until its on-disk size is within the target limit.
 * Each successful smaller output becomes the next compression input.
 *
 * @param localUri - Local file URI of the source image.
 * @param targetBytes - Maximum allowed size in bytes.
 * @param originalSizeBytes - Optional known source size used to pick the step ladder.
 * @returns The final compressed URI and size, or `null` if the limit cannot be met.
 */
export async function compressToMaxBytes(
  localUri: string,
  targetBytes: number = TARGET_IMAGE_BYTES,
  originalSizeBytes?: number,
): Promise<CompressAttempt | null> {
  const sourceUri = normalizeLocalUri(localUri);
  let currentUri = sourceUri;
  let currentSize =
    originalSizeBytes && originalSizeBytes > 0
      ? originalSizeBytes
      : await readSizeBytes(sourceUri);
  let previousUri: string | null = null;

  const steps = COMPRESS_STEPS.slice(startStepIndex(currentSize || 0));

  for (const step of steps) {
    const hasDownsampled = !sameLocalFile(currentUri, sourceUri);
    const hit = await compressOnce(
      currentUri,
      step.maxEdge,
      step.quality,
      hasDownsampled,
    );

    if (!hit) {
      continue;
    }

    // Native lib returns the source path when output was not smaller — no progress.
    if (sameLocalFile(hit.uri, currentUri)) {
      if (hit.sizeBytes > 0 && hit.sizeBytes <= targetBytes) {
        return hit;
      }
      continue;
    }

    if (hit.sizeBytes <= targetBytes) {
      if (previousUri && !sameLocalFile(previousUri, hit.uri)) {
        await deleteLocalCopy(previousUri);
      }
      if (!sameLocalFile(sourceUri, hit.uri)) {
        await deleteLocalCopy(sourceUri);
      }
      return hit;
    }

    // Still over target — chain onto this intermediate if it is not larger.
    if (
      hit.sizeBytes > 0 &&
      !sameLocalFile(hit.uri, currentUri) &&
      (currentSize <= 0 || hit.sizeBytes <= currentSize)
    ) {
      if (
        previousUri &&
        !sameLocalFile(previousUri, hit.uri) &&
        !sameLocalFile(previousUri, sourceUri)
      ) {
        await deleteLocalCopy(previousUri);
      }
      previousUri = currentUri;
      currentUri = hit.uri;
      currentSize = hit.sizeBytes;
    }
  }

  return null;
}

/**
 * Accepts a picker asset as a draft form image without compression.
 * Gallery URIs are suitable for immediate thumbnails; durable copy and
 * compression run later during save preparation.
 *
 * @param asset - Native image-picker asset selected by the user.
 * @returns A draft {@link FormImage}, or a typed failure reason.
 */
export function acceptDraftImage(asset: Asset): PrepareImageResult {
  if (!asset.uri) {
    return { ok: false, reason: 'missing_uri' };
  }

  const contentType = normalizeContentType(asset.type);
  if (!contentType) {
    return { ok: false, reason: 'unsupported_type' };
  }

  const reportedBytes =
    asset.fileSize && asset.fileSize > 0 ? asset.fileSize : 0;
  if (reportedBytes > MAX_LOCAL_COPY_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  const fileName = asset.fileName?.trim() || `photo-${Date.now()}.jpg`;

  return {
    ok: true,
    image: {
      uri: normalizeLocalUri(asset.uri),
      fileName,
      contentType,
      sizeBytes: reportedBytes > 0 ? reportedBytes : 1,
    },
  };
}

/**
 * Compresses a draft photo to the upload size limit.
 * Resolves gallery content URIs to a durable local path before encoding.
 *
 * @param draft - Draft image from the create form.
 * @returns A compressed {@link FormImage}, or a typed failure reason.
 */
export async function compressFormImage(
  draft: FormImage,
): Promise<PrepareImageResult> {
  const localUri = await saveLocalCopy(draft.uri);
  const measuredBytes = await readSizeBytes(localUri);
  const localSizeBytes =
    measuredBytes > 0 ? measuredBytes : draft.sizeBytes;

  if (!(localSizeBytes > 0)) {
    return { ok: false, reason: 'unreadable' };
  }
  if (localSizeBytes > MAX_LOCAL_COPY_BYTES) {
    return { ok: false, reason: 'too_large' };
  }

  if (measuredBytes > 0 && measuredBytes <= TARGET_IMAGE_BYTES) {
    return {
      ok: true,
      image: {
        uri: localUri,
        fileName: draft.fileName,
        contentType: draft.contentType,
        sizeBytes: measuredBytes,
      },
    };
  }

  if (
    measuredBytes <= 0 &&
    draft.sizeBytes > 0 &&
    draft.sizeBytes <= TARGET_IMAGE_BYTES
  ) {
    return {
      ok: true,
      image: {
        uri: localUri,
        fileName: draft.fileName,
        contentType: draft.contentType,
        sizeBytes: draft.sizeBytes,
      },
    };
  }

  const compressed = await compressToMaxBytes(
    localUri,
    TARGET_IMAGE_BYTES,
    localSizeBytes,
  );
  if (!compressed || compressed.sizeBytes > TARGET_IMAGE_BYTES) {
    return { ok: false, reason: 'compress_failed' };
  }

  return {
    ok: true,
    image: {
      uri: compressed.uri,
      fileName: draft.fileName.replace(/\.\w+$/, '.jpg'),
      contentType: 'image/jpeg',
      sizeBytes: compressed.sizeBytes,
    },
  };
}

/**
 * Accepts a picker asset and compresses it to the upload size limit.
 *
 * @param asset - Native image-picker asset selected by the user.
 * @returns A prepared {@link FormImage}, or a typed failure reason.
 */
export async function prepareFormImage(
  asset: Asset,
): Promise<PrepareImageResult> {
  const draft = acceptDraftImage(asset);
  if (!draft.ok) {
    return draft;
  }
  return compressFormImage(draft.image);
}
