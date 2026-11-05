import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CloudOff, Upload } from 'lucide-react-native';

import {
  listUploadQueueAction,
  processQueueAction,
} from '../../actions/uploadActions';
import {
  AppHeader,
  AppScreen,
  EmptyState,
  ScreenIntro,
} from '../../components';
import type { MainTabScreenProps } from '../../navigator/types';
import {
  UploadAttachmentStatus,
  UploadReportStatus,
  type UploadReport,
} from '../../uploadQueue';
import { colors } from '../../theme';
import { ReportAccordion } from './components/ReportAccordion/ReportAccordion';

export function SyncScreen() {
  const navigation =
    useNavigation<MainTabScreenProps<'SyncScreen'>['navigation']>();
  const [reports, setReports] = useState<UploadReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listUploadQueueAction();
    if (result.ok) {
      setReports(result.reports);
      setError(null);
    } else {
      setError(result.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load().finally(() => setLoading(false));
      void processQueueAction();
      const timer = setInterval(() => {
        void load();
      }, 2000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo(() => {
    let active = 0;
    let done = 0;
    for (const report of reports) {
      if (report.status === UploadReportStatus.Delivered) {
        done += 1;
        continue;
      }
      const unfinished = report.attachments.some(
        (item) => item.status !== UploadAttachmentStatus.Uploaded,
      );
      if (unfinished) {
        active += 1;
      } else {
        done += 1;
      }
    }
    return { active, done, total: reports.length };
  }, [reports]);

  const description =
    stats.total === 0
      ? 'Saved reports remain on this device until every photo reaches the server.'
      : stats.active > 0
        ? `${stats.active} in progress · ${stats.done} completed`
        : `${stats.done} completed on this device`;

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />

      {loading && reports.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <ScreenIntro
              title="Uploads"
              description={description}
              style={styles.intro}
            />
          }
          ListEmptyComponent={
            error ? (
              <EmptyState
                Icon={CloudOff}
                title="Unable to load uploads"
                description={error}
              />
            ) : (
              <EmptyState
                Icon={Upload}
                title="No uploads yet"
                description="Saved reports appear here until every photo has been delivered to the server."
              />
            )
          }
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <ReportAccordion
              report={item}
              onChanged={() => void load()}
              onOpenLogs={() =>
                navigation.navigate('SyncLogsScreen', {
                  reportId: item.id,
                  title: item.description.trim() || 'Untitled report',
                })
              }
            />
          )}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: {
    marginBottom: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
    flexGrow: 1,
  },
  sep: {
    height: 14,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
