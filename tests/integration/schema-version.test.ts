import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import { join } from 'node:path';
import { migrate, loadMigrations } from '../../src/main/db/migrate';

/**
 * Schema-version bookkeeping contract.
 *
 * Spec: catalog-schema §Migration Transactional Safety
 *  - After every successful migration, `schema_version` MUST record a row
 *    with the up version and a non-null `applied_at`.
 *  - Re-running the runner with the same migrations MUST be a no-op
 *    (idempotent: no duplicate rows, no errors).
 */
describe('schema-version', () => {
  let db: SqlJsCompatDb;
  const MIGRATIONS_DIR = join(__dirname, '../../src/main/db/migrations');

  beforeAll(async () => {
    await initSqlJsModule();
  });

  beforeEach(() => {
    db = createSqlJsDb(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('records one row per applied migration with a non-null applied_at', () => {
    const all = loadMigrations(MIGRATIONS_DIR);
    const before = Date.now();
    migrate(db, all);
    const after = Date.now();

    const rows = db
      .prepare(`SELECT version, applied_at FROM schema_version ORDER BY version`)
      .all() as Array<{ version: number; applied_at: number }>;

    expect(rows).toHaveLength(all.length);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      expect(row.version).toBe(i + 1);
      expect(row.applied_at).toBeGreaterThanOrEqual(before);
      expect(row.applied_at).toBeLessThanOrEqual(after);
    }
  });

  it('is idempotent: re-running the same migrations does not duplicate rows', () => {
    const all = loadMigrations(MIGRATIONS_DIR);
    migrate(db, all);
    const firstCount = (db.prepare(`SELECT COUNT(*) as c FROM schema_version`).get() as { c: number }).c;

    // Second run: no-op, no errors.
    expect(() => migrate(db, all)).not.toThrow();
    const secondCount = (db.prepare(`SELECT COUNT(*) as c FROM schema_version`).get() as { c: number }).c;
    expect(secondCount).toBe(firstCount);
  });

  it('bumps MAX(version) to the latest applied migration', () => {
    const all = loadMigrations(MIGRATIONS_DIR);
    migrate(db, all);
    const row = db.prepare(`SELECT MAX(version) as version FROM schema_version`).get() as {
      version: number;
    };
    expect(row.version).toBe(all.length);
  });
});