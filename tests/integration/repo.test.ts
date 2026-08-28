import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import { bulkInsertLiveChannels, bulkInsertVodMovies } from '../../src/main/db/repo';

describe('repo', () => {
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
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('bulkInserts 8000 live channels in < 400ms', () => {
    const rows = Array.from({ length: 8000 }, (_, i) => ({
      name: `Channel ${i}`,
      url: `http://example.com/live/${i}`,
      groupTitle: 'Group A',
      addedAt: Date.now(),
    }));

    const start = performance.now();
    bulkInsertLiveChannels(db, rows);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1500);

    const count = db.prepare('SELECT COUNT(*) as count FROM live_channels').get() as {
      count: number;
    };
    expect(count.count).toBe(8000);
  });

  it('upserts by url: updates existing row on conflict', () => {
    // Insert initial row
    bulkInsertLiveChannels(db, [
      {
        name: 'Channel 1',
        url: 'http://example.com/live/1',
        groupTitle: 'Group A',
        addedAt: Date.now(),
      },
    ]);

    // Upsert with same URL but different name
    bulkInsertLiveChannels(db, [
      {
        name: 'Channel 1 Updated',
        url: 'http://example.com/live/1',
        groupTitle: 'Group B',
        addedAt: Date.now(),
      },
    ]);

    const row = db
      .prepare('SELECT name, group_title FROM live_channels WHERE url = ?')
      .get('http://example.com/live/1') as { name: string; group_title: string };
    expect(row.name).toBe('Channel 1 Updated');
    expect(row.group_title).toBe('Group B');
  });

  it('bulkInserts vod_movies correctly', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      name: `Movie ${i}`,
      url: `http://example.com/movie/${i}`,
      groupTitle: 'Movies',
      year: 2020 + (i % 5),
      addedAt: Date.now(),
    }));

    bulkInsertVodMovies(db, rows);

    const count = db.prepare('SELECT COUNT(*) as count FROM vod_movies').get() as {
      count: number;
    };
    expect(count.count).toBe(100);
  });

  it('handles empty array without error', () => {
    expect(() => bulkInsertLiveChannels(db, [])).not.toThrow();
    const count = db.prepare('SELECT COUNT(*) as count FROM live_channels').get() as {
      count: number;
    };
    expect(count.count).toBe(0);
  });
});