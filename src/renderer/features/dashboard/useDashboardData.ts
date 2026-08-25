import { useQueries } from '@tanstack/react-query';
import { createLuxAPI } from '../../lib/api';
import type { CatalogListOutput } from '../../../shared/types/ipc';

const api = createLuxAPI();

export interface DashboardData {
  continueWatching: CatalogListOutput;
  liveChannels: CatalogListOutput;
  recentMovies: CatalogListOutput;
  recentSeries: CatalogListOutput;
  loading: boolean;
  error: Error | null;
}

/**
 * useDashboardData — fetches all carousel data for the dashboard in parallel.
 */
export function useDashboardData(): DashboardData {
  const results = useQueries({
    queries: [
      {
        queryKey: ['catalog', 'movie', { limit: 25, search: 'continue' }] as const,
        queryFn: async (): Promise<CatalogListOutput> => {
          const res = await api.catalog.list({ type: 'movie', limit: 25, search: 'continue' });
          if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`);
          return res.data;
        },
      },
      {
        queryKey: ['catalog', 'live', { limit: 25 }] as const,
        queryFn: async (): Promise<CatalogListOutput> => {
          const res = await api.catalog.list({ type: 'live', limit: 25 });
          if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`);
          return res.data;
        },
      },
      {
        queryKey: ['catalog', 'movie', { limit: 25 }] as const,
        queryFn: async (): Promise<CatalogListOutput> => {
          const res = await api.catalog.list({ type: 'movie', limit: 25 });
          if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`);
          return res.data;
        },
      },
      {
        queryKey: ['catalog', 'series', { limit: 25 }] as const,
        queryFn: async (): Promise<CatalogListOutput> => {
          const res = await api.catalog.list({ type: 'series', limit: 25 });
          if (res.error) throw new Error(`${res.error.code}: ${res.error.message}`);
          return res.data;
        },
      },
    ],
  });

  const [continueWatching, liveChannels, recentMovies, recentSeries] = results;

  const loading = results.some((r) => r.isPending);
  const firstError = results.find((r) => r.isError)?.error ?? null;

  return {
    continueWatching: continueWatching.data ?? { items: [], total: 0 },
    liveChannels: liveChannels.data ?? { items: [], total: 0 },
    recentMovies: recentMovies.data ?? { items: [], total: 0 },
    recentSeries: recentSeries.data ?? { items: [], total: 0 },
    loading,
    error: firstError as Error | null,
  };
}
