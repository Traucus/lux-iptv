import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import { createSqlJsDb, type SqlJsCompatDb } from './sqljs-adapter.js';
import * as schema from './schema.js';

export type DbHandle = {
  db: SQLJsDatabase<typeof schema>;
  sqlite: SqlJsCompatDb;
};

/**
 * Creates a database handle.
 * @param path - Path to the SQLite file, or ':memory:' for testing.
 */
export function createDb(path: string): DbHandle {
  const sqlite = createSqlJsDb(path);
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite.raw, { schema });
  return { db, sqlite };
}