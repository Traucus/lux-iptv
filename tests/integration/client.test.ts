import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { createDb, type DbHandle } from '../../src/main/db/client';
import { initSqlJsModule } from '../../src/main/db/sqljs-adapter';

describe('db client', () => {
  let handle: DbHandle | null = null;

  beforeAll(async () => {
    await initSqlJsModule();
  });

  afterEach(() => {
    if (handle) {
      handle.sqlite.close();
      handle = null;
    }
  });

  it('creates an in-memory database for tests', () => {
    handle = createDb(':memory:');
    expect(handle.db).toBeDefined();
    expect(handle.sqlite).toBeDefined();
  });

  it('can execute queries on the in-memory database', () => {
    handle = createDb(':memory:');
    const result = handle.sqlite.prepare('SELECT 1 + 1 AS result').get();
    expect(result).toEqual({ result: 2 });
  });

  it('creates tables from schema', () => {
    handle = createDb(':memory:');
    // Should not throw
    handle.sqlite.exec(`
      CREATE TABLE live_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        added_at INTEGER NOT NULL
      );
    `);
    const tables = handle.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='live_channels'")
      .all();
    expect(tables).toHaveLength(1);
  });
});
