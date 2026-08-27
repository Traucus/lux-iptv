import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type DbHandle = {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: Database.Database;
};

/**
 * Creates a database handle.
 * @param path - Path to the SQLite file, or ':memory:' for testing.
 */
export function createDb(path: string): DbHandle {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
