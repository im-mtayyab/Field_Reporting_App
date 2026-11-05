import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ClipboardList, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clearSyncLogsAction,
  listUploadQueueAction,
  listSyncLogsAction,
} from '../../actions/uploadActions';
import {
  AppHeader,
  AppScreen,
  EmptyState,
  ScreenIntro,
  type SearchMultiSelectOption,
} from '../../components';
import type { AppStackParamList } from '../../navigator/types';
import type { SyncLog } from '../../types/syncLog';
import { colors } from '../../theme';
import { LogFilters } from './components/LogFilters/LogFilters';
import { LogRow } from './components/LogRow/LogRow';
import {
  buildImageFilterOptions,
  filterSyncLogs,
  formatAttachmentStatusLine,
  LOG_LEVEL_OPTIONS,
} from './utils/buildLogFilters';

type Props = NativeStackScreenProps<AppStackParamList, 'SyncLogsScreen'>;

export function SyncLogsScreen({ route }: Props) {
  const reportId = route.params?.reportId;
  const title = route.params?.title;
  const insets = useSafeAreaInsets();

  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [imageOptions, setImageOptions] = useState<SearchMultiSelectOption[]>(
    [],
  );
  const [fileNameByAttachmentId, setFileNameByAttachmentId] = useState<
    Record<string, string>
  >({});
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [levels, setLevels] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const selectedPills = useMemo(() => {
    const levelPills = LOG_LEVEL_OPTIONS.filter((option) =>
      levels.includes(option.value),
    ).map((option) => ({
      key: `level:${option.value}`,
      label: option.label,
      kind: 'level' as const,
      value: option.value,
    }));

    const imagePills = imageOptions
      .filter((option) => images.includes(option.value))
      .map((option) => ({
        key: `image:${option.value}`,
        label: option.label,
        kind: 'image' as const,
        value: option.value,
      }));

    return [...levelPills, ...imagePills];
  }, [levels, images, imageOptions]);

  const visible = useMemo(
    () => filterSyncLogs(logs, levels, images),
    [logs, levels, images],
  );

  const load = useCallback(async () => {
    const [logsResult, reportsResult] = await Promise.all([
      listSyncLogsAction(reportId),
      listUploadQueueAction(),
    ]);

    const nextLogs = logsResult.ok ? logsResult.logs : [];
    setLogs(nextLogs);

    if (!reportsResult.ok) {
      setImageOptions(buildImageFilterOptions([], nextLogs));
      setFileNameByAttachmentId({});
      setStatusLine(null);
      return;
    }

    const reports = reportId
      ? reportsResult.reports.filter((report) => report.id === reportId)
      : reportsResult.reports;

    const names: Record<string, string> = {};
    for (const report of reportsResult.reports) {
      for (const attachment of report.attachments) {
        names[attachment.id] = attachment.fileName;
      }
    }
    setFileNameByAttachmentId(names);
    setImageOptions(buildImageFilterOptions(reports, nextLogs));
    setStatusLine(
      reportId && reports[0]
        ? formatAttachmentStatusLine(reports[0])
        : null,
    );
  }, [reportId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onClear = () => {
    Alert.alert(reportId ? 'Clear these logs?' : 'Clear all logs?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await clearSyncLogsAction(reportId);
            await load();
          })();
        },
      },
    ]);
  };

  const onRemovePill = (kind: 'level' | 'image', value: string) => {
    if (kind === 'level') {
      setLevels((prev) => prev.filter((item) => item !== value));
      return;
    }
    setImages((prev) => prev.filter((item) => item !== value));
  };

  const hasFilters = levels.length > 0 || images.length > 0;

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader
        title={reportId ? 'Photo activity' : 'Upload activity'}
        showBack
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear logs"
            hitSlop={8}
            onPress={onClear}
            style={({ pressed }) => [
              styles.headerBtn,
              pressed && styles.pressed,
            ]}
          >
            <Trash2 size={20} color={colors.white} strokeWidth={2.25} />
          </Pressable>
        }
      />

      <LogFilters
        levels={levels}
        images={images}
        imageOptions={imageOptions}
        selectedPills={selectedPills}
        onLevelsChange={setLevels}
        onImagesChange={setImages}
        onRemovePill={onRemovePill}
      />

      {loading && logs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          initialNumToRender={20}
          windowSize={7}
          removeClippedSubviews
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 24 + insets.bottom },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <ScreenIntro
              title={
                title?.trim() ||
                (reportId ? 'Untitled report' : 'All saved reports')
              }
              description={
                statusLine || 'Transfer events saved on this device.'
              }
              style={styles.intro}
            />
          }
          ListEmptyComponent={
            <EmptyState
              Icon={ClipboardList}
              title={hasFilters ? 'No matching logs' : 'No logs'}
              description={
                hasFilters
                  ? 'Try clearing a filter.'
                  : 'Turn on “Save upload logs” in Settings if you need them.'
              }
            />
          }
          renderItem={({ item }) => (
            <LogRow
              log={item}
              fileNameByAttachmentId={fileNameByAttachmentId}
            />
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  intro: {
    marginBottom: 4,
  },
  list: {
    padding: 12,
    gap: 10,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
