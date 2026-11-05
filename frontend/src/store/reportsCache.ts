import { create } from 'zustand';

import type { Report } from '../types/report';

type ReportsCacheState = {
  reports: Report[];
  total: number;
  hasMore: boolean;
  loadedOnce: boolean;
  setPage: (input: {
    reports: Report[];
    total: number;
    hasMore: boolean;
    append?: boolean;
  }) => void;
  clear: () => void;
};

/** Shared server reports list — Home + Reports read the same first fetch. */
export const useReportsCache = create<ReportsCacheState>((set, get) => ({
  reports: [],
  total: 0,
  hasMore: false,
  loadedOnce: false,
  setPage: ({ reports, total, hasMore, append }) => {
    if (append) {
      const seen = new Set(get().reports.map((item) => item.id));
      const next = reports.filter((item) => !seen.has(item.id));
      set({
        reports: [...get().reports, ...next],
        total,
        hasMore,
        loadedOnce: true,
      });
      return;
    }
    set({ reports, total, hasMore, loadedOnce: true });
  },
  clear: () =>
    set({ reports: [], total: 0, hasMore: false, loadedOnce: false }),
}));
