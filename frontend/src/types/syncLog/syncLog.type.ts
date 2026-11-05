export type SyncLogLevel = 'info' | 'success' | 'warn' | 'error';

export type SyncLog = {
  id: string;
  reportId: string | null;
  attachmentId: string | null;
  level: SyncLogLevel;
  event: string;
  message: string;
  metaJson: string | null;
  createdAt: string;
};

export type AppendSyncLogInput = {
  reportId?: string | null;
  attachmentId?: string | null;
  level?: SyncLogLevel;
  event: string;
  message: string;
  meta?: Record<string, unknown>;
};
