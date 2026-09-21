import type { SqlJsCompatDb } from '../../../db/sqljs-adapter.js';
import { seriesShowTitle } from '../../../services/classifier.js';
import { detectMediaFormat } from '../../../services/m3u-client.js';
import {
  fetchXtreamSeriesInfo,
  parseXtreamSeriesId,
  xtreamEpisodeUrl,
  type XtreamSeriesInfo,
} from '../../../services/xtream-client.js';
import type { CatalogHandlerDeps, EpisodeRow } from './types.js';

export function uniqueSeriesRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];
  for (const row of rows) {
    const show = seriesShowTitle(String(row.name ?? ''));
    const key = `${show.toLowerCase()}\0${String(row.group_title ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...row, name: show });
  }
  return unique;
}

export function loadSeriesEpisodes(db: SqlJsCompatDb, seriesId: number): EpisodeRow[] {
  return db
    .prepare(
      `SELECT id, series_id, name, url, season, episode, cover, added_at
       FROM episodes
       WHERE series_id = ?
       ORDER BY season, episode`,
    )
    .all(seriesId) as EpisodeRow[];
}

export async function hydrateSeriesEpisodes(
  deps: CatalogHandlerDeps,
  sqliteSeriesId: number,
  row: Record<string, unknown>,
): Promise<XtreamSeriesInfo | null> {
  const creds = deps.loadXtreamCredentials?.() ?? null;
  if (!creds) return null;
  const xtreamId = Number(row.xtream_id) || parseXtreamSeriesId(String(row.url ?? ''));
  if (!xtreamId) return null;
  const fetchInfo = deps.fetchSeriesInfo ?? fetchXtreamSeriesInfo;
  let info: XtreamSeriesInfo;
  try {
    info = await fetchInfo(creds, xtreamId);
  } catch {
    return null;
  }
  const now = Date.now();
  const insert = deps.db.prepare(
    `INSERT INTO episodes (series_id, name, url, season, episode, cover, http_headers, media_format, added_at)
     VALUES (?, ?, ?, ?, ?, ?, '{}', ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       name = excluded.name,
       season = excluded.season,
       episode = excluded.episode,
       cover = excluded.cover`,
  );
  for (const ep of info.episodes) {
    const url = xtreamEpisodeUrl(creds, ep.streamId, ep.extension);
    const format = detectMediaFormat(url);
    insert.run(sqliteSeriesId, ep.name, url, ep.season, ep.episode, ep.cover, format, now);
  }
  return info;
}
