import {
  detectMediaFormat,
  isUsableDirectSource,
  type M3UEntry,
} from '../m3u-client.js';
import { buildUrl, extractHttpHints, fetchJson } from './http.js';
import {
  DEFAULT_TIMEOUT_MS,
  type XtreamCategory,
  type XtreamCredentials,
  type XtreamLiveStream,
  type XtreamSeries,
  type XtreamVodStream,
} from './types.js';
import { buildHonestStreamUrl, normalizeContainerExtension } from './urls.js';

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
      const http = extractHttpHints(s);
      const directSource = (s.direct_source ?? '').trim();
      const url = buildHonestStreamUrl({
        server: credentials.server,
        type: 'live',
        username: credentials.username,
        password: credentials.password,
        streamId: s.stream_id,
        directSource,
      });
      return {
        name: s.name.trim(),
        url,
        groupTitle: categoryMap.get(s.category_id) ?? null,
        tvgId: s.epg_channel_id ?? null,
        tvgLogo: s.stream_icon || null,
        http,
        mediaFormat: detectMediaFormat(url),
        containerExtension: normalizeContainerExtension(
          isUsableDirectSource(directSource) ? undefined : 'm3u8',
        ) || 'm3u8',
        directSource: isUsableDirectSource(directSource) ? directSource : '',
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
      const ext = normalizeContainerExtension(s.container_extension);
      const directSource = (s.direct_source ?? '').trim();
      const http = extractHttpHints(s);
      const url = buildHonestStreamUrl({
        server: credentials.server,
        type: 'movie',
        username: credentials.username,
        password: credentials.password,
        streamId: s.stream_id,
        containerExtension: ext,
        directSource,
      });
      return {
        name: s.name.trim(),
        url,
        groupTitle: categoryMap.get(s.category_id) ?? null,
        tvgId: null,
        tvgLogo: s.stream_icon || null,
        http,
        mediaFormat: detectMediaFormat(url),
        containerExtension: ext,
        directSource: isUsableDirectSource(directSource) ? directSource : '',
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
    const url = buildHonestStreamUrl({
      server: credentials.server,
      type: 'series',
      username: credentials.username,
      password: credentials.password,
      streamId: series.series_id,
      containerExtension: 'm3u8',
    });
    entries.push({
      name: series.name,
      url,
      groupTitle,
      tvgId: null,
      tvgLogo: series.cover || null,
      http: null,
      mediaFormat: detectMediaFormat(url),
      containerExtension: 'm3u8',
      directSource: '',
    });
  }

  return entries;
}
