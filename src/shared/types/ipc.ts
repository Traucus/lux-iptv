// ─── Episode (series detail payload) ──────────────────────────────────────────
export type Episode = {
  id: number;
  seriesId: number;
  name: string;
  url: string;
  season: number;
  episode: number;
  cover: string | null;
  addedAt: number;
};

// ─── Enriched CatalogItem (after merging TMDB enrichment from IndexedDB) ──────
// The renderer computes enrichmentStatus from the IndexedDB enrichment record
// (content_enrichment store). The catalog schema in SQLite does NOT carry
// enrichment state — it lives alongside the TMDB payload in IndexedDB.
export type CatalogEnrichmentStatus = 'pending' | 'enriched' | 'not_found' | 'error';

export interface EnrichedCatalogItem extends CatalogItem {
  enrichmentStatus: CatalogEnrichmentStatus;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  runtime: number | null;
  genres: string[];
}

// ─── Error Codes ──────────────────────────────────────────────────────────────
export const ErrorCodes = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'DB_CORRUPTED',
  'INGEST_IN_PROGRESS',
  'AUTH_FAILED',
  'NETWORK',
  'TMDB_RATE_LIMIT',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ErrorCodes)[number];

// ─── IPC Response Types ───────────────────────────────────────────────────────
export type IpcSuccess<T> = { data: T; error?: undefined };
export type IpcError = { data?: undefined; error: { code: ErrorCode; message: string; details?: unknown } };
export type IpcResult<T> = IpcSuccess<T> | IpcError;

// ─── Ingest ───────────────────────────────────────────────────────────────────
export type IngestSource = 'xtream' | 'm3u';

export type IngestStartInput = {
  source: IngestSource;
  credentials?: { server: string; username: string; password: string };
  url?: string;
  listName: string;
};

export type IngestStartOutput = { jobId: string };

export type IngestCancelInput = { jobId: string };

export type IngestProgressInput = { jobId: string };

export type IngestProgress = {
  phase: string;
  percent: number;
  counts: { live: number; movies: number; series: number; radio: number; total: number };
};

// ─── Catalog ──────────────────────────────────────────────────────────────────
export type CatalogType = 'live' | 'movie' | 'series' | 'episode';

export type CatalogListInput = {
  type: CatalogType;
  limit?: number;
  offset?: number;
  search?: string;
};

export type CatalogListOutput = {
  items: CatalogItem[];
  total: number;
};

export type CatalogGetByIdInput = {
  type: CatalogType;
  id: number;
};

export type CatalogItem = {
  id: number;
  name: string;
  url: string;
  groupTitle: string | null;
  cover: string | null;
  year: number | null;
  contentType: 'live' | 'movie' | 'series' | 'episode';
  mediaFormat: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
  /**
   * Per-stream HTTP request hints in canonical wire format (header name → value).
   * `{}` when the source did not provide any overrides. Consumed by the
   * stream proxy to inject headers on outbound requests.
   */
  httpHeaders: Record<string, string>;
};

export type SeriesDetail = {
  series: CatalogItem;
  seasons: Array<{
    seasonNumber: number;
    episodes: Episode[];
  }>;
};

// ─── Enrichment ───────────────────────────────────────────────────────────────
export type EnrichmentStatus = {
  queueLength: number;
  lastEnrichedAt: number | null;
  isRunning: boolean;
};

// ─── TMDB ─────────────────────────────────────────────────────────────────────
export type TmdbKeyInput = { key: string };
export type TmdbKeyOutput = { valid: boolean };
export type TmdbKeyPlainOutput = { key: string } | null;

// ─── LuxAPI Interface ─────────────────────────────────────────────────────────
export interface LuxAPI {
  // Ingest
  'ingest:start': (input: IngestStartInput) => Promise<IpcResult<IngestStartOutput>>;
  'ingest:cancel': (input: IngestCancelInput) => Promise<IpcResult<void>>;
  'ingest:getProgress': (input: IngestProgressInput) => Promise<IpcResult<IngestProgress>>;
  'ingest:onProgress': (cb: (progress: IngestProgress) => void) => () => void;

  // Catalog
  'catalog:list': (input: CatalogListInput) => Promise<IpcResult<CatalogListOutput>>;
  'catalog:getById': (input: CatalogGetByIdInput) => Promise<IpcResult<CatalogItem | SeriesDetail>>;

  // Enrichment
  'enrichment:getStatus': () => Promise<IpcResult<EnrichmentStatus>>;

  // TMDB
  'tmdb:setKey': (input: TmdbKeyInput) => Promise<IpcResult<TmdbKeyOutput>>;
  'tmdb:hasKey': () => Promise<IpcResult<boolean>>;
  'tmdb:clearKey': () => Promise<IpcResult<void>>;
}
