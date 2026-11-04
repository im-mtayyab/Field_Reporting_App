import { useCallback, useEffect, useRef, useState } from 'react';

import {
  listReportsAction,
  type ListReportsActionResult,
} from '../../../actions/reportActions';
import type { Report } from '../../../types/report';

const PAGE_SIZE = 10;

type ListError = Extract<ListReportsActionResult, { ok: false }>;

type ReportsListState =
  | { status: 'loading' }
  | { status: 'error'; error: ListError }
  | {
      status: 'ready';
      reports: Report[];
      total: number;
      hasMore: boolean;
    };

/** First page on mount; pull-to-refresh; scroll loads the next page. */
export function useReportsList() {
  const [state, setState] = useState<ReportsListState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadInitial = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setState({ status: 'loading' });
    }

    const result = await listReportsAction({ limit: PAGE_SIZE, offset: 0 });

    if (!result.ok) {
      setState({ status: 'error', error: result });
      setRefreshing(false);
      return;
    }

    setState({
      status: 'ready',
      reports: result.reports,
      total: result.total,
      hasMore: result.hasMore,
    });
    setRefreshing(false);
  }, []);

  const loadMore = useCallback(async () => {
    const current = stateRef.current;
    if (
      current.status !== 'ready' ||
      !current.hasMore ||
      loadingMoreRef.current
    ) {
      return;
    }

    loadingMoreRef.current = true;
    setLoadingMore(true);

    const offset = current.reports.length;
    const result = await listReportsAction({ limit: PAGE_SIZE, offset });

    if (!result.ok) {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      return;
    }

    setState((prev) => {
      if (prev.status !== 'ready') {
        return prev;
      }
      const seen = new Set(prev.reports.map((r) => r.id));
      const next = result.reports.filter((r) => !seen.has(r.id));
      return {
        status: 'ready',
        reports: [...prev.reports, ...next],
        total: result.total,
        hasMore: result.hasMore,
      };
    });

    loadingMoreRef.current = false;
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  return {
    state,
    refreshing,
    loadingMore,
    reload: () => {
      void loadInitial();
    },
    refresh: () => {
      void loadInitial(true);
    },
    loadMore,
  };
}
