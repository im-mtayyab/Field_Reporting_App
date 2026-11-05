import { Linking } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import { MAX_IMAGES, type FormImage } from '../createReportForm.schema';
import { acceptDraftImage } from './prepareFormImage';
import { requestMediaPermission } from './requestCreateMediaPermissions';

type PickSource = 'camera' | 'library';

type PickResult =
  | {
      ok: true;
      images: FormImage[];
      skipped: number;
      skipReason?:
        | 'unsupported_type'
        | 'missing_uri'
        | 'unreadable'
        | 'too_large'
        | 'compress_failed';
    }
  | {
      ok: false;
      reason: 'cancelled' | 'permission' | 'camera_unavailable' | 'error';
      message?: string;
      canOpenSettings?: boolean;
    };

/**
 * Prefer a decoded app-local JPEG so gallery/DRM blobs are usable later.
 * Compression to ≤5 MB happens on Save — not while picking.
 */
const PICKER_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 0.95 as const,
  assetRepresentationMode: 'compatible' as const,
};

/**
 * Opens the operating system Settings screen for this application.
 */
export function openAppPermissionSettings(): void {
  void Linking.openSettings();
}

/**
 * Maps picker assets into draft form images without blocking on compression.
 *
 * @param response - Native image-picker response.
 * @param remaining - Maximum number of additional photos still allowed.
 * @returns Accepted draft images plus skip counts, or a failure result.
 */
async function mapAssets(
  response: ImagePickerResponse,
  remaining: number,
): Promise<PickResult> {
  if (response.didCancel) {
    return { ok: false, reason: 'cancelled' };
  }
  if (response.errorCode === 'permission') {
    return {
      ok: false,
      reason: 'permission',
      canOpenSettings: true,
      message:
        'Photo access is disabled. Enable it in Settings, then return to add photos.',
    };
  }
  if (response.errorCode === 'camera_unavailable') {
    return {
      ok: false,
      reason: 'camera_unavailable',
      message: 'The camera is not available on this device.',
    };
  }
  if (response.errorCode || !response.assets?.length) {
    return {
      ok: false,
      reason: 'error',
      message:
        response.errorMessage ||
        'The photo could not be added. Please try again.',
    };
  }

  const slice = response.assets.slice(0, remaining);
  const images: FormImage[] = [];
  let skipped = 0;
  let skipReason:
    | 'unsupported_type'
    | 'missing_uri'
    | 'unreadable'
    | 'too_large'
    | 'compress_failed'
    | undefined;

  for (const asset of slice) {
    try {
      // Sync — no copy/compress so thumbs appear as soon as the picker closes.
      const result = acceptDraftImage(asset);
      if (result.ok) {
        images.push(result.image);
      } else {
        skipped += 1;
        skipReason = skipReason ?? result.reason;
      }
    } catch {
      skipped += 1;
      skipReason = skipReason ?? 'unreadable';
    }
  }

  return { ok: true, images, skipped, skipReason };
}

let pickerLocked = false;

/**
 * Opens the camera or gallery and returns draft images for the create form.
 * Compression to the upload size limit runs later during save preparation.
 *
 * @param source - Capture source (`camera` or `library`).
 * @param currentCount - Number of photos already attached to the form.
 * @returns Accepted drafts, skip metadata, or a structured failure result.
 */
export async function pickReportImages(
  source: PickSource,
  currentCount: number,
): Promise<PickResult> {
  if (pickerLocked) {
    return { ok: false, reason: 'cancelled' };
  }
  pickerLocked = true;

  try {
    const remaining = MAX_IMAGES - currentCount;
    if (remaining <= 0) {
      return {
        ok: false,
        reason: 'error',
        message: `You can attach at most ${MAX_IMAGES} photos.`,
      };
    }

    if (source === 'camera') {
      const cameraStatus = await requestMediaPermission('camera');
      if (cameraStatus !== 'granted') {
        return {
          ok: false,
          reason: 'permission',
          canOpenSettings: cameraStatus === 'blocked',
          message:
            cameraStatus === 'blocked'
              ? 'Camera access is disabled. Enable it in Settings, then return to continue.'
              : undefined,
        };
      }
    }

    const response =
      source === 'camera'
        ? await launchCamera({
            ...PICKER_OPTIONS,
            saveToPhotos: false,
            cameraType: 'back',
          })
        : await launchImageLibrary({
            ...PICKER_OPTIONS,
            selectionLimit: remaining,
          });

    return mapAssets(response, remaining);
  } finally {
    pickerLocked = false;
  }
}
