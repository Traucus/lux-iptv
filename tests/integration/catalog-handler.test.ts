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
      expect(cnn.containerExtension).toBe('');
      expect(cnn.directSource).toBe('');
    });

    it('maps containerExtension and directSource from movie rows', async () => {
      db.prepare(
        `INSERT INTO vod_movies (name, url, group_title, stream_type, year, http_headers, media_format, container_extension, direct_source, added_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'Hevc Film',
        'https://x/hevc.mkv',
        'Movies',
        'movie',
        2024,
        '{}',
        'unknown',
        'mkv',
        'https://cdn.example.com/hevc.mkv',
        1000,
      );

      const { ipc, captured } = captureIpcMain();
      registerCatalogHandlers(ipc, { db });
      const list = captured.find((c) => c.channel === 'catalog:list')!.fn;

      const result = await list({}, { type: 'movie', limit: 10, offset: 0 });
      const data = (result as { data: { items: Array<Record<string, unknown>> } }).data;
      expect(data.items[0].containerExtension).toBe('mkv');
      expect(data.items[0].directSource).toBe('https://cdn.example.com/hevc.mkv');
      expect(data.items[0].mediaFormat).not.toBe('mp4');
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
});
