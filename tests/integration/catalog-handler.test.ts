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

describe('catalog handler', () => {
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
        added_at INTEGER NOT NULL,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('registers both channels', () => {
    const { ipc, captured } = captureIpcMain();
    registerCatalogHandlers(ipc, { db });
    const channels = captured.map((c) => c.channel);
    expect(channels).toContain('catalog:list');
    expect(channels).toContain('catalog:getById');
  });

  describe('catalog:list', () => {
    it('returns paginated live items with httpHeaders + mediaFormat', async () => {
      db.prepare(
        `INSERT INTO live_channels (name, url, group_title, stream_type, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('CNN', 'https://x/cnn.m3u8', 'News', 'live', JSON.stringify({ 'User-Agent': 'X' }), 'hls', 1000);
      db.prepare(
        `INSERT INTO live_channels (name, url, group_title, stream_type, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run('BBC', 'https://x/bbc', 'News', 'live', '{}', 'unknown', 1000);

      const { ipc, captured } = captureIpcMain();
      registerCatalogHandlers(ipc, { db });
      const list = captured.find((c) => c.channel === 'catalog:list')!.fn;

      const result = await list({}, { type: 'live', limit: 10, offset: 0 });
      const data = (result as { data: { items: Array<Record<string, unknown>>; total: number } }).data;

      expect(data.total).toBe(2);
      expect(data.items).toHaveLength(2);
      const cnn = data.items.find((i) => i.name === 'CNN')!;
      expect(cnn.contentType).toBe('live');
      expect(cnn.mediaFormat).toBe('hls');
      expect(cnn.httpHeaders).toEqual({ 'User-Agent': 'X' });
    });

    it('returns empty httpHeaders when DB has the default "{}"', async () => {
      db.prepare(
        `INSERT INTO live_channels (name, url, group_title, stream_type, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('X', 'https://x/y', 'G', 'live', 1000);

      const { ipc, captured } = captureIpcMain();
      registerCatalogHandlers(ipc, { db });
      const list = captured.find((c) => c.channel === 'catalog:list')!.fn;

      const result = await list({}, { type: 'live', limit: 10, offset: 0 });
      const data = (result as { data: { items: Array<Record<string, unknown>> } }).data;
      expect(data.items[0].httpHeaders).toEqual({});
      expect(data.items[0].mediaFormat).toBe('unknown');
    });

    it('returns movies with contentType=movie and year', async () => {
      db.prepare(
        `INSERT INTO vod_movies (name, url, group_title, stream_type, year, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run('Avatar', 'https://x/avatar.mp4', 'Movies', 'movie', 2009, '{}', 'mp4', 1000);

      const { ipc, captured } = captureIpcMain();
      registerCatalogHandlers(ipc, { db });
      const list = captured.find((c) => c.channel === 'catalog:list')!.fn;

      const result = await list({}, { type: 'movie', limit: 10, offset: 0 });
      const data = (result as { data: { items: Array<Record<string, unknown>> } }).data;
      expect(data.items[0].contentType).toBe('movie');
      expect(data.items[0].year).toBe(2009);
      expect(data.items[0].mediaFormat).toBe('mp4');
    });

    it('returns INVALID_INPUT for malformed input', async () => {
      const { ipc, captured } = captureIpcMain();
      registerCatalogHandlers(ipc, { db });
      const list = captured.find((c) => c.channel === 'catalog:list')!.fn;

      const result = await list({}, { type: 'invalid' });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('searches by name with LIKE', async () => {
      db.prepare(`INSERT INTO live_channels (name, url, stream_type, added_at) VALUES (?, ?, ?, ?)`).run(
        'CNN International', 'https://x/cnn-int', 'live', 1000,
      );
      db.prepare(`INSERT INTO live_channels (name, url, stream_type, added_at) VALUES (?, ?, ?, ?)`).run(
        'BBC', 'https://x/bbc', 'live', 1000,
      );

      const { ipc, captured } = captureIpcMain();
      registerCatalogHandlers(ipc, { db });
      const list = captured.find((c) => c.channel === 'catalog:list')!.fn;

      const result = await list({}, { type: 'live', limit: 10, offset: 0, search: 'cnn' });
      const data = (result as { data: { items: Array<Record<string, unknown>>; total: number } }).data;
      expect(data.total).toBe(1);
      expect(data.items[0].name).toBe('CNN International');
    });
  });

  describe('catalog:getById', () => {
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
      const data = (result as { data: { series: { name: string }; seasons: Array<{ seasonNumber: number; episodes: Array<{ name: string }> }> } }).data;
      expect(data.series.name).toBe('Breaking Bad');
      expect(data.series.contentType).toBe('series');
      expect(data.seasons).toHaveLength(2);
      expect(data.seasons[0].seasonNumber).toBe(1);
      expect(data.seasons[0].episodes).toHaveLength(2);
      expect(data.seasons[0].episodes[0].name).toBe('Pilot');
      expect(data.seasons[1].seasonNumber).toBe(2);
      expect(data.seasons[1].episodes).toHaveLength(1);
    });
  });
});