import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image as ImageIcon } from 'lucide-react-native';

import {
  getReportAction,
  type GetReportActionResult,
} from '../../actions/reportActions';
import {
  AppHeader,
  AppScreen,
  AppText,
  Button,
  StatusPill,
  TextVariant,
} from '../../components';
import type { AppStackParamList } from '../../navigator/types';
import {
  attachmentStatusTone,
  colors,
  reportStatusTone,
} from '../../theme';
import type { Report } from '../../types/report';
import { formatReportDate } from '../ReportsScreen/utils/formatReportDate';

type Props = NativeStackScreenProps<AppStackParamList, 'ReportDetailScreen'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: Extract<GetReportActionResult, { ok: false }> }
  | { status: 'ready'; report: Report };

const GAP = 12;
const H_PAD = 16;

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** M3-style list row: label leading, value trailing. */
function DetailListItem({
  label,
  value,
  trailing,
  last = false,
}: {
  label: string;
  value?: string;
  trailing?: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.listItem, !last && styles.listItemBorder]}>
      <AppText variant={TextVariant.Body} color="text" style={styles.listLabel}>
        {label}
      </AppText>
      {trailing ? (
        trailing
      ) : (
        <AppText
          variant={TextVariant.Body}
          color="textSoft"
          style={styles.listValue}
          numberOfLines={2}
        >
          {value}
        </AppText>
      )}
    </View>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <AppText variant={TextVariant.Label} color="text">
      {children}
    </AppText>
  );
}

export function ReportDetailScreen({ route }: Props) {
  const { reportId } = route.params;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const cell = (width - H_PAD * 2 - GAP) / 2;

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    const result = await getReportAction(reportId);
    if (!result.ok) {
      setState({ status: 'error', error: result });
      return;
    }
    setState({ status: 'ready', report: result.report });
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <AppScreen padded={false} style={styles.flex}>
        <AppHeader title="Report" showBack />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </AppScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <AppScreen padded={false} style={styles.flex}>
        <AppHeader title="Report" showBack />
        <View style={styles.centered}>
          <AppText variant={TextVariant.Headline} color="text">
            Unable to load report
          </AppText>
          <AppText
            variant={TextVariant.Body}
            color="textSoft"
            style={styles.errorBody}
          >
            {state.error.message}
          </AppText>
          {state.error.retryable ? (
            <Button style={styles.retry} onPress={() => void load()}>
              Retry
            </Button>
          ) : null}
        </View>
      </AppScreen>
    );
  }

  const { report } = state;
  const description = report.description.trim() || 'Untitled report';
  const photos = report.attachments;
  const photoSummary =
    photos.length === 0
      ? 'No photos'
      : photos.length === 1
        ? '1 photo'
        : `${photos.length} photos`;
  const when = formatReportDate(report.updatedAt || report.createdAt);

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader title="Report" showBack />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 24 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Headline + supporting text (M3 content hierarchy) */}
        <View style={styles.headlineBlock}>
          <AppText variant={TextVariant.Headline} color="text">
            {description}
          </AppText>
          <AppText variant={TextVariant.Body} color="textSoft">
            {photoSummary}
            {'  ·  '}
            {when}
          </AppText>
        </View>

        {/* Details list — status lives here as trailing chip */}
        <View style={styles.section}>
          <SectionHeader>Details</SectionHeader>
          <View style={styles.listGroup}>
            <DetailListItem
              label="Status"
              trailing={
                <StatusPill tone={reportStatusTone(report.status)} />
              }
            />
            <DetailListItem label="Report ID" value={report.id} />
            <DetailListItem
              label="Created"
              value={formatReportDate(report.createdAt)}
            />
            <DetailListItem
              label="Updated"
              value={formatReportDate(report.updatedAt)}
              last
            />
          </View>
        </View>

        {/* Media section */}
        <View style={styles.section}>
          <SectionHeader>Photos</SectionHeader>

          {photos.length === 0 ? (
            <View style={styles.emptyPhotos}>
              <ImageIcon size={28} color={colors.mutedSoft} strokeWidth={1.75} />
              <AppText variant={TextVariant.Body} color="textSoft">
                No images on this report
              </AppText>
            </View>
          ) : (
            <View style={styles.grid}>
              {photos.map((item) => (
                <View key={item.id} style={[styles.photoCard, { width: cell }]}>
                  <View style={[styles.thumb, { height: cell }]}>
                    {item.downloadUrl ? (
                      <FastImage
                        style={styles.image}
                        objectFit="cover"
                        source={{
                          uri: item.downloadUrl,
                          priority: FastImage.priority.normal,
                          cache: FastImage.cacheControl.immutable,
                          cacheKey: item.objectPath || item.id,
                        }}
                      />
                    ) : (
                      <View style={[styles.image, styles.imageFallback]}>
                        <ImageIcon
                          size={28}
                          color={colors.primary}
                          strokeWidth={1.75}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.photoMeta}>
                    <AppText
                      variant={TextVariant.Label}
                      color="text"
                      numberOfLines={1}
                    >
                      {item.fileName}
                    </AppText>
                    <View style={styles.photoMetaRow}>
                      <AppText variant={TextVariant.Caption} color="textSoft">
                        {formatBytes(item.sizeBytes)}
                      </AppText>
                      <StatusPill
                        tone={attachmentStatusTone(item.status)}
                        style={styles.photoChip}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scroll: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    gap: 28,
  },
  headlineBlock: {
    gap: 8,
  },
  section: {
    gap: 12,
  },
  listGroup: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  listItem: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  listItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listLabel: {
    flexShrink: 0,
  },
  listValue: {
    flex: 1,
    textAlign: 'right',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  photoCard: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    backgroundColor: colors.surfaceAlt,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMeta: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  photoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  photoChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  emptyPhotos: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  errorBody: {
    marginTop: 8,
    textAlign: 'center',
  },
  retry: {
    marginTop: 20,
  },
});
