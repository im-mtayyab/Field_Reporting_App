import { NativeModules, TurboModuleRegistry } from 'react-native';

export function ensureUploadNativeReady(): void {
  const linked =
    NativeModules.RNBackgroundDownloader ??
    TurboModuleRegistry.get('RNBackgroundDownloader');

  if (!linked) {
    throw new Error(
      'Uploader native module not linked. Rebuild the app (npm run android).',
    );
  }
}
