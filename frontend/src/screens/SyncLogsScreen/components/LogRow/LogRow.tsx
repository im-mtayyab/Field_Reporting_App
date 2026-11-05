import { StyleSheet, View } from 'react-native';

import { AppText, TextVariant } from '../../../../components';
import type { SyncLog } from '../../../../types/syncLog';
import { colors } from '../../../../theme';
import { formatLogTime } from '../../utils/formatLogTime';
import { formatSyncLogForUser } from '../../utils/formatSyncLogForUser';
import { logLevelTone } from '../../utils/logLevelTone';

type LogRowProps = {
  log: SyncLog;
  fileNameByAttachmentId: Record<string, string>;
};

export function LogRow({ log, fileNameByAttachmentId }: LogRowProps) {
  const tone = logLevelTone(log.level);
  const { title, detail } = formatSyncLogForUser(log, fileNameByAttachmentId);

  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: tone.accent }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={[styles.badge, { backgroundColor: tone.badgeBg }]}>
            <AppText
              variant={TextVariant.Overline}
              style={{ color: tone.badgeText, textTransform: 'uppercase' }}
            >
              {tone.label}
            </AppText>
          </View>
          <AppText variant={TextVariant.Caption} color="mutedSoft">
            {formatLogTime(log.createdAt)}
          </AppText>
        </View>
        <AppText variant={TextVariant.Label} color="text">
          {title}
        </AppText>
        <AppText variant={TextVariant.Body} color="textSoft">
          {detail}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    minHeight: 88,
  },
  accent: {
    width: 5,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 4,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
