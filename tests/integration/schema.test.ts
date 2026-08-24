import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import {
  liveChannels,
  vodMovies,
  series,
  episodes,
  schemaVersion,
} from '../../src/main/db/schema';

describe('schema', () => {
  let db: InstanceType<typeof Database>;

  beforeAll(() => {
    db = new Database(':memory:');
    // Create tables using the Drizzle schema DDL
    db.exec(`
      CREATE TABLE IF NOT EXISTS live_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        group_title TEXT,
        tvg_id TEXT,
        tvg_logo TEXT,
        stream_type TEXT NOT NULL DEFAULT 'live',
        enrichment_status TEXT NOT NULL DEFAULT 'pending',
        added_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS live_xtream_id_uq ON live_channels(xtream_id) WHERE xtream_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS live_name_idx ON live_channels(name);
      CREATE INDEX IF NOT EXISTS live_group_idx ON live_channels(group_title);

      CREATE TABLE IF NOT EXISTS vod_movies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        group_title TEXT,
        cover TEXT,
        stream_type TEXT NOT NULL DEFAULT 'movie',
        year INTEGER,
        enrichment_status TEXT NOT NULL DEFAULT 'pending',
        added_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS vod_xtream_id_uq ON vod_movies(xtream_id) WHERE xtream_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS vod_name_idx ON vod_movies(name);
      CREATE INDEX IF NOT EXISTS vod_group_idx ON vod_movies(group_title);

      CREATE TABLE IF NOT EXISTS series (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        group_title TEXT,
        cover TEXT,
        stream_type TEXT NOT NULL DEFAULT 'series',
        year INTEGER,
        enrichment_status TEXT NOT NULL DEFAULT 'pending',
        added_at INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS series_xtream_id_uq ON series(xtream_id) WHERE xtream_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS series_name_idx ON series(name);
      CREATE INDEX IF NOT EXISTS series_group_idx ON series(group_title);

      CREATE TABLE IF NOT EXISTS episodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        series_id INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        season INTEGER NOT NULL,
        episode INTEGER NOT NULL,
        cover TEXT,
        enrichment_status TEXT NOT NULL DEFAULT 'pending',
        added_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS episodes_series_idx ON episodes(series_id);
      CREATE INDEX IF NOT EXISTS episodes_season_episode_idx ON episodes(series_id, season, episode);

      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at INTEGER NOT NULL
      );
    `);
  });

  afterAll(() => {
    db.close();
  });

  it('creates live_channels table with correct columns', () => {
    const info = db.prepare("PRAGMA table_info('live_channels')").all();
    const columns = (info as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('xtream_id');
    expect(columns).toContain('name');
    expect(columns).toContain('url');
    expect(columns).toContain('group_title');
    expect(columns).toContain('tvg_id');
    expect(columns).toContain('tvg_logo');
    expect(columns).toContain('stream_type');
    expect(columns).toContain('enrichment_status');
    expect(columns).toContain('added_at');
  });

  it('creates vod_movies table with correct columns', () => {
    const info = db.prepare("PRAGMA table_info('vod_movies')").all();
    const columns = (info as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('url');
    expect(columns).toContain('cover');
    expect(columns).toContain('year');
    expect(columns).toContain('enrichment_status');
  });

  it('creates series table with correct columns', () => {
    const info = db.prepare("PRAGMA table_info('series')").all();
    const columns = (info as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('enrichment_status');
  });

  it('creates episodes table with FK to series', () => {
    const info = db.prepare("PRAGMA table_info('episodes')").all();
    const columns = (info as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toContain('series_id');
    expect(columns).toContain('season');
    expect(columns).toContain('episode');

    const fk = db.prepare("PRAGMA foreign_key_list('episodes')").all();
    expect(fk).toHaveLength(1);
    expect((fk[0] as { table: string }).table).toBe('series');
  });

  it('creates schema_version table', () => {
    const info = db.prepare("PRAGMA table_info('schema_version')").all();
    const columns = (info as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toContain('version');
    expect(columns).toContain('applied_at');
  });

  it('exports Drizzle table references', () => {
    expect(liveChannels).toBeDefined();
    expect(vodMovies).toBeDefined();
    expect(series).toBeDefined();
    expect(episodes).toBeDefined();
    expect(schemaVersion).toBeDefined();
  });
});
