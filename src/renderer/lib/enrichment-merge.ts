import type { ContentEnrichmentRecord } from '../db/schema';
import type { CatalogItem, EnrichedCatalogItem } from '../../shared/types/ipc';

// ─── TMDB Image Configuration ─────────────────────────────────────────────────
export const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

export type TmdbPosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';
export type TmdbBackdropSize = 'w300' | 'w780' | 'w1280' | 'original';

export const DEFAULT_POSTER_SIZE: TmdbPosterSize = 'w342';
export const DEFAULT_BACKDROP_SIZE: TmdbBackdropSize = 'w1280';

/**
 * buildTmdbImageUrl — assembles a TMDB CDN URL from a stored path.
 * Returns null when the path is null/empty so callers can fall through to M3U art.
 */
export function buildTmdbImageUrl(
  path: string | null | undefined,
  size: TmdbPosterSize | TmdbBackdropSize = DEFAULT_BACKDROP_SIZE,
): string | null {
  if (!path) return null;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE_URL}/${size}${normalized}`;
}

// ─── TMDB Genre Maps ──────────────────────────────────────────────────────────
// Small built-in maps so the renderer can show genre names without an extra TMDB
// fetch. The maps cover the full official genre lists for movies and TV shows.
const MOVIE_GENRE_MAP: Readonly<Record<number, string>> = Object.freeze({
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Science Fiction',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
});

const TV_GENRE_MAP: Readonly<Record<number, string>> = Object.freeze({
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
});

/**
 * resolveGenreNames — converts a list of TMDB genre IDs into display names.
 * Unknown IDs are dropped silently to avoid showing raw integers to users.
 */
export function resolveGenreNames(
  genreIds: readonly number[] | null | undefined,
  mediaType: 'movie' | 'tv' | null,
): string[] {
  if (!genreIds || genreIds.length === 0) return [];
  const map = mediaType === 'tv' ? TV_GENRE_MAP : MOVIE_GENRE_MAP;
  const names: string[] = [];
  for (const id of genreIds) {
    const name = map[id];
    if (name) names.push(name);
  }
  return names;
}

// ─── Duration formatting ──────────────────────────────────────────────────────
/**
 * formatRuntimeMinutes — formats a TMDB runtime in minutes as "Xh Ym".
 * Returns null for missing input so callers can omit the field from the UI.
 */
export function formatRuntimeMinutes(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ─── Enrichment merge ─────────────────────────────────────────────────────────
export interface MergeEnrichmentOptions {
  /**
   * Poster size to request from TMDB. Defaults to w342.
   */
  posterSize?: TmdbPosterSize;
  /**
   * Backdrop size to request from TMDB. Defaults to w1280.
   */
  backdropSize?: TmdbBackdropSize;
  /**
   * When the enrichment record has no usable poster, fall back to the M3U cover.
   * Defaults to true.
   */
  fallbackToM3uCover?: boolean;
}

const DEFAULT_MERGE_OPTIONS: Required<MergeEnrichmentOptions> = {
  posterSize: DEFAULT_POSTER_SIZE,
  backdropSize: DEFAULT_BACKDROP_SIZE,
  fallbackToM3uCover: true,
};

/**
 * isEnrichmentSucceeded — true when the record carries TMDB metadata we can use.
 * The IndexedDB schema uses 'succeeded' as the terminal state (the catalog's
 * CatalogItem.enrichmentStatus uses 'enriched', but the renderer-side store
 * uses the worker-level state names).
 */
export function isEnrichmentSucceeded(record: ContentEnrichmentRecord | null | undefined): boolean {
  if (!record) return false;
  return record.enrichmentStatus === 'succeeded';
}

/**
 * mergeEnrichment — produces an EnrichedCatalogItem by combining the raw M3U
 * data with TMDB metadata from IndexedDB. The output is always a fully-typed
 * view: when no enrichment exists the enriched fields are null/empty and the
 * caller can detect degraded mode via `enrichmentStatus === 'enriched'`.
 *
 * The enrichment status is sourced exclusively from IndexedDB (the catalog
 * schema in SQLite no longer carries enrichment state). When the renderer has
 * a ContentEnrichmentRecord, `enrichmentStatus` is derived from it; when no
 * record exists yet (still loading or never enqueued), we report 'pending' so
 * the UI can avoid a flash of "enriched" before IndexedDB resolves.
 */
export function mergeEnrichment(
  item: CatalogItem,
  enrichment: ContentEnrichmentRecord | null | undefined,
  options: MergeEnrichmentOptions = {},
): EnrichedCatalogItem {
  const opts: Required<MergeEnrichmentOptions> = { ...DEFAULT_MERGE_OPTIONS, ...options };
  const hasEnrichment = isEnrichmentSucceeded(enrichment);
  const enrichmentStatus = deriveEnrichmentStatus(enrichment);

  const tmdbPosterUrl = hasEnrichment
    ? buildTmdbImageUrl(enrichment!.posterPath, opts.posterSize)
    : null;
  const tmdbBackdropUrl = hasEnrichment
    ? buildTmdbImageUrl(enrichment!.backdropPath, opts.backdropSize)
    : null;

  const posterUrl = tmdbPosterUrl ?? (opts.fallbackToM3uCover ? item.cover : null);
  const backdropUrl = tmdbBackdropUrl;

  const overview = hasEnrichment ? enrichment!.overview : null;
  const voteAverage = hasEnrichment ? enrichment!.voteAverage : null;
  const releaseYear = hasEnrichment ? enrichment!.releaseYear : item.year;

  // Genre IDs are stored on the enrichment record (optional; absent in older
  // records). When they're missing we fall back to the M3U group title as a
  // pseudo-genre so the UI can still render a single tag in degraded mode.
  const tmdbGenres = hasEnrichment ? resolveGenreNames(enrichment!.genreIds, enrichment!.mediaType) : [];
  const genres = tmdbGenres.length > 0 ? tmdbGenres : item.groupTitle ? [item.groupTitle] : [];

  // Runtime is optional on the enrichment record. When absent (degraded mode)
  // we return null so the UI can omit duration per REQ-DEGRADED-3.
  const runtime = hasEnrichment && typeof enrichment!.runtime === 'number' ? enrichment!.runtime : null;

  return {
    ...item,
    enrichmentStatus,
    year: releaseYear,
    overview,
    posterUrl,
    backdropUrl,
    voteAverage,
    runtime,
    genres,
  };
}

/**
 * deriveEnrichmentStatus — maps the renderer-side ContentEnrichmentRecord
 * state machine to the catalog-facing `CatalogEnrichmentStatus` value.
 *
 * Mapping:
 *   - succeeded → 'enriched'
 *   - not_found → 'not_found'
 *   - failed    → 'error'
 *   - pending/queued/fetching (or no record) → 'pending'
 */
function deriveEnrichmentStatus(
  enrichment: ContentEnrichmentRecord | null | undefined,
): EnrichedCatalogItem['enrichmentStatus'] {
  if (!enrichment) return 'pending';
  switch (enrichment.enrichmentStatus) {
    case 'succeeded':
      return 'enriched';
    case 'not_found':
      return 'not_found';
    case 'failed':
      return 'error';
    case 'pending':
    case 'queued':
    case 'fetching':
    default:
      return 'pending';
  }
}

// ─── Batch enrichment map ─────────────────────────────────────────────────────
/**
 * buildEnrichmentMap — indexes a list of enrichment records by contentId so
 * callers can look up enrichment in O(1) during render.
 */
export function buildEnrichmentMap(
  records: ReadonlyArray<ContentEnrichmentRecord>,
): Map<string, ContentEnrichmentRecord> {
  const map = new Map<string, ContentEnrichmentRecord>();
  for (const record of records) {
    map.set(record.contentId, record);
  }
  return map;
}

/**
 * enrichItems — convenience helper that combines buildEnrichmentMap + map +
 * mergeEnrichment. Useful in feature hooks that already have a list of items
 * and a list of enrichment records.
 */
export function enrichItems(
  items: readonly CatalogItem[],
  records: ReadonlyArray<ContentEnrichmentRecord>,
  options: MergeEnrichmentOptions = {},
): EnrichedCatalogItem[] {
  const map = buildEnrichmentMap(records);
  return items.map((item) => {
    const record = map.get(String(item.id));
    return mergeEnrichment(item, record, options);
  });
}

// ─── contentId keying ─────────────────────────────────────────────────────────
/**
 * toContentId — produces the IndexedDB key for a given CatalogItem id.
 * The renderer store keys enrichment records by stringified numeric id.
 */
export function toContentId(id: number | string): string {
  return typeof id === 'string' ? id : String(id);
}
