export type ContentType = 'live' | 'movie' | 'series' | 'radio';

type ClassifyInput = {
  url: string;
  name: string;
  groupTitle?: string | null;
  tvgId?: string | null;
  streamType?: string | null;
};

const MOVIE_URL_PATTERN = /\/movie\//i;
const SERIES_URL_PATTERN = /\/series\//i;
const LIVE_URL_PATTERN = /\/live\//i;

const MOVIE_GROUP_PATTERNS = [
  /movies?/i,
  /filmes?/i,
  /pel[ií]culas?/i,
  /vod/i,
  /cine/i,
];

const SERIES_GROUP_PATTERNS = [
  /series?/i,
  /diziler/i,
  /s[eé]ries?/i,
  /tv\s*shows?/i,
];

const RADIO_GROUP_PATTERNS = [
  /radios?/i,
  /radyolar?/i,
];

const IMDB_ID_PATTERN = /tt\d{7,8}/;
const SEASON_EPISODE_PATTERN = /S\d{1,2}E\d{1,3}/i;

/**
 * 6-stage heuristic classifier for IPTV content.
 * Based on DOC-3 §3.2.
 */
export function classify(input: ClassifyInput): ContentType {
  const { url, name, groupTitle, streamType } = input;

  // Stage 1: URL path check
  if (MOVIE_URL_PATTERN.test(url)) return 'movie';
  if (SERIES_URL_PATTERN.test(url)) return 'series';
  if (LIVE_URL_PATTERN.test(url)) return 'live';

  // Stage 2: group-title pattern matching
  if (groupTitle) {
    for (const pattern of MOVIE_GROUP_PATTERNS) {
      if (pattern.test(groupTitle)) return 'movie';
    }
    for (const pattern of SERIES_GROUP_PATTERNS) {
      if (pattern.test(groupTitle)) return 'series';
    }
    for (const pattern of RADIO_GROUP_PATTERNS) {
      if (pattern.test(groupTitle)) return 'radio';
    }
  }

  // Stage 3: stream type metadata
  if (streamType) {
    const st = streamType.toLowerCase();
    if (st === 'movie') return 'movie';
    if (st === 'series') return 'series';
    if (st === 'radio') return 'radio';
    if (st === 'live') return 'live';
  }

  // Stage 4: IMDb ID presence → movie (most common case)
  if (IMDB_ID_PATTERN.test(name)) return 'movie';

  // Stage 5: Name pattern analysis (SxxExx → series)
  if (SEASON_EPISODE_PATTERN.test(name)) return 'series';

  // Stage 6: Default to live
  return 'live';
}
