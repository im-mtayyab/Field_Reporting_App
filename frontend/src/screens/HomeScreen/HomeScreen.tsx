import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image as ImageIcon } from 'lucide-react-native';

import { listUploadQueueAction } from '../../actions/uploadActions';
import { listReportsAction } from '../../actions/reportActions';
import {
  AppHeader,
  AppScreen,
  AppText,
  ScreenIntro,
  TextVariant,
} from '../../components';
import { Card } from '../../components/Card/Card';
import { StatusPill } from '../../components/StatusPill/StatusPill';
import type { MainTabScreenProps } from '../../navigator/types';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadReport,
} from '../../uploadQueue';
import { useReportsCache } from '../../store/reportsCache';
import { colors, uploadReportStatusTone } from '../../theme';
import type { Report } from '../../types/report';
import { formatReportUploadSummary } from '../SyncScreen/utils/formatReportUploadSummary';

const RECENT_LIMIT = 6;
const THUMB = 64;

function summarizeUploadQueue(reports: UploadReport[]) {
  let pending = 0;
  let completed = 0;

  for (const report of reports) {
    if (report.status === UploadReportStatus.Delivered) {
      completed += 1;
      continue;
    }
    const allUploaded = report.attachments.every(
      (item) => item.status === UploadAttachmentStatus.Uploaded,
    );
    if (allUploaded && report.attachments.length > 0) {
      completed += 1;
    } else {
      pending += 1;
    }
  }

  return { pending, completed };
}

function sortUploadRecent(reports: UploadReport[]): UploadReport[] {
  return [...reports].sort((a, b) => {
    const left = Date.parse(a.updatedAt || a.createdAt);
    const right = Date.parse(b.updatedAt || b.createdAt);
    return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
  });
}

function formatRelativeTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return '';
  }
  const diff = Math.max(0, Date.now() - ms);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {
    return 'Just now';
  }
  if (mins < 60) {
    return `${mins}m ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type RecentItem =
  | { kind: 'local'; report: UploadReport }
  | { kind: 'server'; report: Report };

export function HomeScreen() {
  const navigation =
    useNavigation<MainTabScreenProps<'HomeScreen'>['navigation']>();
  const [queueReports, setQueueReports] = useState<UploadReport[]>([]);
  const serverReports = useReportsCache((s) => s.reports);
  const loadedOnce = useReportsCache((s) => s.loadedOnce);

  const loadQueue = useCallback(async () => {
    const result = await listUploadQueueAction();
    if (result.ok) {
      setQueueReports(result.reports);
    }
  }, []);

  const ensureServerReports = useCallback(async () => {
    if (useReportsCache.getState().loadedOnce) {
      return;
    }
    const result = await listReportsAction({ limit: 10, offset: 0 });
    if (result.ok) {
      useReportsCache.getState().setPage({
        reports: result.reports,
        total: result.total,
        hasMore: result.hasMore,
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue]),
  );

  useEffect(() => {
    void ensureServerReports();
  }, [ensureServerReports]);

  const stats = useMemo(
    () => summarizeUploadQueue(queueReports),
    [queueReports],
  );

  const recent = useMemo((): RecentItem[] => {
    // Prefer local queue entries, then append server reports from the shared cache.
    const local = sortUploadRecent(queueReports).map((report) => ({
      kind: 'local' as const,
      report,
    }));

    const seen = new Set(local.map((item) => item.report.id));
    const server = serverReports
      .filter((report) => !seen.has(report.id))
      .map((report) => ({ kind: 'server' as const, report }));

    return [...local, ...server].slice(0, RECENT_LIMIT);
  }, [queueReports, serverReports]);

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <ScreenIntro
          title="Home"
          description="Compose a report on this device, then upload photos when a network connection is available."
        />
        <View style={styles.statRow}>
          <StatCard
            label="Pending"
            value={stats.pending}
            detail="Awaiting upload completion"
            backgroundColor={colors.primary}
            labelColor="white"
            valueColor="white"
            detailColor="white"
            onPress={() => navigation.navigate('SyncScreen')}
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            detail="Delivered to the server"
            backgroundColor={colors.accent}
            labelColor="text"
            valueColor="text"
            detailColor="text"
            onPress={() => navigation.navigate('ReportsScreen')}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant={TextVariant.Label} color="text">
              Recent reports
            </AppText>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => navigation.navigate('ReportsScreen')}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <AppText variant={TextVariant.Caption} color="primary">
                See all
              </AppText>
            </Pressable>
          </View>

          {recent.length === 0 ? (
            <Card contentStyle={styles.emptyCard}>
              <AppText variant={TextVariant.Body} color="textSoft">
                {loadedOnce
                  ? 'No reports yet. Create a report to see it listed here.'
                  : 'Loading reports…'}
              </AppText>
            </Card>
          ) : (
            <View style={styles.recentList}>
              {recent.map((item, index) =>
                item.kind === 'local' ? (
                  <LocalRecentCard
                    key={`local-${item.report.id}`}
                    report={item.report}
                    last={index === recent.length - 1}
                    onPress={() => navigation.navigate('SyncScreen')}
                  />
                ) : (
                  <ServerRecentCard
                    key={`server-${item.report.id}`}
                    report={item.report}
                    last={index === recent.length - 1}
                    onPress={() =>
                      navigation.navigate('ReportDetailScreen', {
                        reportId: item.report.id,
                      })
                    }
                  />
                ),
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function StatCard({
  label,
  value,
  detail,
  backgroundColor,
  labelColor,
  valueColor,
  detailColor,
  onPress,
}: {
  label: string;
  value: number;
  detail: string;
  backgroundColor: string;
  labelColor: 'white' | 'text' | 'textSoft';
  valueColor: 'white' | 'text' | 'textSoft';
  detailColor: 'white' | 'text' | 'textSoft';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.statCard,
        { backgroundColor },
        pressed ? styles.pressed : null,
      ]}
    >
      <AppText variant={TextVariant.Caption} color={labelColor}>
        {label}
      </AppText>
      <AppText variant={TextVariant.Display} color={valueColor}>
        {value}
      </AppText>
      <AppText variant={TextVariant.Caption} color={detailColor}>
        {detail}
      </AppText>
    </Pressable>
  );
}

function LocalRecentCard({
  report,
  last,
  onPress,
}: {
  report: UploadReport;
  last?: boolean;
  onPress: () => void;
}) {
  const summary = formatReportUploadSummary(report);
  const tone = uploadReportStatusTone(report.status);
  const when = formatRelativeTime(report.updatedAt || report.createdAt);
  const title = report.description.trim() || 'Untitled report';
  const cover = [...report.attachments].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )[0];
  const photoCount = report.attachments.length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentCard,
        last ? styles.recentCardLast : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.thumbWrap}>
        {cover?.localUri ? (
          <Image
            source={{ uri: cover.localUri }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <ImageIcon size={22} color={colors.mutedSoft} strokeWidth={1.75} />
          </View>
        )}
      </View>
      <View style={styles.recentCopy}>
        <AppText variant={TextVariant.Body} color="text" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant={TextVariant.Caption} color="textSoft" numberOfLines={1}>
          {summary.line}
          {when ? ` · ${when}` : ''}
          {photoCount > 1 ? ` · ${photoCount} photos` : ''}
        </AppText>
        <StatusPill tone={tone} style={styles.statusPill} />
      </View>
    </Pressable>
  );
}

function ServerRecentCard({
  report,
  last,
  onPress,
}: {
  report: Report;
  last?: boolean;
  onPress: () => void;
}) {
  const when = formatRelativeTime(report.updatedAt || report.createdAt);
  const title = report.description.trim() || 'Untitled report';
  const cover = report.attachments.find((item) => Boolean(item.downloadUrl));
  const photoCount = report.attachments.length;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.recentCard,
        last ? styles.recentCardLast : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.thumbWrap}>
        {cover?.downloadUrl ? (
          <Image
            source={{ uri: cover.downloadUrl }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <ImageIcon size={22} color={colors.mutedSoft} strokeWidth={1.75} />
          </View>
        )}
      </View>
      <View style={styles.recentCopy}>
        <AppText variant={TextVariant.Body} color="text" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant={TextVariant.Caption} color="textSoft" numberOfLines={1}>
          {photoCount === 0
            ? 'No photos'
            : photoCount === 1
              ? '1 photo'
              : `${photoCount} photos`}
          {when ? ` · ${when}` : ''}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 22,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'space-between',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyCard: {
    paddingVertical: 22,
  },
  recentList: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recentCardLast: {
    borderBottomWidth: 0,
  },
  thumbWrap: {
    width: THUMB,
    height: THUMB,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    backgroundColor: colors.surfaceAlt,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  statusPill: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.75,
  },
});
