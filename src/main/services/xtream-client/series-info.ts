import { buildUrl, fetchJson } from './http.js';
import {
  DEFAULT_TIMEOUT_MS,
  type XtreamCredentials,
  type XtreamSeriesEpisode,
  type XtreamSeriesInfo,
} from './types.js';
import { normalizeContainerExtension } from './urls.js';

/**
 * Lazy episode + info fetch. Called when opening a series, not during ingest.
 */
export async function fetchXtreamSeriesInfo(
  credentials: XtreamCredentials,
  seriesId: number,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<XtreamSeriesInfo> {
  const data = await fetchJson<Record<string, unknown>>(
    buildUrl(credentials.server, {
      username: credentials.username,
      password: credentials.password,
      action: 'get_series_info',
      series_id: String(seriesId),
    }),
    timeoutMs,
  );

  const info = (data.info && typeof data.info === 'object' ? data.info : {}) as Record<string, unknown>;
  const backdrop = info.backdrop_path;
  const backdropUrl = Array.isArray(backdrop)
    ? String(backdrop[0] ?? '') || null
    : typeof backdrop === 'string' && backdrop.length > 0
      ? backdrop
      : null;

  const episodes: XtreamSeriesEpisode[] = [];
  const rawEpisodes = data.episodes;
  if (rawEpisodes && typeof rawEpisodes === 'object' && !Array.isArray(rawEpisodes)) {
    for (const [seasonKey, list] of Object.entries(rawEpisodes as Record<string, unknown>)) {
      const season = Number(seasonKey);
      if (!Number.isFinite(season) || !Array.isArray(list)) continue;
      for (const item of list) {
        if (!item || typeof item !== 'object') continue;
        const ep = item as Record<string, unknown>;
        const streamId = Number(ep.id);
        if (!Number.isFinite(streamId) || streamId <= 0) continue;
        const epInfo = (ep.info && typeof ep.info === 'object' ? ep.info : {}) as Record<string, unknown>;
        episodes.push({
          season,
          episode: Number(ep.episode_num ?? ep.episode ?? 0) || 0,
          streamId,
          name: String(ep.title ?? ep.name ?? `Episode ${ep.episode_num ?? ''}`).trim() || `S${season}E${ep.episode_num ?? ''}`,
          cover: typeof epInfo.movie_image === 'string' ? epInfo.movie_image : null,
          extension: normalizeContainerExtension(String(ep.container_extension ?? '')),
        });
      }
    }
  }

  return {
    plot: typeof info.plot === 'string' && info.plot.trim() ? info.plot.trim() : null,
    genre: typeof info.genre === 'string' && info.genre.trim() ? info.genre.trim() : null,
    backdropUrl,
    cover: typeof info.cover === 'string' && info.cover ? info.cover : null,
    episodes,
  };
}

export async function fetchXtreamShortEpg(
  credentials: XtreamCredentials,
  streamId: number,
  limit = 4,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  return fetchJson<unknown>(
    buildUrl(credentials.server, {
      username: credentials.username,
      password: credentials.password,
      action: 'get_short_epg',
      stream_id: String(streamId),
      limit: String(limit),
    }),
    timeoutMs,
  );
}
