import { getExistingUploadTasks } from '@kesha-antonov/react-native-background-downloader';

import { ensureUploadNativeReady } from '../native/ensureUploadNativeReady';
import { uploadTaskRegistry } from '../native/uploadTaskRegistry';
import { logSync } from '../repository/syncLog.repository';

export async function reattachBackgroundUploads(): Promise<void> {
  ensureUploadNativeReady();
  try {
    const tasks = await getExistingUploadTasks();
    for (const task of tasks) {
      uploadTaskRegistry.set(task.id, task);
      task
        .progress(() => undefined)
        .done(({ responseCode }) => {
          uploadTaskRegistry.delete(task.id);
          void logSync({
            event: 'reattach_done',
            message: `Background task finished (${responseCode})`,
            level:
              responseCode >= 200 && responseCode < 300 ? 'success' : 'warn',
          });
          // Native finished while JS may have been suspended — drain next files.
          void import('./processQueue').then(({ processQueue }) =>
            processQueue(),
          );
        })
        .error(({ error }) => {
          uploadTaskRegistry.delete(task.id);
          void logSync({
            event: 'reattach_error',
            message: error || 'Background task failed',
            level: 'error',
          });
          void import('./processQueue').then(({ processQueue }) =>
            processQueue(),
          );
        });
    }
  } catch {
    // Native module may be unavailable in tests.
  }
}
