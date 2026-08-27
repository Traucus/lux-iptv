import { useMemo } from 'react';
import { useEnrichment } from '../../queries/use-enrichment-data';
import { mergeEnrichment, type MergeEnrichmentOptions } from '../../lib/enrichment-merge';
import type { CatalogItem, EnrichedCatalogItem } from '../../../shared/types/ipc';
import type { ContentEnrichmentRecord } from '../../db/schema';

export interface UseEnrichedContentOptions extends MergeEnrichmentOptions {
  /**
   * When true, treats the content as enriched even before the IndexedDB read
   * resolves. Useful to skip a "loading" flash in the UI for items whose
   * `enrichmentStatus` is already 'enriched' from the catalog query.
   */
  optimisticFromStatus?: boolean;
}

/**
 * useEnrichedContent — combines a CatalogItem (from the catalog API) with its
 * TMDB enrichment record (from IndexedDB) into an EnrichedCatalogItem. The
 * hook returns null while the enrichment record is still loading so the UI
 * can show a spinner or fall back to the raw item.
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
  const { data, isPending } = useEnrichment(itemId);

  const enriched = useMemo<EnrichedCatalogItem | null>(() => {
    if (!item) return null;
    // If we have the enrichment record (or none exists), we can produce a
    // full view. We never want to block rendering on the IndexedDB read for
    // items the catalog already marks as not-enriched.
    const hasEnrichment = data != null;
    const isOptimistic = options.optimisticFromStatus && item.enrichmentStatus === 'enriched';
    if (!hasEnrichment && !isOptimistic && isPending) {
      return null;
    }
    return mergeEnrichment(item, data ?? null, options);
  }, [item, data, isPending, options]);

  return {
    enriched,
    enrichment: data ?? null,
    isEnrichmentLoading: isPending,
  };
}
