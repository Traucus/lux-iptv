import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import type { IpcMain } from 'electron';
import { registerCatalogHandlers } from '../../src/main/ipc/handlers/catalog';

interface CapturedHandler {
  channel: string;
  fn: (event: unknown, input: unknown) => Promise<unknown>;
}

function captureIpcMain(): { ipc: IpcMain; captured: CapturedHandler[] } {
  const captured: CapturedHandler[] = [];
  const ipc = {
    handle: (channel: string, fn: (event: unknown, input: unknown) => Promise<unknown>) => {
      captured.push({ channel, fn });
    },
  } as unknown as IpcMain;
  return { ipc, captured };
}

describe('catalog handler getById', () => {
  let db: SqlJsCompatDb;

  beforeAll(async () => {
    await initSqlJsModule();
  });

  beforeEach(() => {
    db = createSqlJsDb(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
      CREATE TABLE live_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        group_title TEXT,
        tvg_id TEXT,
        tvg_logo TEXT,
        stream_icon TEXT,
        stream_type TEXT NOT NULL DEFAULT 'live',
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        container_extension TEXT NOT NULL DEFAULT '',
        direct_source TEXT NOT NULL DEFAULT '',
        added_at INTEGER NOT NULL
      );
      CREATE TABLE vod_movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        group_title TEXT,
        cover TEXT,
        stream_type TEXT NOT NULL DEFAULT 'movie',
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        container_extension TEXT NOT NULL DEFAULT '',
        direct_source TEXT NOT NULL DEFAULT '',
        year INTEGER,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        url TEXT UNIQUE,
        group_title TEXT,
        cover TEXT,
        stream_type TEXT NOT NULL DEFAULT 'series',
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        container_extension TEXT NOT NULL DEFAULT '',
        direct_source TEXT NOT NULL DEFAULT '',
        year INTEGER,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        season INTEGER NOT NULL,
        episode INTEGER NOT NULL,
        cover TEXT,
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        container_extension TEXT NOT NULL DEFAULT '',
        direct_source TEXT NOT NULL DEFAULT '',
        added_at INTEGER NOT NULL,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('returns NOT_FOUND for missing id', async () => {
    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const getById = captured.find((c) => c.channel === 'catalog:getById')!.fn;

    const result = await getById({}, { type: 'live', id: 999 });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND' }),
      }),
    );
  });

  it('returns a single live item with httpHeaders + mediaFormat', async () => {
    db.prepare(
      `INSERT INTO live_channels (name, url, group_title, stream_type, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run('CNN', 'https://x/cnn.m3u8', 'News', 'live', JSON.stringify({ Referer: 'https://r' }), 'hls', 1000);

    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const getById = captured.find((c) => c.channel === 'catalog:getById')!.fn;

    const result = await getById({}, { type: 'live', id: 1 });
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.name).toBe('CNN');
    expect(data.contentType).toBe('live');
    expect(data.mediaFormat).toBe('hls');
    expect(data.httpHeaders).toEqual({ Referer: 'https://r' });
  });

  it('catalog:grouped collapses episode rows into one card per show', async () => {
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, added_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('7 Seeds - S01E01 - 7 S', 'https://x/s/1', 'Anime', 'series', 1000);
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, added_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('7 Seeds - S01E02 - 7 S', 'https://x/s/2', 'Anime', 'series', 1000);
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, added_at) VALUES (?, ?, ?, ?, ?)`,
    ).run('7 Seeds - S01E03 - 7 S', 'https://x/s/3', 'Anime', 'series', 1000);

    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const grouped = captured.find((c) => c.channel === 'catalog:grouped')!.fn;
    const result = await grouped({}, { type: 'series', limit: 20 });
    const data = (result as { data: { groups: Array<{ title: string; count: number; items: Array<{ name: string }> }> } }).data;
    const anime = data.groups.find((g) => g.title === 'Anime');
    expect(anime?.count).toBe(1);
    expect(anime?.items).toHaveLength(1);
    expect(anime?.items[0].name).toBe('7 Seeds');
  });

  it('catalog:grouped includes series with empty group_title as Ungrouped', async () => {
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Orphan Show', 'https://x/series/1.mp4', null, 'series', 1000);

    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const grouped = captured.find((c) => c.channel === 'catalog:grouped')!.fn;
    const result = await grouped({}, { type: 'series', limit: 20 });
    const data = (result as { data: { groups: Array<{ title: string; count: number; items: Array<{ name: string }> }> } }).data;
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].title).toBe('Ungrouped');
    expect(data.groups[0].count).toBe(1);
    expect(data.groups[0].items[0].name).toBe('Orphan Show');
  });

  it('returns an episode CatalogItem for type=episode', async () => {
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, year, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('Breaking Bad', 'https://x/bb', 'Drama', 'series', 2008, 1000);
    db.prepare(
      `INSERT INTO episodes (series_id, name, url, season, episode, cover, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, 'Pilot', 'https://x/bb-s01e01', 1, 1, 'https://x/pilot.jpg', 1000);

    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const getById = captured.find((c) => c.channel === 'catalog:getById')!.fn;
    const result = await getById({}, { type: 'episode', id: 1 });
    const data = (result as { data: { id: number; name: string; contentType: string; cover: string | null } }).data;
    expect(data.contentType).toBe('episode');
    expect(data.name).toBe('Pilot');
    expect(data.cover).toBe('https://x/pilot.jpg');
  });

  it('returns SeriesDetail with seasons and episodes for type=series', async () => {
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, year, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('Breaking Bad', 'https://x/bb', 'Drama', 'series', 2008, 1000);
    db.prepare(
      `INSERT INTO episodes (series_id, name, url, season, episode, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(1, 'Pilot', 'https://x/bb-s01e01', 1, 1, 1000);
    db.prepare(
      `INSERT INTO episodes (series_id, name, url, season, episode, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(1, "Cat's in the Bag", 'https://x/bb-s01e02', 1, 2, 1000);
    db.prepare(
      `INSERT INTO episodes (series_id, name, url, season, episode, added_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(1, 'No Mas', 'https://x/bb-s02e01', 2, 1, 1000);

    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const getById = captured.find((c) => c.channel === 'catalog:getById')!.fn;

    const result = await getById({}, { type: 'series', id: 1 });
    const data = (result as { data: { series: { name: string; contentType: string }; seasons: Array<{ seasonNumber: number; episodes: Array<{ name: string }> }> } }).data;
    expect(data.series.name).toBe('Breaking Bad');
    expect(data.series.contentType).toBe('series');
    expect(data.seasons).toHaveLength(2);
    expect(data.seasons[0].seasonNumber).toBe(1);
    expect(data.seasons[0].episodes).toHaveLength(2);
    expect(data.seasons[0].episodes[0].name).toBe('Pilot');
    expect(data.seasons[1].seasonNumber).toBe(2);
    expect(data.seasons[1].episodes).toHaveLength(1);
  });

  it('hydrates episodes from get_series_info when the table is empty', async () => {
    db.prepare(
      `INSERT INTO series (name, url, group_title, stream_type, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('24', 'http://xtream.example/series/user/pass/99.m3u8', 'Action', 'series', 1000);

    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, {
      db,
      loadXtreamCredentials: () => ({
        server: 'http://xtream.example',
        username: 'user',
        password: 'pass',
      }),
      fetchSeriesInfo: async () => ({
        plot: 'Jack Bauer has a long day.',
        genre: 'Action, Drama',
        backdropUrl: 'http://img/24.jpg',
        cover: null,
        episodes: [
          { season: 1, episode: 1, streamId: 501, name: '12:00 AM', cover: null, extension: 'mp4' },
          { season: 1, episode: 2, streamId: 502, name: '1:00 AM', cover: null, extension: 'mp4' },
        ],
      }),
    });
    const getById = captured.find((c) => c.channel === 'catalog:getById')!.fn;
    const result = await getById({}, { type: 'series', id: 1 });
    const data = (result as { data: { plot: string; seasons: Array<{ episodes: unknown[] }> } }).data;
    expect(data.plot).toBe('Jack Bauer has a long day.');
    expect(data.seasons).toHaveLength(1);
    expect(data.seasons[0].episodes).toHaveLength(2);
  });
});
