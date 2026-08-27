// @vitest-environment node
/**
 * Enrichment merge utility — pure function tests.
 * Covers the verify-report fixes for enriched metadata, fanart/backdrop, and
 * the genre/runtime/resolution fallbacks.
 */
import { describe, it, expect } from 'vitest';
import {
  buildTmdbImageUrl,
  resolveGenreNames,
  formatRuntimeMinutes,
  mergeEnrichment,
  enrichItems,
  buildEnrichmentMap,
  isEnrichmentSucceeded,
  toContentId,
  TMDB_IMAGE_BASE_URL,
} from '../../../src/renderer/lib/enrichment-merge';
import type { CatalogItem } from '../../../src/shared/types/ipc';
import type { ContentEnrichmentRecord } from '../../../src/renderer/db/schema';

function makeItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: 1,
    name: 'The Matrix',
    url: 'http://x.m3u',
    groupTitle: 'Sci-Fi',
    cover: 'http://m3u/cover.jpg',
    year: 1999,
    enrichmentStatus: 'enriched',
    ...overrides,
  };
}

function makeEnrichment(overrides: Partial<ContentEnrichmentRecord> = {}): ContentEnrichmentRecord {
  return {
    contentId: '1',
    tmdbId: 603,
    mediaType: 'movie',
    title: 'The Matrix',
    overview: 'A hacker discovers reality is a simulation.',
    posterPath: '/abc.jpg',
    backdropPath: '/backdrop.jpg',
    voteAverage: 8.7,
    voteCount: 25000,
    releaseYear: 1999,
    matchConfidence: 0.95,
    enrichmentStatus: 'succeeded',
    attempts: 1,
    lastAttemptAt: 1700000000000,
    ...overrides,
  };
}

describe('buildTmdbImageUrl', () => {
  it('builds a full TMDB CDN URL from a stored path', () => {
    expect(buildTmdbImageUrl('/abc.jpg', 'w342')).toBe(`${TMDB_IMAGE_BASE_URL}/w342/abc.jpg`);
  });

  it('returns null for empty path', () => {
    expect(buildTmdbImageUrl(null)).toBeNull();
    expect(buildTmdbImageUrl(undefined)).toBeNull();
    expect(buildTmdbImageUrl('')).toBeNull();
  });

  it('handles paths that are missing the leading slash', () => {
    expect(buildTmdbImageUrl('abc.jpg', 'w1280')).toBe(`${TMDB_IMAGE_BASE_URL}/w1280/abc.jpg`);
  });
});

describe('resolveGenreNames', () => {
  it('maps movie TMDB genre IDs to display names', () => {
    expect(resolveGenreNames([28, 878, 12], 'movie')).toEqual(['Action', 'Science Fiction', 'Adventure']);
  });

  it('maps TV TMDB genre IDs to display names', () => {
    expect(resolveGenreNames([18, 10765], 'tv')).toEqual(['Drama', 'Sci-Fi & Fantasy']);
  });

  it('drops unknown IDs without surfacing raw integers', () => {
    expect(resolveGenreNames([28, 99999, 18], 'movie')).toEqual(['Action', 'Drama']);
  });

  it('returns [] for null / empty / non-array input', () => {
    expect(resolveGenreNames(null, 'movie')).toEqual([]);
    expect(resolveGenreNames([], 'movie')).toEqual([]);
    expect(resolveGenreNames(undefined, 'movie')).toEqual([]);
  });
});

describe('formatRuntimeMinutes', () => {
  it('formats as Xh Ym when both hours and minutes are non-zero', () => {
    expect(formatRuntimeMinutes(142)).toBe('2h 22m');
  });

  it('formats as Xh when minutes are zero', () => {
    expect(formatRuntimeMinutes(120)).toBe('2h');
  });

  it('formats as Ym when hours are zero', () => {
    expect(formatRuntimeMinutes(45)).toBe('45m');
  });

  it('returns null for null / zero / negative input', () => {
    expect(formatRuntimeMinutes(null)).toBeNull();
    expect(formatRuntimeMinutes(0)).toBeNull();
    expect(formatRuntimeMinutes(-5)).toBeNull();
  });
});

describe('isEnrichmentSucceeded', () => {
  it('returns true for status "succeeded"', () => {
    expect(isEnrichmentSucceeded(makeEnrichment({ enrichmentStatus: 'succeeded' }))).toBe(true);
  });

  it('returns false for any other status', () => {
    expect(isEnrichmentSucceeded(makeEnrichment({ enrichmentStatus: 'pending' }))).toBe(false);
    expect(isEnrichmentSucceeded(makeEnrichment({ enrichmentStatus: 'failed' }))).toBe(false);
    expect(isEnrichmentSucceeded(makeEnrichment({ enrichmentStatus: 'not_found' }))).toBe(false);
  });

  it('returns false for null / undefined records', () => {
    expect(isEnrichmentSucceeded(null)).toBe(false);
    expect(isEnrichmentSucceeded(undefined)).toBe(false);
  });
});

describe('mergeEnrichment', () => {
  it('produces a TMDB poster URL when enrichment has a posterPath', () => {
    const merged = mergeEnrichment(makeItem(), makeEnrichment());
    expect(merged.posterUrl).toBe(`${TMDB_IMAGE_BASE_URL}/w342/abc.jpg`);
  });

  it('produces a TMDB backdrop URL when enrichment has a backdropPath', () => {
    const merged = mergeEnrichment(makeItem(), makeEnrichment());
    expect(merged.backdropUrl).toBe(`${TMDB_IMAGE_BASE_URL}/w1280/backdrop.jpg`);
  });

  it('exposes the overview as the synopsis', () => {
    const merged = mergeEnrichment(makeItem(), makeEnrichment());
    expect(merged.overview).toBe('A hacker discovers reality is a simulation.');
  });

  it('exposes the voteAverage for the rating display', () => {
    const merged = mergeEnrichment(makeItem(), makeEnrichment());
    expect(merged.voteAverage).toBe(8.7);
  });

  it('falls back to the M3U cover when enrichment has no poster', () => {
    const merged = mergeEnrichment(makeItem(), makeEnrichment({ posterPath: null }));
    expect(merged.posterUrl).toBe('http://m3u/cover.jpg');
  });

  it('returns null for backdrop when enrichment is missing (no M3U fallback)', () => {
    const merged = mergeEnrichment(makeItem(), makeEnrichment({ backdropPath: null }));
    expect(merged.backdropUrl).toBeNull();
  });

  it('falls back to the M3U group title as a pseudo-genre when no genre IDs are present', () => {
    const merged = mergeEnrichment(makeItem({ groupTitle: 'Sci-Fi' }), makeEnrichment());
    expect(merged.genres).toEqual(['Sci-Fi']);
  });

  it('returns an empty genres list when neither enrichment IDs nor group title are available', () => {
    const merged = mergeEnrichment(
      makeItem({ groupTitle: null }),
      makeEnrichment(),
    );
    expect(merged.genres).toEqual([]);
  });

  it('produces a fully-null enriched view when no enrichment record is provided', () => {
    const merged = mergeEnrichment(makeItem(), null);
    expect(merged.overview).toBeNull();
    expect(merged.posterUrl).toBe('http://m3u/cover.jpg'); // M3U fallback
    expect(merged.backdropUrl).toBeNull();
    expect(merged.voteAverage).toBeNull();
    expect(merged.runtime).toBeNull();
    expect(merged.genres).toEqual(['Sci-Fi']); // M3U group title fallback
  });

  it('prefers the enrichment releaseYear when present, falling back to item.year otherwise', () => {
    const merged = mergeEnrichment(
      makeItem({ year: 1998 }),
      makeEnrichment({ releaseYear: 1999 }),
    );
    expect(merged.year).toBe(1999);

    const noEnrichment = mergeEnrichment(makeItem({ year: 1998 }), null);
    expect(noEnrichment.year).toBe(1998);
  });

  it('resolves genre names from the enrichment when genreIds is set', () => {
    const enriched = makeEnrichment({ genreIds: [28, 878, 12] });
    const merged = mergeEnrichment(makeItem(), enriched);
    expect(merged.genres).toEqual(['Action', 'Science Fiction', 'Adventure']);
  });

  it('exposes runtime from the enrichment when runtime is set', () => {
    const enriched = makeEnrichment({ runtime: 136 });
    const merged = mergeEnrichment(makeItem(), enriched);
    expect(merged.runtime).toBe(136);
  });
});

describe('buildEnrichmentMap', () => {
  it('indexes enrichment records by contentId', () => {
    const map = buildEnrichmentMap([makeEnrichment({ contentId: '1' }), makeEnrichment({ contentId: '2' })]);
    expect(map.size).toBe(2);
    expect(map.get('1')?.contentId).toBe('1');
    expect(map.get('2')?.contentId).toBe('2');
  });

  it('returns an empty map for an empty list', () => {
    const map = buildEnrichmentMap([]);
    expect(map.size).toBe(0);
  });
});

describe('enrichItems', () => {
  it('produces an EnrichedCatalogItem for each catalog input', () => {
    const items = [makeItem({ id: 1 }), makeItem({ id: 2, name: 'Inception' })];
    const records = [
      makeEnrichment({ contentId: '1' }),
      makeEnrichment({ contentId: '2', overview: 'A dream within a dream.' }),
    ];
    const enriched = enrichItems(items, records);
    expect(enriched).toHaveLength(2);
    expect(enriched[0]?.overview).toBe('A hacker discovers reality is a simulation.');
    expect(enriched[1]?.overview).toBe('A dream within a dream.');
  });

  it('returns items with null enriched fields when no matching record is found', () => {
    const items = [makeItem({ id: 99, name: 'Unknown' })];
    const records = [makeEnrichment({ contentId: '1' })];
    const enriched = enrichItems(items, records);
    expect(enriched[0]?.overview).toBeNull();
  });
});

describe('toContentId', () => {
  it('stringifies numeric ids', () => {
    expect(toContentId(1)).toBe('1');
  });

  it('returns the string as-is for string input', () => {
    expect(toContentId('abc')).toBe('abc');
  });
});
