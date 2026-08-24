export type PreprocessResult = {
  cleanTitle: string;
  imdbId: string | null;
  year: number | null;
  season: number | null;
  episode: number | null;
};

// Regex 1: IMDb ID extraction (tt + 7-8 digits)
const IMDB_ID_REGEX = /tt\d{7,8}/;

// Regex 2: Year extraction (4-digit year in parentheses or standalone)
const YEAR_REGEX = /\(?(\d{4})\)?/;

// Regex 3: Season/Episode extraction (SxxExx pattern)
const SEASON_EPISODE_REGEX = /S(\d{1,2})E(\d{1,3})/i;

// Regex 4: Noise stripping (quality, codec, release group tags)
const NOISE_PATTERNS = [
  // Quality tags
  /\[?\b(4K|UHD|HDR|HDR10|HDR10\+|Dolby\s*Vision|DV)\b\]?/gi,
  /\[?\b(2160p|1080p|720p|480p|576p|1080i|720i)\b\]?/gi,
  /\[?\b(BluRay|Blu-Ray|BDRip|BRRip|WEB-DL|WEBRip|WEB|HDTV|DVDRip|DVDScr|HDRip|CAM|R5|TELESYNC|TS|TELECINE|TC|PDTV|SDTV|VHSRip|VHS)\b\]?/gi,
  // Codec tags
  /\[?\b(x264|x265|h264|h265|HEVC|AVC|VP9|AV1|XviD|DivX)\b\]?/gi,
  /\[?\b(DTS|DTS-HD|DTS-HD\.MA|TrueHD|Atmos|AAC|AC3|EAC3|FLAC|MP3|OGG|DD5\.1|7\.1|5\.1)\b\]?/gi,
  // Release group tags in brackets
  /\[([^\]]+)\]/g,
  // File extensions
  /\.(mkv|avi|mp4|ts|m3u8|mpg|mpeg|wmv|flv|webm)$/i,
  // SxxExx pattern (will be extracted separately, but remove from title)
  /\bS\d{1,2}E\d{1,3}\b/gi,
  // Episode title after SxxExx
  /(?:S\d{1,2}E\d{1,3})\.(.+)/gi,
  // Dots used as spaces (but only between words)
  /(?<=[a-zA-Z])\.(?=[a-zA-Z])/g,
  // Year in parentheses (will be extracted separately)
  /\(\d{4}\)/g,
  // Trailing noise after quality tags
  /\b(REMUX|PROPER|REPACK|EXTENDED|UNRATED|DIRECTORS\.CUT|THEATRICAL|IMAX|LIMITED|INTERNAL|SUBBED|DUBBED|MULTI|DUAL|MULTISUBS)\b/gi,
];

/**
 * Preprocesses a raw IPTV entry name, extracting structured metadata.
 * Based on DOC-8 §8.3 regex patterns.
 */
export function preprocess(rawName: string): PreprocessResult {
  // Extract IMDb ID
  const imdbMatch = rawName.match(IMDB_ID_REGEX);
  const imdbId = imdbMatch ? imdbMatch[0] : null;

  // Extract year
  const yearMatch = rawName.match(YEAR_REGEX);
  let year: number | null = null;
  if (yearMatch?.[1]) {
    const y = parseInt(yearMatch[1], 10);
    if (y >= 1900 && y <= 2099) {
      year = y;
    }
  }

  // Extract season/episode
  const seMatch = rawName.match(SEASON_EPISODE_REGEX);
  const season = seMatch?.[1] ? parseInt(seMatch[1], 10) : null;
  const episode = seMatch?.[2] ? parseInt(seMatch[2], 10) : null;

  // Clean title: remove noise
  let cleanTitle = rawName;

  // Remove IMDb ID from title
  if (imdbId) {
    cleanTitle = cleanTitle.replace(imdbId, '');
  }

  // Apply noise patterns
  for (const pattern of NOISE_PATTERNS) {
    cleanTitle = cleanTitle.replace(pattern, ' ');
  }

  // Clean up whitespace and special chars
  cleanTitle = cleanTitle
    .replace(/[_]+/g, ' ') // underscores to spaces
    .replace(/\s+/g, ' ')  // collapse multiple spaces
    .replace(/^[\s.\-_|[\]]+/, '') // trim leading noise
    .replace(/[\s.\-_|[\]]+$/, '') // trim trailing noise
    .trim();

  return {
    cleanTitle: cleanTitle || rawName.trim(),
    imdbId,
    year,
    season,
    episode,
  };
}
