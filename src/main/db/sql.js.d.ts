declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database;
  }

  interface Database {
    run(sql: string, params?: Record<string, unknown> | unknown[]): void;
    exec(sql: string, params?: Record<string, unknown> | unknown[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export default function initSqlJs(): Promise<SqlJsStatic>;
  export type { Database, SqlJsStatic, QueryExecResult };
}
