import { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { useNavigation } from '@react-navigation/native';
import { ClipboardList } from 'lucide-react-native';

import {
  AppHeader,
  AppScreen,
  AppText,
  Button,
  EmptyState,
  ScreenIntro,
  TextVariant,
} from '../../components';
import type { ReportsScreenNavigationProp } from '../../navigator/types';
import { colors } from '../../theme';
import type { Report } from '../../types/report';
import { ReportCard } from './components/ReportCard/ReportCard';
import { useReportsList } from './hooks/useReportsList';

const ESTIMATED_ROW = 120;

function ReportsError({
  message,
  retryable,
  onRetry,
}: {
  message: string;
  retryable: boolean;
  onRetry: () => void;
}) {
  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />
      <View style={styles.body}>
        <ScreenIntro title="Reports" description="Unable to load reports" />
        <View style={styles.centered}>
          <AppText
            variant={TextVariant.Body}
            color="textSoft"
            style={styles.errorBody}
          >
            {message}
          </AppText>
          {retryable ? (
            <Button style={styles.retryButton} onPress={onRetry}>
              Try again
            </Button>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}

function ReportsEmpty() {
  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />
      <View style={styles.body}>
        <ScreenIntro title="Reports" description="Showing 0 of 0" />
        <EmptyState
          Icon={ClipboardList}
          title="No reports yet"
          description="Reports from the server show up here once they exist."
        />
      </View>
    </AppScreen>
  );
}

function ReportsList({
  reports,
  total,
  hasMore,
  refreshing,
  loadingMore,
  onRefresh,
  onEndReached,
  onOpenReport,
}: {
  reports: Report[];
  total: number;
  hasMore: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  onRefresh: () => void;
  onEndReached: () => void;
  onOpenReport: (report: Report) => void;
}) {
  const renderItem = useCallback(
    ({ item }: { item: Report }) => (
      <View style={styles.item}>
        <ReportCard report={item} onPress={onOpenReport} />
      </View>
    ),
    [onOpenReport],
  );

  const handleEndReached = useCallback(() => {
    if (loadingMore || !hasMore) {
      return;
    }
    onEndReached();
  }, [hasMore, loadingMore, onEndReached]);

  return (
    <AppScreen padded={false} style={styles.flex}>
      <AppHeader />

      <View style={styles.listPanel}>
        <LegendList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          recycleItems
          estimatedItemSize={ESTIMATED_ROW}
          drawDistance={400}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ScreenIntro
              title="Reports"
              description={`Showing ${reports.length} of ${total}`}
              style={styles.intro}
            />
          }
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </View>
    </AppScreen>
  );
}

export function ReportsScreen() {
  const navigation = useNavigation<ReportsScreenNavigationProp>();
  const { state, refreshing, loadingMore, reload, refresh, loadMore } =
    useReportsList();

  const openReport = useCallback(
    (report: Report) => {
      navigation.navigate('ReportDetailScreen', { reportId: report.id });
    },
    [navigation],
  );

  if (state.status === 'loading') {
    return (
      <AppScreen padded={false} style={styles.flex}>
        <AppHeader />
        <View style={styles.body}>
          <ScreenIntro title="Reports" description="Loading reports…" />
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        </View>
      </AppScreen>
    );
  }

  if (state.status === 'error') {
    return (
      <ReportsError
        message={state.error.message}
        retryable={state.error.retryable}
        onRetry={reload}
      />
    );
  }

  if (state.reports.length === 0) {
    return <ReportsEmpty />;
  }

  return (
    <ReportsList
      reports={state.reports}
      total={state.total}
      hasMore={state.hasMore}
      refreshing={refreshing}
      loadingMore={loadingMore}
      onRefresh={refresh}
      onEndReached={loadMore}
      onOpenReport={openReport}
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: colors.surface,
  },
  intro: {
    marginBottom: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  listPanel: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  item: {
    paddingBottom: 12,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerSpacer: {
    height: 8,
  },
  errorBody: {
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
  },
});
