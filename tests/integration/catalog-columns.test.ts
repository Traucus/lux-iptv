import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import {
  bulkInsertLiveChannels,
  bulkInsertVodMovies,
  bulkInsertSeries,
} from '../../src/main/db/repo';

/**
 * The schema now carries `http_headers` (JSON) + `media_format` (enum) on
 * every catalog table. The bulk insert helpers must round-trip those fields
 * without losing fidelity (or silently inserting `null`/empty).
 */
describe('catalog bulk insert — http_headers + media_format', () => {
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
        url TEXT,
        group_title TEXT,
        cover TEXT,
        stream_type TEXT NOT NULL DEFAULT 'series',
        http_headers TEXT NOT NULL DEFAULT '{}',
        media_format TEXT NOT NULL DEFAULT 'unknown',
        year INTEGER,
        added_at INTEGER NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  describe('bulkInsertLiveChannels', () => {
    it('persists http_headers and media_format', () => {
      const now = Date.now();
      bulkInsertLiveChannels(db, [
        {
          name: 'CNN',
          url: 'https://stream.example.com/cnn.m3u8',
          groupTitle: 'News',
          addedAt: now,
          httpHeaders: { 'User-Agent': 'CustomUA/1.0', Referer: 'https://ref.example.com' },
          mediaFormat: 'hls',
        },
      ]);

      const row = db
        .prepare('SELECT http_headers, media_format FROM live_channels WHERE url = ?')
        .get('https://stream.example.com/cnn.m3u8') as {
          http_headers: string;
          media_format: string;
        };

      expect(JSON.parse(row.http_headers)).toEqual({
        'User-Agent': 'CustomUA/1.0',
        Referer: 'https://ref.example.com',
      });
      expect(row.media_format).toBe('hls');
    });

    it('upserts http_headers and media_format on conflict', () => {
      const now = Date.now();
      bulkInsertLiveChannels(db, [
        {
          name: 'BBC',
          url: 'https://stream.example.com/bbc',
          addedAt: now,
          httpHeaders: { 'User-Agent': 'OriginalUA' },
          mediaFormat: 'hls',
        },
      ]);
      bulkInsertLiveChannels(db, [
        {
          name: 'BBC',
          url: 'https://stream.example.com/bbc',
          addedAt: now,
          httpHeaders: { 'User-Agent': 'UpdatedUA' },
          mediaFormat: 'mp4',
        },
      ]);

      const row = db
        .prepare('SELECT http_headers, media_format FROM live_channels WHERE url = ?')
        .get('https://stream.example.com/bbc') as { http_headers: string; media_format: string };

      expect(JSON.parse(row.http_headers)).toEqual({ 'User-Agent': 'UpdatedUA' });
      expect(row.media_format).toBe('mp4');
    });

    it('defaults http_headers to {} and media_format to unknown when omitted', () => {
      const now = Date.now();
      bulkInsertLiveChannels(db, [
        { name: 'NoHeaders', url: 'https://example.com/nh', addedAt: now },
      ]);

      const row = db
        .prepare('SELECT http_headers, media_format FROM live_channels WHERE url = ?')
        .get('https://example.com/nh') as { http_headers: string; media_format: string };
      expect(JSON.parse(row.http_headers)).toEqual({});
      expect(row.media_format).toBe('unknown');
    });
  });

  describe('bulkInsertVodMovies', () => {
    it('persists http_headers and media_format', () => {
      const now = Date.now();
      bulkInsertVodMovies(db, [
        {
          name: 'Avatar',
          url: 'https://cdn.example.com/avatar.mp4',
          addedAt: now,
          httpHeaders: { 'User-Agent': 'MovieUA/1.0' },
          mediaFormat: 'mp4',
        },
      ]);

      const row = db
        .prepare('SELECT http_headers, media_format FROM vod_movies WHERE url = ?')
        .get('https://cdn.example.com/avatar.mp4') as { http_headers: string; media_format: string };

      expect(JSON.parse(row.http_headers)).toEqual({ 'User-Agent': 'MovieUA/1.0' });
      expect(row.media_format).toBe('mp4');
    });

    it('defaults http_headers to {} and media_format to unknown when omitted', () => {
      const now = Date.now();
      bulkInsertVodMovies(db, [
        { name: 'No Hints', url: 'https://example.com/nohints', addedAt: now },
      ]);

      const row = db
        .prepare('SELECT http_headers, media_format FROM vod_movies WHERE url = ?')
        .get('https://example.com/nohints') as { http_headers: string; media_format: string };
      expect(JSON.parse(row.http_headers)).toEqual({});
      expect(row.media_format).toBe('unknown');
    });
  });

  describe('bulkInsertSeries', () => {
    it('persists http_headers and media_format on a series row', () => {
      const now = Date.now();
      bulkInsertSeries(db, [
        {
          name: 'Breaking Bad',
          url: 'https://example.com/bb',
          addedAt: now,
          httpHeaders: { Referer: 'https://ref.example.com' },
          mediaFormat: 'unknown',
        },
      ]);

      const row = db
        .prepare('SELECT http_headers, media_format FROM series WHERE name = ?')
        .get('Breaking Bad') as { http_headers: string; media_format: string };

      expect(JSON.parse(row.http_headers)).toEqual({ Referer: 'https://ref.example.com' });
      expect(row.media_format).toBe('unknown');
    });
  });
});