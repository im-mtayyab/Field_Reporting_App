import { setConfig } from '@kesha-antonov/react-native-background-downloader';

import { ensureUploadNativeReady } from './ensureUploadNativeReady';

let configured = false;

export function configureBackgroundTransfers(): void {
  if (configured) {
    return;
  }
  configured = true;

  try {
    ensureUploadNativeReady();
    setConfig({
      isLogsEnabled: __DEV__,
      // Smaller ticks so 1–3 MB photos don't jump 8KB → done.
      progressMinBytes: 1024 * 4,
      allowsCellularAccess: true,
    });
  } catch {
    // createUploadTask surfaces link errors when used.
  }
}
