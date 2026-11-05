import { PermissionsAndroid, Platform } from 'react-native';

export type MediaPermissionKind = 'camera' | 'photos';

/** Outcome of a single OS permission request. */
export type MediaPermissionStatus = 'granted' | 'denied' | 'blocked';

/**
 * Returns the Android API level as a number.
 *
 * @returns Numeric Android API level, or `NaN` when the value cannot be parsed.
 */
function androidApiLevel(): number {
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10);
}

/**
 * Resolves the Android permission constant used for photo library access.
 *
 * @returns `READ_MEDIA_IMAGES` on API 33+, otherwise `READ_EXTERNAL_STORAGE`.
 */
export function getPhotosPermission() {
  return androidApiLevel() >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
}

/**
 * Indicates whether gallery selection requires a runtime storage permission.
 * Modern Android gallery picking uses the system photo picker and does not.
 *
 * @returns Always `false` for the current image-picker configuration.
 */
export function galleryNeedsRuntimePermission(): boolean {
  return false;
}

/**
 * Requests a single media permission through the operating system dialog.
 *
 * @param kind - Permission category to request (`camera` or `photos`).
 * @returns `granted`, `denied`, or `blocked` based on the system response.
 */
export async function requestMediaPermission(
  kind: MediaPermissionKind,
): Promise<MediaPermissionStatus> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  if (kind === 'photos' && !galleryNeedsRuntimePermission()) {
    return 'granted';
  }

  const permission =
    kind === 'camera'
      ? PermissionsAndroid.PERMISSIONS.CAMERA
      : getPhotosPermission();

  const alreadyGranted = await PermissionsAndroid.check(permission);
  if (alreadyGranted) {
    return 'granted';
  }

  const result = await PermissionsAndroid.request(permission);
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    return 'blocked';
  }
  return 'denied';
}
