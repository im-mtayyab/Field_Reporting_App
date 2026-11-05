import type { SyncLog } from '../../../types/syncLog';
import { colors } from '../../../theme';

export type LogLevelTone = {
  accent: string;
  badgeBg: string;
  badgeText: string;
  label: string;
};

/**
 * Resolves visual tone tokens for a sync log severity level.
 *
 * @param level - Sync log level (`info`, `warn`, `error`, or `success`).
 * @returns Colors and a short badge label for the log row.
 */
export function logLevelTone(level: SyncLog['level']): LogLevelTone {
  switch (level) {
    case 'success':
      return {
        accent: colors.statusDeliveredText,
        badgeBg: colors.statusDeliveredBg,
        badgeText: colors.statusDeliveredText,
        label: 'Done',
      };
    case 'error':
      return {
        accent: colors.statusFailedText,
        badgeBg: colors.statusFailedBg,
        badgeText: colors.statusFailedText,
        label: 'Problem',
      };
    case 'warn':
      return {
        accent: colors.statusUploadingBg,
        badgeBg: colors.statusUploadingBg,
        badgeText: colors.statusUploadingText,
        label: 'Paused',
      };
    default:
      return {
        accent: colors.primary,
        badgeBg: colors.statusPendingBg,
        badgeText: colors.statusPendingText,
        label: 'Update',
      };
  }
}
