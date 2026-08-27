import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getEnrichment, upsertEnrichment } from '../db/enrichment';
import type { ContentEnrichmentRecord } from '../db/schema';
import { toContentId } from '../lib/enrichment-merge';

/**
 * useEnrichment — reads a single enrichment record from IndexedDB.
 * Returns null (not undefined) when no record exists, so callers can safely
 * destructure the data field.
 */
export function useEnrichment(contentId: number | string | null | undefined): UseQueryResult<ContentEnrichmentRecord | null> {
  const id = contentId == null ? null : toContentId(contentId);
  return useQuery<ContentEnrichmentRecord | null>({
    queryKey: ['enrichment', 'record', id] as const,
    queryFn: async () => {
      if (id == null) return null;
      return getEnrichment(id);
    },
    enabled: id != null,
    staleTime: 60_000,
  });
}

/**
 * useEnrichmentBatch — reads many enrichment records in parallel for a list of
 * CatalogItem ids. Returns a query for each id; UI code can use the `data`
 * array (preserving the input order) to merge enrichment into catalog items.
 */
export function useEnrichmentBatch(
  contentIds: ReadonlyArray<number | string>,
): UseQueryResult<ContentEnrichmentRecord | null>[] {
  const ids = contentIds.map(toContentId);
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['enrichment', 'record', id] as const,
      queryFn: async (): Promise<ContentEnrichmentRecord | null> => getEnrichment(id),
      staleTime: 60_000,
    })),
  });
}

/**
 * useSaveEnrichment — provides a mutation to upsert an enrichment record.
 * The mutation also invalidates the matching `enrichment:record` query so the
 * dashboard and detail views re-read the new data.
 */
export function useSaveEnrichment(): {
  mutate: (record: ContentEnrichmentRecord) => Promise<void>;
} {
  return {
    async mutate(record: ContentEnrichmentRecord): Promise<void> {
      await upsertEnrichment(record);
    },
  };
}
