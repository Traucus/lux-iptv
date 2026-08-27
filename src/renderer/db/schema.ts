import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'lux-iptv-enrichment';
const DB_VERSION = 1;

export const CONTENT_ENRICHMENT_STORE = 'content_enrichment';
export const TMDB_NEGATIVE_CACHE_STORE = 'tmdb_negative_cache';

export interface ContentEnrichmentRecord {
  contentId: string;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  title: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  releaseYear: number | null;
  matchConfidence: number | null;
  enrichmentStatus: 'pending' | 'queued' | 'fetching' | 'succeeded' | 'failed' | 'not_found';
  attempts: number;
  lastAttemptAt: number | null;
  /**
   * TMDB genre IDs. Optional so older records (or records that never
   * captured this) remain readable. The renderer resolves IDs to display
   * names via a built-in map.
   */
  genreIds?: number[];
  /**
   * Runtime in minutes (movie length or typical episode length for series).
   * Optional; the renderer formats this as "Xh Ym" or omits the field when
   * missing per REQ-DEGRADED-3.
   */
  runtime?: number;
}

export interface NegativeCacheRecord {
  contentId: string;
  expiresAt: number;
}

export type LuxEnrichmentDB = IDBPDatabase<typeof DB_NAME>;

/**
 * Opens the IndexedDB database and handles version upgrades.
 */
export async function openEnrichmentDB(): Promise<LuxEnrichmentDB> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      // Create content_enrichment store
      if (!db.objectStoreNames.contains(CONTENT_ENRICHMENT_STORE)) {
        const enrichmentStore = db.createObjectStore(CONTENT_ENRICHMENT_STORE, {
          keyPath: 'contentId',
        });
        enrichmentStore.createIndex('by_status', 'enrichmentStatus');
        enrichmentStore.createIndex('by_tmdb_id', 'tmdbId');
      }

      // Create tmdb_negative_cache store
      if (!db.objectStoreNames.contains(TMDB_NEGATIVE_CACHE_STORE)) {
        db.createObjectStore(TMDB_NEGATIVE_CACHE_STORE, {
          keyPath: 'contentId',
        });
      }

      // Suppress unused variable warnings
      void oldVersion;
      void newVersion;
    },
  });
}
