import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import { migrate } from '../../src/main/db/migrate';

describe('migrate', () => {
  let db: SqlJsCompatDb;

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

  it('creates schema_version table if not exists', () => {
    migrate(db, []);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('sets version to 0 when no migrations provided', () => {
    migrate(db, []);
    const row = db.prepare('SELECT version FROM schema_version').get() as
      | { version: number }
      | undefined;
    // No migrations means no version row inserted (or version 0)
    expect(row?.version ?? 0).toBe(0);
  });

  it('applies a single migration and records version', () => {
    const migrations = [
      {
        sql: `CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
        version: 1,
      },
    ];
    migrate(db, migrations);

    // Table should exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'")
      .all();
    expect(tables).toHaveLength(1);

    // Version should be recorded
    const row = db.prepare('SELECT version FROM schema_version').get() as { version: number };
    expect(row.version).toBe(1);
  });

  it('is idempotent: re-running does not error', () => {
    const migrations = [
      {
        sql: `CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT NOT NULL);`,
        version: 1,
      },
    ];
    migrate(db, migrations);
    // Running again should not throw
    expect(() => migrate(db, migrations)).not.toThrow();
  });

  it('applies multiple migrations in order', () => {
    const migrations = [
      { sql: `CREATE TABLE t1 (id INTEGER PRIMARY KEY);`, version: 1 },
      { sql: `CREATE TABLE t2 (id INTEGER PRIMARY KEY);`, version: 2 },
    ];
    migrate(db, migrations);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('t1','t2')")
      .all();
    expect(tables).toHaveLength(2);

    const row = db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number };
    expect(row.version).toBe(2);
  });

  it('only applies pending migrations', () => {
    // First, apply version 1
    migrate(db, [{ sql: `CREATE TABLE t1 (id INTEGER PRIMARY KEY);`, version: 1 }]);

    // Now apply version 1 + 2
    const migrations = [
      { sql: `CREATE TABLE t1 (id INTEGER PRIMARY KEY);`, version: 1 },
      { sql: `CREATE TABLE t2 (id INTEGER PRIMARY KEY);`, version: 2 },
    ];
    migrate(db, migrations);

    // t2 should exist now
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='t2'")
      .all();
    expect(tables).toHaveLength(1);
  });
});