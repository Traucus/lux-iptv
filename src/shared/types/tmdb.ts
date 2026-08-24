// ─── TMDB Types ───────────────────────────────────────────────────────────────

export interface TmdbMatch {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  voteCount: number;
  releaseYear: number | null;
  matchConfidence: number;
}

export type EnrichmentItemStatus = 'pending' | 'queued' | 'fetching' | 'succeeded' | 'failed' | 'not_found';

export interface EnrichmentRecord {
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
  enrichmentStatus: EnrichmentItemStatus;
  attempts: number;
  lastAttemptAt: number | null;
}

export interface NegativeCacheRecord {
  contentId: string;
  expiresAt: number;
}
