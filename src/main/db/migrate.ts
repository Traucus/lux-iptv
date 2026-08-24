import type Database from 'better-sqlite3';

export type Migration = {
  sql: string;
  version: number;
};

/**
 * Runs pending migrations against the given SQLite database.
 * Idempotent: re-running with the same migrations does nothing.
 */
export function migrate(db: Database.Database, migrations: Migration[]): void {
  // Ensure schema_version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  // Get current version
  const row = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {
    version: number | null;
  };
  const currentVersion = row.version ?? 0;

  // Apply pending migrations in order
  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
      migration.version,
      Date.now(),
    );
  }
}
