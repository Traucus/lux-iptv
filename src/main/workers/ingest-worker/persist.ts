import { classify } from '../../services/classifier.js';
import type { M3UEntry, M3UEntryHttpHints } from '../../services/m3u-client.js';
import type { SqlJsCompatDb } from '../../db/sqljs-adapter.js';
import { isIngestAborted } from './abort.js';
import { emitProgress } from './messages.js';
import type { IngestCounts } from './types.js';

/**
 * Maps M3U `HttpHints` (`userAgent/referer/cookie/headers`) into the canonical
 * wire-format header map (`User-Agent/Referer/Cookie/<custom>`). Returns `{}`
 * when no hints are present so the JSON column stays compact.
 */
function m3uHttpToWire(http: M3UEntryHttpHints | null): Record<string, string> {
  if (!http) return {};
  const out: Record<string, string> = { ...(http.headers ?? {}) };
  if (http.userAgent) out['User-Agent'] = http.userAgent;
  if (http.referer) out['Referer'] = http.referer;
  if (http.cookie) out['Cookie'] = http.cookie;
  return out;
}

/**
 * Processes M3U entries: classifies and persists to SQLite.
 * Exported for testing.
 */
export function processM3UEntries(db: SqlJsCompatDb, entries: M3UEntry[]): IngestCounts {
  const counts: IngestCounts = { live: 0, movies: 0, series: 0, radio: 0, total: 0 };
  const now = Date.now();

  // Prepare statements
  const insertLive = db.prepare(`
    INSERT INTO live_channels (xtream_id, name, url, group_title, tvg_id, tvg_logo, stream_type, http_headers, media_format, container_extension, direct_source, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @tvgId, @tvgLogo, @streamType, @httpHeaders, @mediaFormat, @containerExtension, @directSource, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      tvg_id = excluded.tvg_id,
      tvg_logo = excluded.tvg_logo,
      stream_type = excluded.stream_type,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format,
      container_extension = excluded.container_extension,
      direct_source = excluded.direct_source
  `);

  const insertMovie = db.prepare(`
    INSERT INTO vod_movies (xtream_id, name, url, group_title, cover, stream_type, year, http_headers, media_format, container_extension, direct_source, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @httpHeaders, @mediaFormat, @containerExtension, @directSource, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      stream_type = excluded.stream_type,
      year = excluded.year,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format,
      container_extension = excluded.container_extension,
      direct_source = excluded.direct_source
  `);

  const insertSeries = db.prepare(`
    INSERT INTO series (xtream_id, name, url, group_title, cover, stream_type, year, http_headers, media_format, container_extension, direct_source, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @httpHeaders, @mediaFormat, @containerExtension, @directSource, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format,
      container_extension = excluded.container_extension,
      direct_source = excluded.direct_source
  `);

  for (const entry of entries) {
    // Defensive: skip entries with no name — Xtream APIs sometimes return
    // null/empty names which would violate NOT NULL DB constraints.
    if (!entry.name || entry.name.trim().length === 0) continue;
    if (!entry.url || entry.url.trim().length === 0) continue;

    const contentType = classify({
      url: entry.url,
      name: entry.name,
      groupTitle: entry.groupTitle,
      tvgId: entry.tvgId,
    });

    // Flatten M3U HttpHints shape (`{ userAgent, referer, cookie, headers }`)
    // into the canonical header-name → value map the DB column expects.
    const httpHeaders = m3uHttpToWire(entry.http);
    const mediaFormat = entry.mediaFormat ?? 'unknown';
    const containerExtension = entry.containerExtension ?? '';
    const directSource = entry.directSource ?? '';

    switch (contentType) {
      case 'live':
        insertLive.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          tvgId: entry.tvgId,
          tvgLogo: entry.tvgLogo,
          streamType: 'live',
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
          containerExtension,
          directSource,
          addedAt: now,
        });
        counts.live++;
        break;
      case 'movie':
        insertMovie.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          cover: entry.tvgLogo,
          streamType: 'movie',
          year: null,
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
          containerExtension,
          directSource,
          addedAt: now,
        });
        counts.movies++;
        break;
      case 'series':
        // For series, we insert the series entry (episodes would need separate handling)
        insertSeries.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          cover: entry.tvgLogo,
          streamType: 'series',
          year: null,
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
          containerExtension,
          directSource,
          addedAt: now,
        });
        counts.series++;
        break;
      case 'radio':
        insertLive.run({
          xtreamId: null,
          name: entry.name,
          url: entry.url,
          groupTitle: entry.groupTitle,
          tvgId: entry.tvgId,
          tvgLogo: entry.tvgLogo,
          streamType: 'radio',
          httpHeaders: JSON.stringify(httpHeaders),
          mediaFormat,
          containerExtension,
          directSource,
          addedAt: now,
        });
        counts.radio++;
        break;
    }
    counts.total++;
  }

  return counts;
}

export function persistBatches(db: SqlJsCompatDb, entries: M3UEntry[], totalCounts: IngestCounts): void {
  const batchSize = 100;
  for (let i = 0; i < entries.length; i += batchSize) {
    if (isIngestAborted()) break;
    const batchCounts = processM3UEntries(db, entries.slice(i, i + batchSize));
    totalCounts.live += batchCounts.live;
    totalCounts.movies += batchCounts.movies;
    totalCounts.series += batchCounts.series;
    totalCounts.radio += batchCounts.radio;
    totalCounts.total += batchCounts.total;
    emitProgress('PERSIST', totalCounts);
  }
}
