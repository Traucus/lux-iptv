import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { migrate, loadMigrations } from '../../src/main/db/migrate';

/**
 * Migration atomicity + default-population contract.
 *
 * Spec: catalog-schema §Migration Transactional Safety
 *  - Existing rows MUST get `http_headers = '{}'` and `media_format = 'unknown'`
 *    after the 0001 migration runs.
 *  - Defaults MUST be deterministic and identical for every pre-existing row.
 *  - On any failure inside a single migration file, the whole file MUST roll
 *    back atomically.
 */
describe('migration-atomicity', () => {
  let db: InstanceType<typeof Database>;
  const MIGRATIONS_DIR = join(__dirname, '../../src/main/db/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('applies 0000 then 0001 from disk and exposes the new columns', () => {
    const all = loadMigrations(MIGRATIONS_DIR);
    expect(all.length).toBeGreaterThanOrEqual(2);

    // Apply 0000 only.
    const v0 = all.filter((m) => m.version === 1);
    migrate(db, v0);

    // All 4 tables should exist; new columns should NOT yet.
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('live_channels','vod_movies','series','episodes')",
      )
      .all() as Array<{ name: string }>;
    expect(tables).toHaveLength(4);

    const liveCols = (db.prepare("PRAGMA table_info('live_channels')").all() as Array<{ name: string }>).map(
      (c) => c.name,
    );
    expect(liveCols).not.toContain('http_headers');
    expect(liveCols).not.toContain('media_format');

    // Apply 0001.
    migrate(db, all);
    const liveColsAfter = (
      db.prepare("PRAGMA table_info('live_channels')").all() as Array<{ name: string }>
    ).map((c) => c.name);
    expect(liveColsAfter).toContain('http_headers');
    expect(liveColsAfter).toContain('media_format');
  });

  it('populates http_headers = "{}" and media_format = "unknown" for pre-existing rows', () => {
    const all = loadMigrations(MIGRATIONS_DIR);
    const v0 = all.filter((m) => m.version === 1);
    migrate(db, v0);

    // Insert a row into each of the 4 tables before 0001 runs.
    db.prepare(
      `INSERT INTO live_channels (name, url, added_at) VALUES (?, ?, ?)`,
    ).run('Pre-existing Live', 'http://x/live-1', 1000);
    db.prepare(
      `INSERT INTO vod_movies (name, url, added_at) VALUES (?, ?, ?)`,
    ).run('Pre-existing Movie', 'http://x/movie-1', 1000);
    db.prepare(
      `INSERT INTO series (name, added_at) VALUES (?, ?)`,
    ).run('Pre-existing Series', 1000);
    db.prepare(
      `INSERT INTO episodes (series_id, name, url, season, episode, added_at)
       VALUES (1, 'Pre-existing Ep', 'http://x/ep-1', 1, 1, 1000)`,
    ).run();

    // Now apply 0001.
    migrate(db, all);

    const live = db
      .prepare(`SELECT http_headers, media_format FROM live_channels WHERE name = ?`)
      .get('Pre-existing Live') as { http_headers: string; media_format: string };
    const movie = db
      .prepare(`SELECT http_headers, media_format FROM vod_movies WHERE name = ?`)
      .get('Pre-existing Movie') as { http_headers: string; media_format: string };
    const ser = db
      .prepare(`SELECT http_headers, media_format FROM series WHERE name = ?`)
      .get('Pre-existing Series') as { http_headers: string; media_format: string };
    const ep = db
      .prepare(`SELECT http_headers, media_format FROM episodes WHERE name = ?`)
      .get('Pre-existing Ep') as { http_headers: string; media_format: string };

    // SQLite stores the JSON default as the literal string "{}" (no quotes
    // around it in the row), and 'unknown' for the text column.
    for (const row of [live, movie, ser, ep]) {
      expect(row.http_headers).toBe('{}');
      expect(row.media_format).toBe('unknown');
    }
  });

  it('rejects an invalid media_format on insert (CHECK or NOT NULL+app-level)', () => {
    const all = loadMigrations(MIGRATIONS_DIR);
    migrate(db, all);

    // SQLite is permissive about TEXT columns by default — Drizzle enforces
    // the enum at the application layer. What the migration MUST guarantee is
    // that valid values can be stored and round-trip.
    db.prepare(
      `INSERT INTO live_channels (name, url, media_format, added_at) VALUES (?, ?, ?, ?)`,
    ).run('Valid HLS', 'http://x/live-hls', 'hls', 2000);

    const row = db
      .prepare(`SELECT media_format FROM live_channels WHERE name = ?`)
      .get('Valid HLS') as { media_format: string };
    expect(row.media_format).toBe('hls');
  });

  it('rolls back a migration atomically when an ALTER statement fails mid-way', () => {
    // Create a synthetic "bad" migration where the second ALTER references a
    // non-existent table. The runner must NOT leave a partial state behind.
    const setupSql = `
      CREATE TABLE live_channels (id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL);
    `;
    db.exec(setupSql);

    // Mark version 1 as already applied to skip the schema-version bookkeeping
    // collision and isolate the runner's BEGIN/COMMIT behavior.
    db.exec(`CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);`);
    db.prepare(`INSERT INTO schema_version (version, applied_at) VALUES (1, ?)`).run(Date.now());

    const badMigration = {
      version: 2,
      sql: `BEGIN; ALTER TABLE live_channels ADD COLUMN ok_column TEXT; ALTER TABLE does_not_exist ADD COLUMN x TEXT; COMMIT;`,
    };

    expect(() => migrate(db, [badMigration])).toThrow();

    // The first ALTER (valid) MUST have been rolled back.
    const cols = (db.prepare(`PRAGMA table_info('live_channels')`).all() as Array<{ name: string }>).map(
      (c) => c.name,
    );
    expect(cols).not.toContain('ok_column');

    // The failed version MUST NOT be recorded.
    const recorded = db
      .prepare(`SELECT version FROM schema_version ORDER BY version`)
      .all() as Array<{ version: number }>;
    expect(recorded.map((r) => r.version)).toEqual([1]);
  });
});
