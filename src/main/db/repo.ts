import type { SqlJsCompatDb } from './sqljs-adapter.js';

const BATCH_SIZE = 1000;

type LiveChannelRow = {
  name: string;
  url: string;
  groupTitle?: string | null;
  tvgId?: string | null;
  tvgLogo?: string | null;
  streamType?: string;
  xtreamId?: number | null;
  addedAt: number;
  /**
   * Per-stream HTTP request hints (User-Agent / Referer / Cookie / custom).
   * Empty object `{}` means "no overrides" — stored as JSON.
   */
  httpHeaders?: Record<string, string>;
  /**
   * Detected media container/format. Drives engine selection in the renderer.
   */
  mediaFormat?: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
};

type VodMovieRow = {
  name: string;
  url: string;
  groupTitle?: string | null;
  cover?: string | null;
  streamType?: string;
  xtreamId?: number | null;
  year?: number | null;
  addedAt: number;
  httpHeaders?: Record<string, string>;
  mediaFormat?: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
};

type SeriesRow = {
  name: string;
  url?: string | null;
  groupTitle?: string | null;
  cover?: string | null;
  streamType?: string;
  xtreamId?: number | null;
  year?: number | null;
  addedAt: number;
  httpHeaders?: Record<string, string>;
  mediaFormat?: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
};

/**
 * Inserts rows in batches of 1,000 with a transaction per chunk.
 * Uses ON CONFLICT(url) DO UPDATE for upsert behavior (REQ-CATALOG-4).
 *
 * Now also writes `http_headers` (JSON) and `media_format` (enum) so the
 * stream proxy can later inject the right headers and pick the right engine
 * (hls.js vs native <video>) for each catalog row.
 */
export function bulkInsertLiveChannels(db: SqlJsCompatDb, rows: LiveChannelRow[]): void {
  if (rows.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO live_channels (xtream_id, name, url, group_title, tvg_id, tvg_logo, stream_type, http_headers, media_format, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @tvgId, @tvgLogo, @streamType, @httpHeaders, @mediaFormat, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      tvg_id = excluded.tvg_id,
      tvg_logo = excluded.tvg_logo,
      stream_type = excluded.stream_type,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format
  `);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const transaction = db.transaction((items: LiveChannelRow[]) => {
      for (const row of items) {
        stmt.run({
          xtreamId: row.xtreamId ?? null,
          name: row.name,
          url: row.url,
          groupTitle: row.groupTitle ?? null,
          tvgId: row.tvgId ?? null,
          tvgLogo: row.tvgLogo ?? null,
          streamType: row.streamType ?? 'live',
          httpHeaders: JSON.stringify(row.httpHeaders ?? {}),
          mediaFormat: row.mediaFormat ?? 'unknown',
          addedAt: row.addedAt,
        });
      }
    });
    transaction(chunk);
  }
}

export function bulkInsertVodMovies(db: SqlJsCompatDb, rows: VodMovieRow[]): void {
  if (rows.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO vod_movies (xtream_id, name, url, group_title, cover, stream_type, year, http_headers, media_format, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @httpHeaders, @mediaFormat, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      stream_type = excluded.stream_type,
      year = excluded.year,
      http_headers = excluded.http_headers,
      media_format = excluded.media_format
  `);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const transaction = db.transaction((items: VodMovieRow[]) => {
      for (const row of items) {
        stmt.run({
          xtreamId: row.xtreamId ?? null,
          name: row.name,
          url: row.url,
          groupTitle: row.groupTitle ?? null,
          cover: row.cover ?? null,
          streamType: row.streamType ?? 'movie',
          year: row.year ?? null,
          httpHeaders: JSON.stringify(row.httpHeaders ?? {}),
          mediaFormat: row.mediaFormat ?? 'unknown',
          addedAt: row.addedAt,
        });
      }
    });
    transaction(chunk);
  }
}

export function bulkInsertSeries(db: SqlJsCompatDb, rows: SeriesRow[]): void {
  if (rows.length === 0) return;

  // The series table has no UNIQUE constraint (name is not unique across
  // series with the same title), so we INSERT plain. Caller is responsible
  // for deduplication upstream (e.g. ingest worker batches by series_id).
  const stmt = db.prepare(`
    INSERT INTO series (xtream_id, name, url, group_title, cover, stream_type, year, http_headers, media_format, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @httpHeaders, @mediaFormat, @addedAt)
  `);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const transaction = db.transaction((items: SeriesRow[]) => {
      for (const row of items) {
        stmt.run({
          xtreamId: row.xtreamId ?? null,
          name: row.name,
          url: row.url ?? null,
          groupTitle: row.groupTitle ?? null,
          cover: row.cover ?? null,
          streamType: row.streamType ?? 'series',
          year: row.year ?? null,
          httpHeaders: JSON.stringify(row.httpHeaders ?? {}),
          mediaFormat: row.mediaFormat ?? 'unknown',
          addedAt: row.addedAt,
        });
      }
    });
    transaction(chunk);
  }
}