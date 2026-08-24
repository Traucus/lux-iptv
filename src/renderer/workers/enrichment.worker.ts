/// <reference lib="webworker" />

import { preprocess } from '../services/preprocessor';
import { SemaphoreQueue } from '../services/queue';
import {
  searchByImdbId,
  searchMovie,
  searchTv,
  searchMulti,
  TmdbNotFoundError,
  TmdbRateLimitError,
} from '../services/tmdb-client';
import { upsertEnrichment, getPendingEnrichments } from '../db/enrichment';
import { set as setNegativeCache } from '../db/negative-cache';
import type { TmdbMatch, EnrichmentRecord } from '../../shared/types/tmdb';

declare const self: DedicatedWorkerGlobalScope;
export {};

const HYDRATION_CONCURRENCY = 5;
const CONFIDENCE_AUTO_PERSIST = 0.85;
const MIN_VOTE_COUNT = 5;
const NEGATIVE_CACHE_TTL_DAYS = 30;
const MAX_RETRY_ATTEMPTS = 3;

let tmdbKey: string | null = null;
const queue = new SemaphoreQueue(HYDRATION_CONCURRENCY);

interface EnrichmentItem {
  contentId: string;
  name: string;
  type: 'movie' | 'tv' | 'live';
  year?: number | null;
}

type WorkerMessage =
  | { type: 'START'; tmdbKey: string }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'ENRICH_ITEMS'; items: EnrichmentItem[] };

let isPaused = false;

/**
 * Enriches a single item using the TMDB cascade.
 */
async function enrichItem(item: EnrichmentItem, apiKey: string): Promise<TmdbMatch | null> {
  const preprocessed = preprocess(item.name);

  // Cascade 1: IMDb ID exact match
  if (preprocessed.imdbId) {
    try {
      return await searchByImdbId(preprocessed.imdbId, apiKey);
    } catch (err) {
      if (err instanceof TmdbNotFoundError) {
        // Fall through to next cascade
      } else {
        throw err;
      }
    }
  }

  // Cascade 2: Search by type with year
  const year = preprocessed.year ?? item.year ?? null;
  if (item.type === 'movie') {
    try {
      return await searchMovie(preprocessed.cleanTitle, year, apiKey);
    } catch (err) {
      if (err instanceof TmdbNotFoundError) {
        // Fall through
      } else {
        throw err;
      }
    }
  } else if (item.type === 'tv') {
    try {
      return await searchTv(preprocessed.cleanTitle, year, apiKey);
    } catch (err) {
      if (err instanceof TmdbNotFoundError) {
        // Fall through
      } else {
        throw err;
      }
    }
  }

  // Cascade 3: Multi-search fallback
  try {
    return await searchMulti(preprocessed.cleanTitle, apiKey);
  } catch (err) {
    if (err instanceof TmdbNotFoundError) {
      return null;
    }
    throw err;
  }
}

/**
 * Processes a single enrichment item with retry logic.
 */
async function processItem(item: EnrichmentItem, apiKey: string): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    if (isPaused) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    try {
      // Update status to fetching
      await upsertEnrichment({
        contentId: item.contentId,
        tmdbId: null,
        mediaType: null,
        title: null,
        overview: null,
        posterPath: null,
        backdropPath: null,
        voteAverage: null,
        voteCount: null,
        releaseYear: null,
        matchConfidence: null,
        enrichmentStatus: 'fetching',
        attempts: attempt,
        lastAttemptAt: Date.now(),
      });

      const match = await enrichItem(item, apiKey);

      if (!match) {
        // Not found - write to negative cache
        await upsertEnrichment({
          contentId: item.contentId,
          tmdbId: null,
          mediaType: null,
          title: null,
          overview: null,
          posterPath: null,
          backdropPath: null,
          voteAverage: null,
          voteCount: null,
          releaseYear: null,
          matchConfidence: null,
          enrichmentStatus: 'not_found',
          attempts: attempt + 1,
          lastAttemptAt: Date.now(),
        });
        await setNegativeCache(item.contentId);
        self.postMessage({ type: 'ITEM_DONE', contentId: item.contentId, status: 'not_found' });
        return;
      }

      // Check confidence threshold
      if (match.voteCount >= MIN_VOTE_COUNT && match.matchConfidence >= CONFIDENCE_AUTO_PERSIST) {
        // Auto-persist
        await upsertEnrichment({
          contentId: item.contentId,
          tmdbId: match.tmdbId,
          mediaType: match.mediaType,
          title: match.title,
          overview: match.overview,
          posterPath: match.posterPath,
          backdropPath: match.backdropPath,
          voteAverage: match.voteAverage,
          voteCount: match.voteCount,
          releaseYear: match.releaseYear,
          matchConfidence: match.matchConfidence,
          enrichmentStatus: 'succeeded',
          attempts: attempt + 1,
          lastAttemptAt: Date.now(),
        });
        self.postMessage({ type: 'ITEM_DONE', contentId: item.contentId, status: 'succeeded' });
      } else {
        // Low confidence - leave as pending for manual review
        await upsertEnrichment({
          contentId: item.contentId,
          tmdbId: match.tmdbId,
          mediaType: match.mediaType,
          title: match.title,
          overview: match.overview,
          posterPath: match.posterPath,
          backdropPath: match.backdropPath,
          voteAverage: match.voteAverage,
          voteCount: match.voteCount,
          releaseYear: match.releaseYear,
          matchConfidence: match.matchConfidence,
          enrichmentStatus: 'pending',
          attempts: attempt + 1,
          lastAttemptAt: Date.now(),
        });
        self.postMessage({ type: 'ITEM_DONE', contentId: item.contentId, status: 'pending' });
      }
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (err instanceof TmdbRateLimitError) {
        // Backoff
        const backoff = queue.getBackoff(attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      // Other errors - retry
      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        const backoff = queue.getBackoff(attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
    }
  }

  // All retries exhausted
  await upsertEnrichment({
    contentId: item.contentId,
    tmdbId: null,
    mediaType: null,
    title: null,
    overview: null,
    posterPath: null,
    backdropPath: null,
    voteAverage: null,
    voteCount: null,
    releaseYear: null,
    matchConfidence: null,
    enrichmentStatus: 'failed',
    attempts: MAX_RETRY_ATTEMPTS,
    lastAttemptAt: Date.now(),
  });
  self.postMessage({
    type: 'ITEM_DONE',
    contentId: item.contentId,
    status: 'failed',
    error: lastError?.message,
  });
}

// Worker message handler
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'START':
      tmdbKey = msg.tmdbKey;
      isPaused = false;
      self.postMessage({ type: 'STARTED' });
      break;

    case 'PAUSE':
      isPaused = true;
      self.postMessage({ type: 'PAUSED' });
      break;

    case 'RESUME':
      isPaused = false;
      self.postMessage({ type: 'RESUMED' });
      break;

    case 'ENRICH_ITEMS':
      if (!tmdbKey) {
        self.postMessage({ type: 'ERROR', message: 'TMDB key not set' });
        return;
      }
      for (const item of msg.items) {
        queue.enqueue(() => processItem(item, tmdbKey!));
      }
      break;
  }
});
