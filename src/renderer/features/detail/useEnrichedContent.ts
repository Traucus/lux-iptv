import { useMemo } from 'react';
import { useEnrichment } from '../../queries/use-enrichment-data';
import { mergeEnrichment, type MergeEnrichmentOptions } from '../../lib/enrichment-merge';
import type { CatalogItem, EnrichedCatalogItem } from '../../../shared/types/ipc';
import type { ContentEnrichmentRecord } from '../../db/schema';

export interface UseEnrichedContentOptions extends MergeEnrichmentOptions {
  /**
   * When true, treats the content as enriched even before the IndexedDB read
   * resolves. Useful to skip a "loading" flash in the UI for items whose
   * IndexedDB enrichment record is already cached. The check now relies on
   * the React Query cache rather than a catalog-side flag (the catalog
   * schema no longer carries enrichment state).
   */
  optimisticFromStatus?: boolean;
}

/**
 * useEnrichedContent — combines a CatalogItem (from the catalog API) with its
 * TMDB enrichment record (from IndexedDB) into an EnrichedCatalogItem. The
 * hook returns null while the enrichment record is still loading so the UI
 * can show a spinner or fall back to the raw item.
 *
 * The `optimisticFromStatus` option no longer reads enrichment state from
 * the catalog item (that field was removed from the catalog schema). When
 * enabled, the hook still avoids the loading flash by returning the merged
 * item immediately whenever the React Query cache already has the record.
 */
export function useEnrichedContent(
  item: CatalogItem | null | undefined,
  options: UseEnrichedContentOptions = {},
): {
  enriched: EnrichedCatalogItem | null;
  enrichment: ContentEnrichmentRecord | null;
  isEnrichmentLoading: boolean;
} {
  const itemId = item?.id ?? null;
  const { data, isPending, isFetched } = useEnrichment(itemId);

  const enriched = useMemo<EnrichedCatalogItem | null>(() => {
    if (!item) return null;
    const hasEnrichment = data != null;
    // Optimistic: when the query is enabled and we have already fetched a
    // record, render the merged item without waiting for the next tick.
    const isOptimistic = options.optimisticFromStatus && hasEnrichment && isFetched;
    if (!hasEnrichment && !isOptimistic && isPending) {
      return null;
    }
    return mergeEnrichment(item, data ?? null, options);
  }, [item, data, isPending, isFetched, options]);

  return {
    enriched,
    enrichment: data ?? null,
    isEnrichmentLoading: isPending,
  };
}
