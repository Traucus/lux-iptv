import type Database from 'better-sqlite3';

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
};

/**
 * Inserts rows in batches of 1,000 with a transaction per chunk.
 * Uses ON CONFLICT(url) DO UPDATE for upsert behavior (REQ-CATALOG-4).
 */
export function bulkInsertLiveChannels(db: Database.Database, rows: LiveChannelRow[]): void {
  if (rows.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO live_channels (xtream_id, name, url, group_title, tvg_id, tvg_logo, stream_type, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @tvgId, @tvgLogo, @streamType, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      tvg_id = excluded.tvg_id,
      tvg_logo = excluded.tvg_logo,
      stream_type = excluded.stream_type
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
          addedAt: row.addedAt,
        });
      }
    });
    transaction(chunk);
  }
}

export function bulkInsertVodMovies(db: Database.Database, rows: VodMovieRow[]): void {
  if (rows.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO vod_movies (xtream_id, name, url, group_title, cover, stream_type, year, added_at)
    VALUES (@xtreamId, @name, @url, @groupTitle, @cover, @streamType, @year, @addedAt)
    ON CONFLICT(url) DO UPDATE SET
      name = excluded.name,
      group_title = excluded.group_title,
      cover = excluded.cover,
      stream_type = excluded.stream_type,
      year = excluded.year
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
          addedAt: row.addedAt,
        });
      }
    });
    transaction(chunk);
  }
}
