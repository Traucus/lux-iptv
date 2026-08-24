import {
  openEnrichmentDB,
  TMDB_NEGATIVE_CACHE_STORE,
  type NegativeCacheRecord,
} from './schema';

const NEGATIVE_CACHE_TTL_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Gets a negative cache record by content ID.
 */
export async function get(contentId: string): Promise<NegativeCacheRecord | null> {
  const db = await openEnrichmentDB();
  const record = await db.get(TMDB_NEGATIVE_CACHE_STORE, contentId);
  db.close();
  return record ?? null;
}

/**
 * Sets a negative cache entry with a 30-day TTL.
 */
export async function set(contentId: string): Promise<void> {
  const db = await openEnrichmentDB();
  const expiresAt = Date.now() + NEGATIVE_CACHE_TTL_DAYS * MS_PER_DAY;
  await db.put(TMDB_NEGATIVE_CACHE_STORE, { contentId, expiresAt });
  db.close();
}

/**
 * Checks if a negative cache entry is expired.
 * Returns true if the entry doesn't exist or is expired.
 */
export async function isExpired(contentId: string): Promise<boolean> {
  const record = await get(contentId);
  if (!record) return true;
  return record.expiresAt <= Date.now();
}
