import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { createLuxAPI } from '../../lib/api';
import { useEnrichmentBatch } from '../../queries/use-enrichment-data';
import { enrichItems } from '../../lib/enrichment-merge';
import type { ContentEnrichmentRecord } from '../../db/schema';
import type { CatalogItem, CatalogListOutput, EnrichedCatalogItem } from '../../../shared/types/ipc';

const api = createLuxAPI();

export interface DashboardData {
  continueWatching: EnrichedCatalogItem[];
  liveChannels: EnrichedCatalogItem[];
  recentMovies: EnrichedCatalogItem[];
  recentSeries: EnrichedCatalogItem[];
  loading: boolean;
  error: Error | null;
}

/**
 * useDashboardData — fetches all carousel data for the dashboard in parallel
 * and merges IndexedDB enrichment records so the UI can render rich metadata
 * (overview, poster, backdrop, genres, rating) when available.
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

  // Collect every item id across all four queries so we can batch-load the
  // matching enrichment records from IndexedDB in a single round-trip.
  // We depend on the individual data references (which are referentially
  // stable) instead of the `results` array, because `useQueries` returns a
  // fresh array on every render even when the data is unchanged.
  const allItemIds = useMemo<string[]>(() => {
    const ids: string[] = [];
    for (const result of results) {
      const items = result.data?.items ?? [];
      for (const item of items) {
        ids.push(String(item.id));
      }
    }
    return ids;
  }, [
    continueWatching.data,
    liveChannels.data,
    recentMovies.data,
    recentSeries.data,
  ]);

  const enrichmentResults = useEnrichmentBatch(allItemIds);

  // Build a Map<id, record> so each carousel can look up its items in O(1).
  const enrichmentMap = useMemo(() => {
    const map = new Map<string, ContentEnrichmentRecord>();
    enrichmentResults.forEach((res, idx) => {
      const id = allItemIds[idx];
      if (id != null && res.data) {
        map.set(id, res.data);
      }
    });
    return map;
  }, [enrichmentResults, allItemIds]);

  // Convert raw catalog items into EnrichedCatalogItem views by merging the
  // matching enrichment record (when one exists) per item.
  const enriched = useMemo(() => {
    const records = Array.from(enrichmentMap.values());
    const merge = (item: CatalogItem): EnrichedCatalogItem => {
      // enrichItems always returns an item for each input, so [0] is safe
      // when the input array is non-empty. We use a defensive fallback to
      // stay robust if the merge ever fails to return a value.
      const merged = enrichItems([item], records);
      return (
        merged[0] ?? {
          ...item,
          overview: null,
          posterUrl: null,
          backdropUrl: null,
          voteAverage: null,
          runtime: null,
          genres: item.groupTitle ? [item.groupTitle] : [],
        }
      );
    };
    return {
      continueWatching: (continueWatching.data?.items ?? []).map(merge),
      liveChannels: (liveChannels.data?.items ?? []).map(merge),
      recentMovies: (recentMovies.data?.items ?? []).map(merge),
      recentSeries: (recentSeries.data?.items ?? []).map(merge),
    };
  }, [
    continueWatching.data,
    liveChannels.data,
    recentMovies.data,
    recentSeries.data,
    enrichmentMap,
  ]);

  // Treat the dashboard as loading while either the catalog queries or the
  // enrichment reads are still pending. We don't want the UI to flash a
  // raw-M3U hero before the first enrichment fetch resolves.
  const catalogLoading = results.some((r) => r.isPending);
  const enrichmentLoading = enrichmentResults.some((r) => r.isPending && r.fetchStatus !== 'idle');
  const loading = catalogLoading || enrichmentLoading;

  const firstError = results.find((r) => r.isError)?.error ?? null;

  return {
    continueWatching: enriched.continueWatching,
    liveChannels: enriched.liveChannels,
    recentMovies: enriched.recentMovies,
    recentSeries: enriched.recentSeries,
    loading,
    error: firstError as Error | null,
  };
}
