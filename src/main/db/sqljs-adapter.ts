import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let sqlModule: Awaited<ReturnType<typeof initSqlJs>> | null = null;

/**
 * Initialize the sql.js WASM module. Call once at app startup.
 */
export async function initSqlJsModule(): Promise<void> {
  if (!sqlModule) {
    sqlModule = await initSqlJs();
  }
}

/**
 * Creates a database with a better-sqlite3-compatible API.
 */
export function createSqlJsDb(path: string): SqlJsCompatDb {
  if (!sqlModule) throw new Error('Call initSqlJsModule() first');

  let sqlDb: SqlJsDatabase;
  if (path === ':memory:') {
    sqlDb = new sqlModule.Database();
  } else {
    if (existsSync(path)) {
      const buffer = readFileSync(path);
      sqlDb = new sqlModule.Database(new Uint8Array(buffer));
    } else {
      // Ensure directory exists
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      sqlDb = new sqlModule.Database();
    }
  }
  return new SqlJsCompatDb(sqlDb, path);
}

export class SqlJsCompatDb {
  private db: SqlJsDatabase;
  private filePath: string;

  constructor(db: SqlJsDatabase, filePath: string) {
    this.db = db;
    this.filePath = filePath;
  }

  pragma(sql: string): void {
    // sql.js doesn't support WAL mode (it's in-memory/single-threaded)
    if (sql.toLowerCase().includes('wal')) return;
    this.db.run(`PRAGMA ${sql}`);
  }

  exec(sql: string): void {
    this.db.run(sql);
  }

  prepare(sql: string): SqlJsCompatStatement {
    // Convert @paramName to :paramName for sql.js compatibility
    const convertedSql = sql.replace(/@(\w+)/g, ':$1');
    return new SqlJsCompatStatement(this.db, convertedSql);
  }

  transaction<T, Args extends unknown[]>(fn: (...args: Args) => T): (...args: Args) => T {
    const self = this;
    return function transactionWrapper(...args: Args) {
      self.db.run('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self.db.run('COMMIT');
        return result;
      } catch (e) {
        self.db.run('ROLLBACK');
        throw e;
      }
    };
  }

  close(): void {
    // Save to file before closing (except :memory: databases)
    if (this.filePath !== ':memory:') {
      const data = this.db.export();
      writeFileSync(this.filePath, Buffer.from(data));
    }
    this.db.close();
  }

  /** Expose the raw sql.js Database for drizzle-orm/sql.js */
  get raw(): SqlJsDatabase {
    return this.db;
  }
}

class SqlJsCompatStatement {
  private db: SqlJsDatabase;
  private sql: string;

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  /**
   * Normalize parameters to sql.js format.
   * sql.js accepts either an array (for positional params) or an object (for named params).
   * We support both: if the first argument is an object, use it as named params;
   * otherwise treat all arguments as positional params.
   */
  private normalizeParams(params: unknown[]): any {
    if (params.length === 1 && params[0] !== null && typeof params[0] === 'object' && !Array.isArray(params[0])) {
      return params[0] as Record<string, unknown>;
    }
    return params;
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const normalizedParams = this.normalizeParams(params);
    const results = this.db.exec(this.sql, normalizedParams);
    if (results.length === 0 || results[0] == null || results[0].values.length === 0) return undefined;
    const cols = results[0].columns;
    const row = results[0].values[0];
    if (row == null) return undefined;
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  }

  all(...params: unknown[]): Record<string, unknown>[] {
    const normalizedParams = this.normalizeParams(params);
    const results = this.db.exec(this.sql, normalizedParams);
    if (results.length === 0 || results[0] == null) return [];
    const cols = results[0].columns;
    return results[0].values.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj;
    });
  }

  run(...params: unknown[]): { changes: number; lastInsertRowid: number } {
    const normalizedParams = this.normalizeParams(params);
    // Use exec instead of run for better parameter binding support
    this.db.exec(this.sql, normalizedParams);
    const changes = this.db.getRowsModified();
    const lastRow = this.db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = (lastRow[0]?.values[0]?.[0] as number) ?? 0;
    return { changes, lastInsertRowid };
  }
}