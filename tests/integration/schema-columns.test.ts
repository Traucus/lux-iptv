import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { migrate, loadMigrations } from '../../src/main/db/migrate';

/**
 * Schema-column assertions for catalog tables.
 *
 * Spec: catalog-schema §Catalog Table Schema
 *  - Each of the 4 catalog tables MUST include an `http_headers` JSON column
 *    with DEFAULT '{}'.
 *  - Each MUST include a `media_format` TEXT column with DEFAULT 'unknown'.
 *  - `media_format` MUST accept only the enum values: hls, mp4, dash, ts, unknown.
 */
describe('catalog schema columns (http_headers + media_format)', () => {
  let db: InstanceType<typeof Database>;
  const MIGRATIONS_DIR = join(__dirname, '../../src/main/db/migrations');

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    migrate(db, loadMigrations(MIGRATIONS_DIR));
  });

  afterAll(() => {
    db.close();
  });

  // Helper: return the column info for a given table.
  const columns = (table: string): string[] => {
    const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return info.map((c) => c.name);
  };

  // Helper: return the full PRAGMA row (includes type + notnull + dflt_value).
  const columnInfo = (table: string, column: string): { type: string; notnull: number; dflt_value: unknown } | undefined => {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
    }>;
    return rows.find((r) => r.name === column);
  };

  const TABLES = ['live_channels', 'vod_movies', 'series', 'episodes'] as const;

  for (const table of TABLES) {
    it(`${table} has http_headers column`, () => {
      expect(columns(table)).toContain('http_headers');
    });

    it(`${table} has media_format column`, () => {
      expect(columns(table)).toContain('media_format');
    });

    it(`${table}.http_headers is NOT NULL with default '{}'`, () => {
      const info = columnInfo(table, 'http_headers');
      expect(info).toBeDefined();
      expect(info!.notnull).toBe(1);
      // Default is a JSON object literal stored as a string. SQLite normalizes
      // it to "'{}'" in the PRAGMA output.
      expect(String(info!.dflt_value)).toBe("'{}'");
    });

    it(`${table}.media_format is NOT NULL with default 'unknown'`, () => {
      const info = columnInfo(table, 'media_format');
      expect(info).toBeDefined();
      expect(info!.notnull).toBe(1);
      expect(String(info!.dflt_value)).toBe("'unknown'");
    });
  }
});
