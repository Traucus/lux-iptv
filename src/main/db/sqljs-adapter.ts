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

  /** Write the in-memory snapshot to disk without closing. */
  flush(): void {
    if (this.filePath === ':memory:') return;
    const data = this.db.export();
    writeFileSync(this.filePath, Buffer.from(data));
  }

  close(): void {
    this.flush();
    this.db.close();
  }

  /** Expose the raw sql.js Database for drizzle-orm/sql.js */
  get raw(): SqlJsDatabase {
    return this.db;
  }

  /**
   * Reload the in-memory database from the on-disk file.
   * The ingest worker runs in a separate thread and writes to the same file.
   * Since sql.js databases are in-memory snapshots, the main process must
   * explicitly reload after the worker completes to see fresh data.
   */
  reload(): void {
    if (this.filePath === ':memory:') return;
    this.db.close();
    if (!sqlModule) throw new Error('sql.js module not initialized');
    if (existsSync(this.filePath)) {
      const buffer = readFileSync(this.filePath);
      this.db = new sqlModule.Database(new Uint8Array(buffer));
    } else {
      this.db = new sqlModule.Database();
    }
  }
}

class SqlJsCompatStatement {
  private db: SqlJsDatabase;
  private sql: string;
  private paramNames: string[];

  constructor(db: SqlJsDatabase, sql: string) {
    this.db = db;
    // Extract parameter names in order from :paramName patterns
    this.paramNames = [];
    this.sql = sql.replace(/:(\w+)/g, (_, name) => {
      this.paramNames.push(name);
      return '?';
    });
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

  private buildPositionalArgs(normalizedParams: any): unknown[] {
    // If already an array, use as-is (positional params)
    if (Array.isArray(normalizedParams)) {
      return normalizedParams;
    }
    // If object, build array in parameter order
    if (normalizedParams && typeof normalizedParams === 'object') {
      return this.paramNames.map(name => normalizedParams[name]);
    }
    return [];
  }

  get(...params: unknown[]): Record<string, unknown> | undefined {
    const normalizedParams = this.normalizeParams(params);
    const positionalArgs = this.buildPositionalArgs(normalizedParams);
    const results = this.db.exec(this.sql, positionalArgs);
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
    const positionalArgs = this.buildPositionalArgs(normalizedParams);
    const results = this.db.exec(this.sql, positionalArgs);
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
    const positionalArgs = this.buildPositionalArgs(normalizedParams);
    // Use exec with positional args - works reliably for DML and tracks changes
    this.db.exec(this.sql, positionalArgs);
    const changes = this.db.getRowsModified();
    const lastRow = this.db.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = (lastRow[0]?.values[0]?.[0] as number) ?? 0;
    return { changes, lastInsertRowid };
  }
}