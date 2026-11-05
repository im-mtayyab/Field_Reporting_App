import type { UploadTask } from '@kesha-antonov/react-native-background-downloader';

export type UploadAbortReason = 'paused' | 'cancelled';

type AbortHandle = {
  abort: (reason: UploadAbortReason) => void;
};

/** Live background upload tasks keyed by job id. */
const tasks = new Map<string, UploadTask>();
/** Settle the in-flight PATCH Promise when native pause/stop emits no event. */
const aborts = new Map<string, AbortHandle>();
/** Latest job id per attachment (job ids include a timestamp). */
const jobByAttachment = new Map<string, string>();
/**
 * Attachments the user paused/cancelled — blocks a late native "done"
 * from marking the photo Uploaded after Pause.
 */
const userStopped = new Set<string>();

export const uploadTaskRegistry = {
  set(jobId: string, task: UploadTask, attachmentId?: string): void {
    tasks.set(jobId, task);
    if (attachmentId) {
      jobByAttachment.set(attachmentId, jobId);
      userStopped.delete(attachmentId);
    }
  },
  /** Bind job ↔ attachment without a native UploadTask (XHR / fetch PATCH). */
  bind(jobId: string, attachmentId: string): void {
    jobByAttachment.set(attachmentId, jobId);
    userStopped.delete(attachmentId);
  },
  get(jobId: string): UploadTask | undefined {
    return tasks.get(jobId);
  },
  getJobIdForAttachment(attachmentId: string): string | undefined {
    return jobByAttachment.get(attachmentId);
  },
  delete(jobId: string): void {
    tasks.delete(jobId);
    aborts.delete(jobId);
    for (const [attachmentId, id] of jobByAttachment) {
      if (id === jobId) {
        jobByAttachment.delete(attachmentId);
      }
    }
  },
  setAbort(jobId: string, handle: AbortHandle): void {
    aborts.set(jobId, handle);
  },
  markUserStopped(attachmentId: string): void {
    userStopped.add(attachmentId);
  },
  isUserStopped(attachmentId: string): boolean {
    return userStopped.has(attachmentId);
  },
  clearUserStopped(attachmentId: string): void {
    userStopped.delete(attachmentId);
  },
  abort(jobId: string, reason: UploadAbortReason): boolean {
    const handle = aborts.get(jobId);
    if (!handle) {
      return false;
    }
    handle.abort(reason);
    return true;
  },
  abortAttachment(attachmentId: string, reason: UploadAbortReason): boolean {
    this.markUserStopped(attachmentId);
    const jobId = jobByAttachment.get(attachmentId);
    if (!jobId) {
      return false;
    }
    return this.abort(jobId, reason);
  },
  jobIdForAttachment(attachmentId: string): string {
    return `upl_${attachmentId}`;
  },
};
