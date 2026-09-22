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

describe('player IPC channels (registration + play)', () => {
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
      ).run('CNN', 'https://origin.example/live.m3u8', JSON.stringify({ 'User-Agent': 'Lux/1' }), 'hls', 1000);
      const play = vi.fn().mockResolvedValue({ ok: true, engine: 'libmpv' });
      const { ipc, captured } = captureIpcMain();
      registerPlayerHandlers(ipc, { db, libmpvEngine: { play, stop: vi.fn() } as never });
      const fn = captured.find((c) => c.channel === 'player:play')!.fn;
      const result = await fn({}, { type: 'live', id: 1 });
      expect(result).toEqual({ data: { engine: 'libmpv' } });
      expect(play).toHaveBeenCalledWith({
        url: 'https://origin.example/live.m3u8',
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
});
