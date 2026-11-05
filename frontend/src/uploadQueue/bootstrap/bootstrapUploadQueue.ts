import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

import { ensureDbReady } from '../../db';
import { UploadAttachmentStatus } from '../../types/uploadQueue';
import { finishReportAfterLocalEnqueue } from '../enqueue/prepareReportAttachments';
import { configureBackgroundTransfers } from '../native/configureBackgroundTransfers';
import { uploadQueueRepository } from '../repository/uploadQueue.repository';
import { processQueue, recoverInterruptedJobs } from '../worker/processQueue';
import { reattachBackgroundUploads } from '../worker/reattachBackgroundUploads';

/** Once per JS process (survives navigation; resets only if the OS kills the app). */
let started = false;
let unsubscribeNetInfo: (() => void) | null = null;
let unsubscribeAppState: (() => void) | null = null;
let appState: AppStateStatus =
  (AppState.currentState as AppStateStatus | null | undefined) ?? 'active';

async function drainQueueIfOnline(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    await processQueue();
  }
}

function onAppStateChange(next: AppStateStatus): void {
  const wasBackground =
    appState === 'background' || appState === 'inactive';
  appState = next;
  if (wasBackground && next === 'active') {
    void (async () => {
      try {
        await reattachBackgroundUploads();
        await recoverInterruptedJobs();
        await resumeUnfinishedPrepares();
        await drainQueueIfOnline();
      } catch {
        // Sync screen / next online event will retry.
      }
    })();
  }
}

async function resumeUnfinishedPrepares(): Promise<void> {
  const reports = await uploadQueueRepository.listReports();
  for (const report of reports) {
    const needsPrepare = report.attachments.some(
      (item) =>
        !item.prepared &&
        item.status === UploadAttachmentStatus.Preparing,
    );
    if (needsPrepare) {
      await finishReportAfterLocalEnqueue(report.id);
    }
  }
}

/**
 * Background start hook — not a full rebuild every reopen:
 * - Schema migrate: once per install (version row in SQLite)
 * - This function: once per process
 * - Upload drain: only when online (or Sync screen)
 */
export function bootstrapUploadQueue(): void {
  if (started) {
    return;
  }
  started = true;
  configureBackgroundTransfers();

  void (async () => {
    try {
      await ensureDbReady();
      await reattachBackgroundUploads();
      await recoverInterruptedJobs();
      await resumeUnfinishedPrepares();
      await drainQueueIfOnline();
    } catch {
      // Save / Sync surfaces DB errors when the user needs them.
    }
  })();

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void processQueue();
    }
  });

  unsubscribeAppState = AppState.addEventListener(
    'change',
    onAppStateChange,
  ).remove;
}

export function stopUploadQueueNetInfo(): void {
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
  unsubscribeAppState?.();
  unsubscribeAppState = null;
  started = false;
}
