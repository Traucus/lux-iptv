import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import type { IpcMain } from 'electron';
import { registerPlayerHandlers } from '../../src/main/ipc/handlers/player';

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
    on: (_channel: string, _fn: (...args: unknown[]) => void) => {
      // not used by player handler today
    },
  } as unknown as IpcMain;
  return { ipc, captured };
}

describe('player IPC channels (registration + behavior)', () => {
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
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        added_at INTEGER NOT NULL
      );
      CREATE TABLE vod_movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        added_at INTEGER NOT NULL
      );
      CREATE TABLE series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT UNIQUE,
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
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
        added_at INTEGER NOT NULL,
        FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('registers all 5 player channels', () => {
    const { ipc, captured } = captureIpcMain();
    registerPlayerHandlers(ipc, { db });
    const channels = captured.map((c) => c.channel);
    expect(channels).toEqual(
      expect.arrayContaining([
        'player:getSource',
        'player:reportError',
        'player:reportProgress',
        'player:getNextEpisode',
        'player:getProxiedUrl',
      ]),
    );
    expect(channels).toEqual(
      expect.arrayContaining([
        'player:getSource',
        'player:reportError',
        'player:reportProgress',
        'player:getNextEpisode',
        'player:getProxiedUrl',
        'player:play',
        'player:stop',
        'player:setPaused',
      ]),
    );
    expect(channels).toHaveLength(15);
  });

  describe('player:play', () => {
    it('loads the catalog origin URL in-process and does not require getProxiedUrl', async () => {
      db.prepare(
        `INSERT INTO vod_movies (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        'Hevc',
        'https://origin.example/movie.mkv',
        JSON.stringify({ Referer: 'https://panel.example' }),
        'unknown',
        1000,
      );

      const play = vi.fn().mockResolvedValue({ ok: true, engine: 'libmpv' });
      const stop = vi.fn().mockResolvedValue(undefined);
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db, libmpvEngine: { play, stop } as never });
      const fn = captured.find((c) => c.channel === 'player:play')!.fn;

      const result = await fn({}, { type: 'movie', id: 1 });
      expect(result).toEqual({ data: { engine: 'libmpv' } });
      expect(play).toHaveBeenCalledWith({
        url: 'https://origin.example/movie.mkv',
        httpHeaders: { Referer: 'https://panel.example' },
        profile: 'vod',
      });
      expect(play.mock.calls[0][0].url).not.toContain('127.0.0.1');
    });

    it('loads a live origin URL with item headers and live cache profile', async () => {
      db.prepare(
        `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        'CNN',
        'https://origin.example/live.m3u8',
        JSON.stringify({ 'User-Agent': 'Lux/1' }),
        'hls',
        1000,
      );

      const play = vi.fn().mockResolvedValue({ ok: true, engine: 'libmpv' });
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db, libmpvEngine: { play, stop: vi.fn() } as never });
      const fn = captured.find((c) => c.channel === 'player:play')!.fn;

      const result = await fn({}, { type: 'live', id: 1 });
      expect(result).toEqual({ data: { engine: 'libmpv' } });
      expect(play).toHaveBeenCalledWith({
        url: 'https://origin.example/live.ts',
        httpHeaders: { 'User-Agent': 'Lux/1' },
        profile: 'live',
      });
      expect(play.mock.calls[0][0].url).not.toContain('127.0.0.1');
    });

    it('loads an episode origin URL with item headers as VOD', async () => {
      db.prepare(`INSERT INTO series (name, url, added_at) VALUES (?, ?, ?)`).run('Show', 'https://origin.example/series', 1000);
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        1,
        'Pilot',
        'https://origin.example/ep101.mkv',
        1,
        1,
        1000,
        JSON.stringify({ Referer: 'https://panel.example' }),
        'unknown',
      );

      const play = vi.fn().mockResolvedValue({ ok: true, engine: 'libmpv' });
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db, libmpvEngine: { play, stop: vi.fn() } as never });
      const fn = captured.find((c) => c.channel === 'player:play')!.fn;

      const result = await fn({}, { type: 'episode', id: 1 });
      expect(result).toEqual({ data: { engine: 'libmpv' } });
      expect(play).toHaveBeenCalledWith({
        url: 'https://origin.example/ep101.mkv',
        httpHeaders: { Referer: 'https://panel.example' },
        profile: 'vod',
      });
      expect(play.mock.calls[0][0].url).not.toContain('127.0.0.1');
    });

    it('returns libmpv-load-failed diagnosis and does not spawn', async () => {
      db.prepare(
        `INSERT INTO vod_movies (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('Hevc', 'https://origin.example/movie.mkv', '{}', 'unknown', 1000);

      const play = vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'INTERNAL', details: { kind: 'libmpv-load-failed' } },
      });
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db, libmpvEngine: { play, stop: vi.fn() } as never });
      const fn = captured.find((c) => c.channel === 'player:play')!.fn;

      const result = await fn({}, { type: 'movie', id: 1 });
      expect(result).toEqual({
        error: { code: 'INTERNAL', details: { kind: 'libmpv-load-failed' } },
      });
    });
  });

  describe('player:getSource', () => {
    it('resolves a live row to a PlaybackSource payload', async () => {
      db.prepare(
        `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('CNN', 'https://cdn.example.com/cnn.m3u8', JSON.stringify({ 'User-Agent': 'X' }), 'hls', 1000);

      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getSource')!.fn;

      const result = await fn({}, { type: 'live', id: 1 });
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data).toEqual({
        type: 'live',
        id: 1,
        mediaFormat: 'hls',
      });
      expect(data).not.toHaveProperty('url');
      expect(data).not.toHaveProperty('httpHeaders');
    });

    it('resolves a movie row', async () => {
      db.prepare(
        `INSERT INTO vod_movies (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('Avatar', 'https://x/avatar.mp4', '{}', 'mp4', 1000);

      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getSource')!.fn;

      const result = await fn({}, { type: 'movie', id: 1 });
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data.mediaFormat).toBe('mp4');
    });

    it('resolves an episode row', async () => {
      db.prepare(`INSERT INTO series (name, url, added_at) VALUES (?, ?, ?)`).run('BB', 'https://x/bb', 1000);
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'Pilot', 'https://x/bb-s01e01.m3u8', 1, 1, 1000, '{}', 'hls');

      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getSource')!.fn;

      const result = await fn({}, { type: 'episode', id: 1 });
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data).toEqual({
        type: 'episode',
        id: 1,
        mediaFormat: 'hls',
      });
      expect(data).not.toHaveProperty('url');
    });

    it('returns NOT_FOUND when the id does not exist', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getSource')!.fn;

      const result = await fn({}, { type: 'live', id: 999 });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        }),
      );
    });
  });

  describe('player:reportError', () => {
    it('returns INVALID_INPUT for missing message', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:reportError')!.fn;

      const result = await fn({}, { code: 'STALL' });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('accepts a valid error report and returns undefined data', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:reportError')!.fn;

      const result = await fn({}, { code: 'STALL', message: 'manifest stalled' });
      expect(result).toEqual({ data: undefined });
    });
  });

  describe('player:reportProgress', () => {
    it('returns INVALID_INPUT for negative position', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:reportProgress')!.fn;

      const result = await fn({}, { type: 'movie', id: 1, position: -5, duration: 100 });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('accepts a valid progress report', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:reportProgress')!.fn;

      const result = await fn({}, { type: 'episode', id: 1, position: 30, duration: 1800 });
      expect(result).toEqual({ data: undefined });
    });
  });

  describe('player:getNextEpisode', () => {
    it('returns next episode in the same season', async () => {
      db.prepare(`INSERT INTO series (name, added_at) VALUES (?, ?)`).run('BB', 1000);
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'Pilot', 'https://x/e01', 1, 1, 1000, '{}', 'unknown');
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'Second', 'https://x/e02', 1, 2, 1000, '{}', 'unknown');

      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getNextEpisode')!.fn;

      const result = await fn({}, { episodeId: 1 });
      const data = (result as { data: { id: number; name: string } | null }).data;
      expect(data).toEqual({ id: 2, name: 'Second', seriesId: 1, url: 'https://x/e02', season: 1, episode: 2, cover: null, addedAt: 1000 });
    });

    it('returns first episode of next season when at season end', async () => {
      db.prepare(`INSERT INTO series (name, added_at) VALUES (?, ?)`).run('BB', 1000);
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'S1E1', 'https://x/s1e1', 1, 1, 1000, '{}', 'unknown');
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'S1E2', 'https://x/s1e2', 1, 2, 1000, '{}', 'unknown');
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'S2E1', 'https://x/s2e1', 2, 1, 1000, '{}', 'unknown');

      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getNextEpisode')!.fn;

      const result = await fn({}, { episodeId: 2 });
      const data = (result as { data: { id: number; name: string; season: number } | null }).data;
      expect(data).toEqual({ id: 3, name: 'S2E1', seriesId: 1, url: 'https://x/s2e1', season: 2, episode: 1, cover: null, addedAt: 1000 });
    });

    it('returns null at the end of the series', async () => {
      db.prepare(`INSERT INTO series (name, added_at) VALUES (?, ?)`).run('BB', 1000);
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(1, 'S1E1', 'https://x/s1e1', 1, 1, 1000);

      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getNextEpisode')!.fn;

      const result = await fn({}, { episodeId: 1 });
      const data = (result as { data: unknown }).data;
      expect(data).toBeNull();
    });

    it('returns NOT_FOUND for unknown episode id', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getNextEpisode')!.fn;

      const result = await fn({}, { episodeId: 999 });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        }),
      );
    });
  });

  describe('player:getProxiedUrl', () => {
    it('returns notImplemented when no proxy is configured', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db });
      const fn = captured.find((c) => c.channel === 'player:getProxiedUrl')!.fn;

      const result = await fn({}, { type: 'live', id: 1 });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL' }),
        }),
      );
    });

    it('returns the proxied URL when the proxy is configured', async () => {
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db, getProxiedBaseUrl: () => 'http://127.0.0.1:12345' });
      const fn = captured.find((c) => c.channel === 'player:getProxiedUrl')!.fn;

      const result = await fn({}, { type: 'live', id: 1 });
      const data = (result as { data: { url: string } }).data;
      expect(data.url).toBe('http://127.0.0.1:12345/proxy/live/1');
    });
  });
});