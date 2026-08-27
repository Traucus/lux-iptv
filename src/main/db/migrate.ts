import type Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Migration = {
  sql: string;
  version: number;
  file: string;
};

export type MigrationDirection = 'up' | 'down';

export type MigrateOptions = {
  /** Direction: 'up' (default) applies pending up migrations, 'down' rolls back down migrations in reverse order. */
  direction?: MigrationDirection;
};

const DOWN_SUFFIX = '_down.sql';

/**
 * Runs pending migrations against the given SQLite database.
 *
 * Up (default):
 *   - Reads MAX(version) from schema_version
 *   - Applies every migration with version > current, sorted ascending
 *   - Each migration body (DDL + version row insert) runs inside
 *     `db.transaction(...)` so any failure rolls back the whole file
 *     atomically. The version row is NOT recorded if the migration fails.
 *
 * Down:
 *   - Caller passes DOWN migrations (typically from `loadDownMigrations`)
 *   - Applies them in REVERSE order, removing the version row after each
 *     successful roll back
 *
 * Idempotent for 'up': re-running with the same migrations does nothing.
 */
export function migrate(db: Database.Database, migrations: Migration[], options: MigrateOptions = {}): void {
  const direction = options.direction ?? 'up';

  // Ensure schema_version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  if (direction === 'up') {
    runUp(db, migrations);
  } else {
    runDown(db, migrations);
  }
}

function runUp(db: Database.Database, migrations: Migration[]): void {
  const currentVersion = readCurrentVersion(db);

  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    applyUpMigration(db, migration);
  }
}

function runDown(db: Database.Database, migrations: Migration[]): void {
  // Apply down migrations in reverse order. Each one removes the version row
  // after the DDL succeeds.
  const ordered = [...migrations].sort((a, b) => b.version - a.version);

  for (const migration of ordered) {
    applyDownMigration(db, migration);
  }
}

function applyUpMigration(db: Database.Database, migration: Migration): void {
  // Strip the migration runner's own bookkeeping from the file content
  // (CREATE TABLE schema_version) and any explicit BEGIN/COMMIT, since the
  // runner already wraps the migration body in its own transaction. Keeping
  // both would result in "cannot start a transaction within a transaction".
  const cleanedSql = migration.sql
    .split('--> statement-breakpoint')
    .filter((stmt) => !stmt.includes('CREATE TABLE `schema_version`'))
    .join('')
    .replace(/^\s*BEGIN\s*;?/im, '')
    .replace(/\s*COMMIT\s*;?\s*$/im, '')
    .trim();

  const tx = db.transaction(() => {
    if (cleanedSql) {
      db.exec(cleanedSql);
    }
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      Date.now(),
    );
  });

  tx();
}

function applyDownMigration(db: Database.Database, migration: Migration): void {
  const cleanedSql = migration.sql
    .split('--> statement-breakpoint')
    .filter((stmt) => !stmt.includes('CREATE TABLE `schema_version`'))
    .join('')
    .replace(/^\s*BEGIN\s*;?/im, '')
    .replace(/\s*COMMIT\s*;?\s*$/im, '')
    .trim();

  const tx = db.transaction(() => {
    if (cleanedSql) {
      db.exec(cleanedSql);
    }
    db.prepare('DELETE FROM schema_version WHERE version = ?').run(migration.version);
  });

  tx();
}

function readCurrentVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
    version: number | null;
  };
  return row.version ?? 0;
}

/**
 * Loads UP migration files from the migrations directory.
 * Each non-`_*_down.sql` file is parsed as a migration with
 * version = 1-based index in sorted order.
 */
export function loadMigrations(migrationsDir: string): Migration[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith(DOWN_SUFFIX))
    .sort();

  return files.map((file, index) => {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    return { sql, version: index + 1, file };
  });
}

/**
 * Loads DOWN migration files from the migrations directory.
 * Each `*_down.sql` file is parsed as a migration whose `version` is the
 * UP version it rolls back (parsed from the filename prefix, e.g.
 * `0001_..._down.sql` reverses up version 2). This matches the version row
 * the down migration removes from `schema_version`.
 */
export function loadDownMigrations(migrationsDir: string): Migration[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(DOWN_SUFFIX))
    .sort();

  return files.map((file) => {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    // "0001_add_http_headers_and_media_format_down.sql" -> up version 2
    const prefix = file.split('_')[0];
    const sequence = Number(prefix);
    if (!Number.isFinite(sequence) || sequence < 0) {
      throw new Error(`Cannot parse down-migration version from filename: ${file}`);
    }
    return { sql, version: sequence + 1, file };
  });
}
