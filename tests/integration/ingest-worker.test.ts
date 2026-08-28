import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import { processM3UEntries } from '../../src/main/workers/ingest-worker';

describe('ingest-worker', () => {
  describe('processM3UEntries', () => {
    let db: SqlJsCompatDb;

    beforeAll(async () => {
      await initSqlJsModule();
      db = createSqlJsDb(':memory:');
      // Create tables
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
          http_headers TEXT NOT NULL DEFAULT '{}',
          media_format TEXT NOT NULL DEFAULT 'unknown',
          added_at INTEGER NOT NULL
        );
      `);
    });

    beforeEach(() => {
      // Clear tables between tests
      db.exec('DELETE FROM live_channels');
      db.exec('DELETE FROM vod_movies');
      db.exec('DELETE FROM series');
      db.exec('DELETE FROM episodes');
    });

    it('classifies and persists M3U entries correctly', () => {
      const entries = [
        { name: 'CNN', url: 'https://stream.example.com/channels/cnn', groupTitle: 'News', tvgId: 'cnn', tvgLogo: 'https://example.com/cnn.png' },
        { name: 'Avatar', url: 'https://stream.example.com/movie/avatar', groupTitle: 'Movies', tvgId: null, tvgLogo: null },
        { name: 'Breaking Bad S01E01', url: 'https://stream.example.com/series/bb/s01e01', groupTitle: 'Series', tvgId: null, tvgLogo: null },
        { name: 'Radio FM', url: 'https://stream.example.com/radio/fm', groupTitle: 'Radio', tvgId: null, tvgLogo: null },
      ];

      const counts = processM3UEntries(db, entries);

      expect(counts.live).toBe(1);
      expect(counts.movies).toBe(1);
      expect(counts.series).toBe(1);
      expect(counts.radio).toBe(1);
      expect(counts.total).toBe(4);

      // Verify DB - live_channels includes both live and radio
      const liveCount = db.prepare('SELECT COUNT(*) as c FROM live_channels WHERE stream_type = ?').get('live') as { c: number };
      expect(liveCount.c).toBe(1);

      const radioCount = db.prepare('SELECT COUNT(*) as c FROM live_channels WHERE stream_type = ?').get('radio') as { c: number };
      expect(radioCount.c).toBe(1);

      const movieCount = db.prepare('SELECT COUNT(*) as c FROM vod_movies').get() as { c: number };
      expect(movieCount.c).toBe(1);
    });

    it('handles empty entries', () => {
      const counts = processM3UEntries(db, []);
      expect(counts.total).toBe(0);
    });

    it('deduplicates by URL (upsert)', () => {
      const entries = [
        { name: 'CNN', url: 'https://stream.example.com/live/cnn-dedupe', groupTitle: 'News', tvgId: 'cnn', tvgLogo: null },
        { name: 'CNN Updated', url: 'https://stream.example.com/live/cnn-dedupe', groupTitle: 'News HD', tvgId: 'cnn2', tvgLogo: null },
      ];

      processM3UEntries(db, entries);

      const row = db.prepare('SELECT name, group_title FROM live_channels WHERE url = ?').get('https://stream.example.com/live/cnn-dedupe') as { name: string; group_title: string };
      expect(row.name).toBe('CNN Updated');
      expect(row.group_title).toBe('News HD');
    });

    it('does NOT insert enrichment_status (enrichment lives in IndexedDB)', () => {
      const entries = [
        { name: 'CNN', url: 'https://stream.example.com/channels/cnn-noenrich', groupTitle: 'News', tvgId: 'cnn', tvgLogo: null },
      ];
      processM3UEntries(db, entries);

      const columns = (db.prepare("PRAGMA table_info('live_channels')").all() as Array<{ name: string }>).map((c) => c.name);
      expect(columns).not.toContain('enrichment_status');
    });
  });
});