import { create } from 'zustand';

type Progress = {
  bytesUploaded: number;
  bytesTotal: number;
};

type UploadProgressState = {
  byAttachmentId: Record<string, Progress>;
  setProgress: (
    attachmentId: string,
    bytesUploaded: number,
    bytesTotal: number,
  ) => void;
  /** Trust server offset (may be lower than optimistic local bytes). */
  setTrustedProgress: (
    attachmentId: string,
    bytesUploaded: number,
    bytesTotal: number,
  ) => void;
  /** Keep last bytes visible until status catches up (avoids 8KB → 0% flicker). */
  markComplete: (attachmentId: string, sizeBytes: number) => void;
  clear: (attachmentId: string) => void;
};

/** In-memory only — never write per-tick progress into SQLite. */
export const useUploadProgress = create<UploadProgressState>((set) => ({
  byAttachmentId: {},
  setProgress: (attachmentId, bytesUploaded, bytesTotal) =>
    set((state) => {
      const prev = state.byAttachmentId[attachmentId];
      const total = Math.max(bytesTotal || 0, prev?.bytesTotal || 0, 1);
      // Monotonic — native can briefly report 0 after pause/resume.
      const uploaded = Math.max(
        0,
        Math.min(total, Math.max(bytesUploaded || 0, prev?.bytesUploaded || 0)),
      );
      return {
        byAttachmentId: {
          ...state.byAttachmentId,
          [attachmentId]: { bytesUploaded: uploaded, bytesTotal: total },
        },
      };
    }),
  setTrustedProgress: (attachmentId, bytesUploaded, bytesTotal) =>
    set((state) => {
      const total = Math.max(bytesTotal || 0, 1);
      const uploaded = Math.max(0, Math.min(total, bytesUploaded || 0));
      return {
        byAttachmentId: {
          ...state.byAttachmentId,
          [attachmentId]: { bytesUploaded: uploaded, bytesTotal: total },
        },
      };
    }),
  markComplete: (attachmentId, sizeBytes) =>
    set((state) => ({
      byAttachmentId: {
        ...state.byAttachmentId,
        [attachmentId]: {
          bytesUploaded: sizeBytes,
          bytesTotal: sizeBytes,
        },
      },
    })),
  clear: (attachmentId) =>
    set((state) => {
      const next = { ...state.byAttachmentId };
      delete next[attachmentId];
      return { byAttachmentId: next };
    }),
}));
