import type { M3UEntry, M3UEntryHttpHints } from './m3u-client.js';

const DEFAULT_TIMEOUT_MS = 15000;

interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
}

interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  category_ids: number[];
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
}

interface XtreamVodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  is_adult: string;
  category_id: string;
  category_ids: number[];
  container_extension: string;
  custom_sid: string;
  direct_source: string;
}

interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
  category_ids: number[];
}

function buildUrl(server: string, params: Record<string, string>): string {
  const base = server.replace(/\/+$/, '');
  const qs = new URLSearchParams(params).toString();
  return `${base}/player_api.php?${qs}`;
}

/**
 * Extracts HTTP header hints from a raw Xtream API stream object.
 * The API returns `user_agent` and `referer` fields per stream when the
 * operator has configured custom headers. Returns `null` when no header
 * fields are present.
 */
function extractHttpHints(raw: Record<string, unknown>): M3UEntryHttpHints | null {
  const userAgent = raw.user_agent as string | undefined;
  const referer = raw.referer as string | undefined;
  if (!userAgent && !referer) return null;
  const hints: M3UEntryHttpHints = {};
  if (userAgent) hints.userAgent = userAgent;
  if (referer) hints.referer = referer;
  return hints;
}

function buildStreamUrl(
  server: string,
  type: 'live' | 'movie' | 'series',
  username: string,
  password: string,
  streamId: number,
  extension?: string,
): string {
  const base = server.replace(/\/+$/, '');
  if (type === 'live') {
    return `${base}/live/${username}/${password}/${streamId}.m3u8`;
  }
  if (type === 'movie') {
    return `${base}/movie/${username}/${password}/${streamId}.${extension ?? 'mp4'}`;
  }
  // series — individual episodes use series endpoint
  return `${base}/series/${username}/${password}/${streamId}.${extension ?? 'mp4'}`;
}

async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}: ${text.substring(0, 200)}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`PARSE_ERROR: Response is not JSON (${text.substring(0, 100)})`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`CONNECTION_ERROR: Xtream API timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Authenticates with the Xtream API and returns the server info.
 */
export async function xtreamAuth(
  credentials: XtreamCredentials,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ userInfo: unknown; serverInfo: unknown }> {
  const url = buildUrl(credentials.server, {
    username: credentials.username,
    password: credentials.password,
  });
  const data = await fetchJson<Record<string, unknown>>(url, timeoutMs);
  if (!data.user_info || !data.server_info) {
    throw new Error('AUTH_FAILED: Invalid Xtream credentials');
  }
  return { userInfo: data.user_info, serverInfo: data.server_info };
}

/**
 * Fetches all live streams from the Xtream API and converts them to M3UEntry format.
 */
export async function fetchXtreamLive(
  credentials: XtreamCredentials,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<M3UEntry[]> {
  const baseParams = { username: credentials.username, password: credentials.password };

  // Fetch categories and streams in parallel
  const [categories, streams] = await Promise.all([
    fetchJson<XtreamCategory[]>(
      buildUrl(credentials.server, { ...baseParams, action: 'get_live_categories' }),
      timeoutMs,
    ),
    fetchJson<XtreamLiveStream[]>(
      buildUrl(credentials.server, { ...baseParams, action: 'get_live_streams' }),
      timeoutMs,
    ),
  ]);

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.category_id, cat.category_name);
  }

  return streams
    .filter((s) => s.name && s.name.trim().length > 0)
    .map((s) => {
      const http = extractHttpHints(s as unknown as Record<string, unknown>);
      return {
        name: s.name.trim(),
        url: buildStreamUrl(credentials.server, 'live', credentials.username, credentials.password, s.stream_id),
        groupTitle: categoryMap.get(s.category_id) ?? null,
        tvgId: s.epg_channel_id ?? null,
        tvgLogo: s.stream_icon || null,
        http,
        mediaFormat: 'hls' as const,
      };
    });
}

/**
 * Fetches all VOD (movie) streams from the Xtream API and converts them to M3UEntry format.
 */
export async function fetchXtreamVod(
  credentials: XtreamCredentials,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<M3UEntry[]> {
  const baseParams = { username: credentials.username, password: credentials.password };

  const [categories, streams] = await Promise.all([
    fetchJson<XtreamCategory[]>(
      buildUrl(credentials.server, { ...baseParams, action: 'get_vod_categories' }),
      timeoutMs,
    ),
    fetchJson<XtreamVodStream[]>(
      buildUrl(credentials.server, { ...baseParams, action: 'get_vod_streams' }),
      timeoutMs,
    ),
  ]);

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.category_id, cat.category_name);
  }

  return streams
    .filter((s) => s.name && s.name.trim().length > 0)
    .map((s) => {
      const ext = s.container_extension ?? 'mp4';
      const mediaFormat = ext === 'm3u8' ? 'hls' : ext === 'mpd' ? 'dash' : ext === 'ts' ? 'ts' : 'mp4';
      const http = extractHttpHints(s as unknown as Record<string, unknown>);
      return {
        name: s.name.trim(),
        url: buildStreamUrl(credentials.server, 'movie', credentials.username, credentials.password, s.stream_id, ext),
        groupTitle: categoryMap.get(s.category_id) ?? null,
        tvgId: null,
        tvgLogo: s.stream_icon || null,
        http,
        mediaFormat: mediaFormat as M3UEntry['mediaFormat'],
      };
    });
}

/**
 * Fetches the series catalog (get_series + categories) as one row per show.
 * Episode lists (get_series_info) are NOT fetched here — that N+1 made ingest
 * take orders of magnitude longer than live/VOD and often never reached persist.
 */
export async function fetchXtreamSeries(
  credentials: XtreamCredentials,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<M3UEntry[]> {
  const baseParams = { username: credentials.username, password: credentials.password };

  const [categoriesRaw, seriesRaw] = await Promise.all([
    fetchJson<XtreamCategory[]>(
      buildUrl(credentials.server, { ...baseParams, action: 'get_series_categories' }),
      timeoutMs,
    ),
    fetchJson<XtreamSeries[]>(
      buildUrl(credentials.server, { ...baseParams, action: 'get_series' }),
      timeoutMs,
    ),
  ]);

  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];
  const seriesList = Array.isArray(seriesRaw) ? seriesRaw : [];

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(String(cat.category_id), cat.category_name);
  }

  const entries: M3UEntry[] = [];
  for (const series of seriesList) {
    if (!series.name || series.name.trim().length === 0) continue;
    if (series.series_id == null) continue;
    const groupTitle =
      categoryMap.get(String(series.category_id)) ?? series.genre ?? null;
    entries.push({
      name: series.name,
      url: buildStreamUrl(
        credentials.server,
        'series',
        credentials.username,
        credentials.password,
        series.series_id,
        'm3u8',
      ),
      groupTitle,
      tvgId: null,
      tvgLogo: series.cover || null,
      http: null,
      mediaFormat: 'hls',
    });
  }

  return entries;
}
