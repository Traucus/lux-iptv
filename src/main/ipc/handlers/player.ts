import type { IpcMain } from 'electron';
import type Database from 'better-sqlite3';
import type { Episode, IpcResult } from '../../../shared/types/ipc';
import type { MediaFormat } from '../../../shared/types/player';
import {
  PlayerGetSourceInputSchema,
  PlayerReportErrorInputSchema,
  PlayerReportProgressInputSchema,
  PlayerGetNextEpisodeInputSchema,
  PlayerGetProxiedUrlInputSchema,
} from '../../../shared/schemas/player';

/**
 * Player IPC handlers.
 *
 * The five channels in this file split into three flavors:
 *  - **Resolvers** (`getSource`, `getProxiedUrl`, `getNextEpisode`): read
 *    catalog/episode state and return a payload. The renderer's React Query
 *    cache keys off the resolved payload, so caching is implicitly safe.
 *  - **Telemetry sinks** (`reportError`, `reportProgress`): fire-and-forget
 *    from the renderer. We log to main and intentionally do NOT persist in
 *    this slice — VOD resume lives in renderer-side IndexedDB.
 *
 * None of the resolvers mutates DB state.
 *
 * @param deps.db - The catalog SQLite handle.
 * @param deps.getProxiedBaseUrl - Resolves a (type, id) tuple to a fully-qualified
 *   proxy URL. Wired in main/index.ts once the G5 StreamProxyService is up.
 *   Until then, handlers that need a proxied URL return `notImplemented`.
 */
export interface PlayerHandlerDeps {
  db: Database.Database;
  getProxiedBaseUrl?: () => string | undefined;
}

function invalidInput(details: unknown): IpcResult<never> {
  return { error: { code: 'INVALID_INPUT', message: 'Invalid input', details } };
}

function notFound(message: string): IpcResult<never> {
  return { error: { code: 'NOT_FOUND', message } };
}

function notImplemented(message = 'not yet implemented'): IpcResult<never> {
  return { error: { code: 'INTERNAL', message } };
}

function tableForType(type: 'live' | 'movie' | 'series'): string {
  switch (type) {
    case 'live':
      return 'live_channels';
    case 'movie':
      return 'vod_movies';
    case 'series':
      return 'series';
  }
}

interface CatalogRow {
  id: number;
  name: string;
  url: string;
  http_headers: string | null;
  media_format: string | null;
}

function loadRowByContentId(
  db: Database.Database,
  type: 'live' | 'movie' | 'series',
  id: number,
): CatalogRow | null {
  const table = tableForType(type);
  // Episode rows live in a separate table; handled below for type='episode'.
  const row = db
    .prepare(`SELECT id, name, url, http_headers, media_format FROM ${table} WHERE id = ?`)
    .get(id) as CatalogRow | undefined;
  return row ?? null;
}

function loadEpisodeRow(db: Database.Database, id: number): CatalogRow | null {
  const row = db
    .prepare(
      `SELECT id, name, url, http_headers, media_format FROM episodes WHERE id = ?`,
    )
    .get(id) as CatalogRow | undefined;
  return row ?? null;
}

function safeParseHeaders(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function resolveMediaFormat(raw: string | null): MediaFormat {
  const v = (raw ?? 'unknown') as MediaFormat;
  const allowed: MediaFormat[] = ['hls', 'mp4', 'dash', 'ts', 'unknown'];
  return allowed.includes(v) ? v : 'unknown';
}

export function registerPlayerHandlers(ipcMain: IpcMain, deps: PlayerHandlerDeps): void {
  // ─── player:getSource ──────────────────────────────────────────────────
  // Resolves a catalog row to the payload the renderer needs to start
  // playback. Returns the original URL + headers; the renderer hands the URL
  // to hls.js / <video> directly until the G5 proxy is wired up.
  ipcMain.handle('player:getSource', async (_event, input: unknown) => {
    const result = PlayerGetSourceInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const { type, id } = result.data;
    const row = type === 'episode' ? loadEpisodeRow(deps.db, id) : loadRowByContentId(deps.db, type, id);
    if (!row) {
      return notFound(`${type} id ${id} not found`);
    }
    return {
      data: {
        type,
        id,
        url: row.url,
        httpHeaders: safeParseHeaders(row.http_headers),
        mediaFormat: resolveMediaFormat(row.media_format),
      },
    };
  });

  // ─── player:getProxiedUrl ──────────────────────────────────────────────
  // Returns the absolute URL on the in-process stream proxy. The proxy
  // service is wired up in G5 — for this slice the channel is registered
  // but returns `notImplemented` so the renderer surfaces a clear error
  // rather than hanging on a 404.
  ipcMain.handle('player:getProxiedUrl', async (_event, input: unknown) => {
    const result = PlayerGetProxiedUrlInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const baseUrl = deps.getProxiedBaseUrl?.();
    if (!baseUrl) {
      return notImplemented('stream proxy not yet available (G5)');
    }
    const { type, id } = result.data;
    return { data: { url: `${baseUrl}/proxy/${type}/${id}` } };
  });

  // ─── player:reportError ────────────────────────────────────────────────
  // Fire-and-forget telemetry. We log to stdout (which the main process
  // captures). No persistence in this slice.
  ipcMain.handle('player:reportError', async (_event, input: unknown) => {
    const result = PlayerReportErrorInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const { code, message, ctx } = result.data;
    // eslint-disable-next-line no-console
    console.warn(`[player:reportError] code=${code} message=${message}`, ctx ?? {});
    return { data: undefined };
  });

  // ─── player:reportProgress ─────────────────────────────────────────────
  // Currently logging only; resume persistence lives in renderer-side
  // IndexedDB. We accept the channel so the preload has a stable surface.
  ipcMain.handle('player:reportProgress', async (_event, input: unknown) => {
    const result = PlayerReportProgressInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const { type, id, position, duration } = result.data;
    // eslint-disable-next-line no-console
    console.debug(
      `[player:reportProgress] type=${type} id=${id} pos=${position.toFixed(1)}/${duration.toFixed(1)}`,
    );
    return { data: undefined };
  });

  // ─── player:getNextEpisode ─────────────────────────────────────────────
  // Returns the next episode in series order: prefer the next episode of
  // the same season; if at the end of the season, jump to the first episode
  // of the next season. Returns null at the end of the series.
  ipcMain.handle('player:getNextEpisode', async (_event, input: unknown) => {
    const result = PlayerGetNextEpisodeInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const { episodeId } = result.data;
    const current = deps.db
      .prepare(
        `SELECT id, series_id, name, url, season, episode, cover, added_at
         FROM episodes
         WHERE id = ?`,
      )
      .get(episodeId) as
      | { id: number; series_id: number; name: string; url: string; season: number; episode: number; cover: string | null; added_at: number }
      | undefined;
    if (!current) {
      return notFound(`episode ${episodeId} not found`);
    }
    // Try same-season next episode first.
    const sameSeasonNext = deps.db
      .prepare(
        `SELECT id, series_id, name, url, season, episode, cover, added_at
         FROM episodes
         WHERE series_id = ? AND season = ? AND episode > ?
         ORDER BY episode ASC
         LIMIT 1`,
      )
      .get(current.series_id, current.season, current.episode) as
      | { id: number; series_id: number; name: string; url: string; season: number; episode: number; cover: string | null; added_at: number }
      | undefined;
    if (sameSeasonNext) {
      return { data: toEpisode(sameSeasonNext) };
    }
    // Fall through to the first episode of the next season.
    const nextSeason = deps.db
      .prepare(
        `SELECT id, series_id, name, url, season, episode, cover, added_at
         FROM episodes
         WHERE series_id = ? AND season > ?
         ORDER BY season ASC, episode ASC
         LIMIT 1`,
      )
      .get(current.series_id, current.season) as
      | { id: number; series_id: number; name: string; url: string; season: number; episode: number; cover: string | null; added_at: number }
      | undefined;
    if (nextSeason) {
      return { data: toEpisode(nextSeason) };
    }
    return { data: null };
  });
}

function toEpisode(row: {
  id: number;
  series_id: number;
  name: string;
  url: string;
  season: number;
  episode: number;
  cover: string | null;
  added_at: number;
}): Episode {
  return {
    id: row.id,
    seriesId: row.series_id,
    name: row.name,
    url: row.url,
    season: row.season,
    episode: row.episode,
    cover: row.cover,
    addedAt: row.added_at,
  };
}
