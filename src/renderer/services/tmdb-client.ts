import type { TmdbMatch } from '../../shared/types/tmdb';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export class TmdbRateLimitError extends Error {
  constructor(message = 'TMDB API rate limit exceeded') {
    super(message);
    this.name = 'TmdbRateLimitError';
  }
}

export class TmdbNotFoundError extends Error {
  constructor(message = 'No TMDB match found') {
    super(message);
    this.name = 'TmdbNotFoundError';
  }
}

interface TmdbSearchResult {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  release_date?: string;
  first_air_date?: string;
}

interface TmdbFindResult {
  movie_results: TmdbSearchResult[];
  tv_results: TmdbSearchResult[];
}

interface TmdbSearchResponse {
  results: TmdbSearchResult[];
}

function extractYear(dateStr?: string): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.substring(0, 4), 10);
  return isNaN(year) ? null : year;
}

function toTmdbMatch(result: TmdbSearchResult, confidence: number): TmdbMatch {
  return {
    tmdbId: result.id,
    mediaType: (result.media_type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv',
    title: result.title ?? result.name ?? '',
    overview: result.overview ?? null,
    posterPath: result.poster_path ?? null,
    backdropPath: result.backdrop_path ?? null,
    voteAverage: result.vote_average ?? 0,
    voteCount: result.vote_count ?? 0,
    releaseYear: extractYear(result.release_date ?? result.first_air_date),
    matchConfidence: confidence,
  };
}

async function tmdbFetch<T>(path: string, apiKey: string): Promise<T> {
  const url = `${TMDB_BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (response.status === 429) {
    throw new TmdbRateLimitError();
  }
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Searches TMDB by IMDb ID using the /find endpoint.
 * Returns matchConfidence 1.0 for exact matches.
 */
export async function searchByImdbId(imdbId: string, apiKey: string): Promise<TmdbMatch> {
  const data = await tmdbFetch<TmdbFindResult>(`/find/${imdbId}?external_source=imdb_id`, apiKey);

  if (data.movie_results.length > 0) {
    return toTmdbMatch({ ...data.movie_results[0], media_type: 'movie' }, 1.0);
  }
  if (data.tv_results.length > 0) {
    return toTmdbMatch({ ...data.tv_results[0], media_type: 'tv' }, 1.0);
  }

  throw new TmdbNotFoundError();
}

/**
 * Searches TMDB for movies by query and optional year.
 */
export async function searchMovie(query: string, year: number | null, apiKey: string): Promise<TmdbMatch> {
  let path = `/search/movie?query=${encodeURIComponent(query)}`;
  if (year) path += `&year=${year}`;

  const data = await tmdbFetch<TmdbSearchResponse>(path, apiKey);

  if (data.results.length === 0) {
    throw new TmdbNotFoundError();
  }

  // Calculate confidence based on popularity and vote count
  const top = data.results[0];
  const confidence = calculateConfidence(top);
  return toTmdbMatch({ ...top, media_type: 'movie' }, confidence);
}

/**
 * Searches TMDB for TV shows by query and optional year.
 */
export async function searchTv(query: string, year: number | null, apiKey: string): Promise<TmdbMatch> {
  let path = `/search/tv?query=${encodeURIComponent(query)}`;
  if (year) path += `&first_air_date_year=${year}`;

  const data = await tmdbFetch<TmdbSearchResponse>(path, apiKey);

  if (data.results.length === 0) {
    throw new TmdbNotFoundError();
  }

  const top = data.results[0];
  const confidence = calculateConfidence(top);
  return toTmdbMatch({ ...top, media_type: 'tv' }, confidence);
}

/**
 * Multi-search fallback.
 */
export async function searchMulti(query: string, apiKey: string): Promise<TmdbMatch> {
  const path = `/search/multi?query=${encodeURIComponent(query)}`;
  const data = await tmdbFetch<TmdbSearchResponse>(path, apiKey);

  if (data.results.length === 0) {
    throw new TmdbNotFoundError();
  }

  const top = data.results[0];
  const confidence = calculateConfidence(top);
  return toTmdbMatch(top, confidence);
}

function calculateConfidence(result: TmdbSearchResult): number {
  const voteCount = result.vote_count ?? 0;
  const voteAvg = result.vote_average ?? 0;

  // Base confidence from vote average (0-10 scale → 0-1)
  let confidence = voteAvg / 10;

  // Boost for high vote count
  if (voteCount >= 1000) confidence = Math.min(1.0, confidence + 0.1);
  else if (voteCount >= 100) confidence = Math.min(1.0, confidence + 0.05);

  // Penalize low vote count
  if (voteCount < 5) confidence *= 0.5;

  return Math.round(confidence * 100) / 100;
}
