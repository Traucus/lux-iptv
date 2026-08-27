import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { migrate, loadMigrations, loadDownMigrations } from '../../src/main/db/migrate';

/**
 * Down-migration rollback contract.
 *
 * Spec: catalog-schema §Migration Transactional Safety
 *  - When the down migration runs, `http_headers` and `media_format` MUST be
 *    removed from all 4 tables.
 *  - Row data (other columns) MUST be preserved.
 *  - The schema_version row for the rolled-back migration MUST be removed.
 */
describe('down-migration', () => {
  let db: InstanceType<typeof Database>;
  const MIGRATIONS_DIR = join(__dirname, '../../src/main/db/migrations');

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('loads down migrations from the migrations directory', () => {
    const downs = loadDownMigrations(MIGRATIONS_DIR);
    expect(downs.length).toBeGreaterThanOrEqual(1);
    for (const d of downs) {
      expect(d.file).toMatch(/_down\.sql$/);
    }
  });

  it('applies up then down: 0001 columns are removed and rows survive', () => {
    const ups = loadMigrations(MIGRATIONS_DIR);
    expect(ups.length).toBeGreaterThanOrEqual(2);

    // Apply 0000 + 0001.
    migrate(db, ups);

    // Sanity check: columns present.
    for (const table of ['live_channels', 'vod_movies', 'series', 'episodes']) {
      const cols = (
        db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      ).map((c) => c.name);
      expect(cols).toContain('http_headers');
      expect(cols).toContain('media_format');
    }

    // Insert a row that exercises a non-default value, so we can prove the
    // row survives the rollback.
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Survives Rollback', 'http://x/live-rollback', '{"X-Test":"1"}', 'hls', 9000);

    const beforeRow = db
      .prepare(`SELECT name, http_headers, media_format FROM live_channels WHERE url = ?`)
      .get('http://x/live-rollback') as { name: string; http_headers: string; media_format: string };
    expect(beforeRow.name).toBe('Survives Rollback');
    expect(beforeRow.media_format).toBe('hls');

    // Apply 0001 down migration.
    const downs = loadDownMigrations(MIGRATIONS_DIR);
    const downFor0001 = downs.filter((d) => d.version === 2);
    expect(downFor0001.length).toBe(1);

    migrate(db, downFor0001, { direction: 'down' });

    // Columns MUST be gone from every table.
    for (const table of ['live_channels', 'vod_movies', 'series', 'episodes']) {
      const cols = (
        db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      ).map((c) => c.name);
      expect(cols).not.toContain('http_headers');
      expect(cols).not.toContain('media_format');
    }

    // Row MUST still exist with the other columns intact.
    const afterRow = db
      .prepare(`SELECT name FROM live_channels WHERE url = ?`)
      .get('http://x/live-rollback') as { name: string };
    expect(afterRow.name).toBe('Survives Rollback');

    // The rolled-back version row MUST be gone from schema_version.
    const recorded = db
      .prepare(`SELECT version FROM schema_version ORDER BY version`)
      .all() as Array<{ version: number }>;
    expect(recorded.map((r) => r.version)).toEqual([1]);

    // Re-applying the up migration MUST succeed and restore the columns.
    migrate(db, ups);
    const liveCols = (
      db.prepare(`PRAGMA table_info('live_channels')`).all() as Array<{ name: string }>
    ).map((c) => c.name);
    expect(liveCols).toContain('http_headers');
    expect(liveCols).toContain('media_format');
  });
});
