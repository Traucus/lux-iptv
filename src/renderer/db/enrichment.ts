import {
  openEnrichmentDB,
  CONTENT_ENRICHMENT_STORE,
  TMDB_NEGATIVE_CACHE_STORE,
  type ContentEnrichmentRecord,
} from './schema';

/**
 * Gets an enrichment record by content ID.
 */
export async function getEnrichment(contentId: string): Promise<ContentEnrichmentRecord | null> {
  const db = await openEnrichmentDB();
  const record = await db.get(CONTENT_ENRICHMENT_STORE, contentId);
  db.close();
  return record ?? null;
}

/**
 * Upserts an enrichment record by content ID.
 */
export async function upsertEnrichment(record: ContentEnrichmentRecord): Promise<void> {
  const db = await openEnrichmentDB();
  await db.put(CONTENT_ENRICHMENT_STORE, record);
  db.close();
}

/**
 * Gets all pending enrichments that are not in the negative cache.
 * Returns items with status 'pending' or 'error' that haven't been negative-cached.
 */
export async function getPendingEnrichments(): Promise<ContentEnrichmentRecord[]> {
  const db = await openEnrichmentDB();
  const now = Date.now();

  // Get all pending/error items
  const allRecords = await db.getAllFromIndex(CONTENT_ENRICHMENT_STORE, 'by_status');
  const pendingRecords = allRecords.filter(
    (r) => r.enrichmentStatus === 'pending' || r.enrichmentStatus === 'error',
  );

  // Filter out negative-cached items
  const result: ContentEnrichmentRecord[] = [];
  for (const record of pendingRecords) {
    const negCache = await db.get(TMDB_NEGATIVE_CACHE_STORE, record.contentId);
    if (!negCache || negCache.expiresAt <= now) {
      result.push(record);
    }
  }

  db.close();
  return result;
}
