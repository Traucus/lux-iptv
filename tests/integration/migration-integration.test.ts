import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { migrate, loadMigrations } from '../../src/main/db/migrate';

describe('migration integration', () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  it('loads migration files from the migrations directory', () => {
    const migrationsDir = join(__dirname, '../../src/main/db/migrations');
    const migrations = loadMigrations(migrationsDir);
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations[0]).toHaveProperty('sql');
    expect(migrations[0]).toHaveProperty('version');
  });

  it('applies initial migration creating all 4 tables + schema_version', () => {
    const migrationsDir = join(__dirname, '../../src/main/db/migrations');
    const migrations = loadMigrations(migrationsDir);
    migrate(db, migrations);

    // Check all tables exist
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('live_channels', 'vod_movies', 'series', 'episodes', 'schema_version')",
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name).sort()).toEqual([
      'episodes',
      'live_channels',
      'schema_version',
      'series',
      'vod_movies',
    ]);
  });

  it('records schema version after migration', () => {
    const migrationsDir = join(__dirname, '../../src/main/db/migrations');
    const migrations = loadMigrations(migrationsDir);
    migrate(db, migrations);

    const row = db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number };
    expect(row.version).toBe(migrations.length);
  });
});
