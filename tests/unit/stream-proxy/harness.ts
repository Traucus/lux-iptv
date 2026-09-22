import { vi } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../../src/main/db/sqljs-adapter.js';
import { StreamProxyService } from '../../../src/main/services/stream-proxy';

const PROXY_SCHEMA = `
  CREATE TABLE live_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    http_headers TEXT NOT NULL DEFAULT '{}',
    media_format TEXT NOT NULL DEFAULT 'unknown',
    added_at INTEGER NOT NULL
  );
  CREATE TABLE vod_movies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    http_headers TEXT NOT NULL DEFAULT '{}',
    media_format TEXT NOT NULL DEFAULT 'unknown',
    added_at INTEGER NOT NULL
  );
  CREATE TABLE series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT UNIQUE,
    http_headers TEXT NOT NULL DEFAULT '{}',
    media_format TEXT NOT NULL DEFAULT 'unknown',
    added_at INTEGER NOT NULL
  );
  CREATE TABLE episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    season INTEGER NOT NULL,
    episode INTEGER NOT NULL,
    cover TEXT,
    http_headers TEXT NOT NULL DEFAULT '{}',
    media_format TEXT NOT NULL DEFAULT 'unknown',
    added_at INTEGER NOT NULL,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
  );
`;

export async function initProxySql(): Promise<void> {
  await initSqlJsModule();
}

export function openSeededProxyDb(): SqlJsCompatDb {
  const db = createSqlJsDb(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(PROXY_SCHEMA);
  db.prepare(
    `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    'CNN',
    'https://cdn.example.com/cnn.m3u8',
    JSON.stringify({ 'User-Agent': 'TestAgent', Referer: 'https://example.com' }),
    'hls',
    1000,
  );
  db.prepare(
    `INSERT INTO vod_movies (name, url, http_headers, media_format, added_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run('Avatar', 'https://cdn.example.com/avatar.mp4', JSON.stringify({ Cookie: 'session=abc123' }), 'mp4', 1000);
  return db;
}

export function createProxyService(requestFn: (opts: unknown) => unknown): StreamProxyService {
  return new StreamProxyService((opts) => requestFn(opts));
}

type RequestFn = ReturnType<typeof vi.fn>;

export function mockOriginResponse(
  requestFn: RequestFn,
  options: {
    statusCode?: number;
    contentType?: string;
    body?: string | Buffer;
    errorBeforeResponse?: Error;
  },
): { setTimeout: ReturnType<typeof vi.fn> } {
  const statusCode = options.statusCode ?? 200;
  const contentType = options.contentType ?? 'application/vnd.apple.mpegurl';
  const body = options.body ?? '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nstream.m3u8';
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const request = {
    on: vi.fn((event: string, cb: (arg: unknown) => void) => {
      if (event === 'error' && options.errorBeforeResponse) {
        setImmediate(() => cb(options.errorBeforeResponse));
        return;
      }
      if (event !== 'response' || options.errorBeforeResponse) return;
      setImmediate(() => {
        cb({
          statusCode,
          headers: { 'content-type': contentType },
          pipe: vi.fn(),
          on: vi.fn((ev: string, dataCb: (arg?: Buffer) => void) => {
            if (ev === 'data') setImmediate(() => dataCb(payload));
            else if (ev === 'end') setImmediate(() => dataCb());
          }),
        });
      });
    }),
    end: vi.fn(),
    abort: vi.fn(),
    setHeader: vi.fn(),
    setTimeout: vi.fn(),
  };
  requestFn.mockReturnValue(request);
  return request;
}

export function mockStreamingOrigin(
  requestFn: RequestFn,
  body: string | Buffer,
  contentType: string,
  delayEnd = false,
) {
  let endCb: (() => void) | undefined;
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  requestFn.mockReturnValue({
    on: vi.fn((event: string, cb: (arg: unknown) => void) => {
      if (event !== 'response') return;
      setImmediate(() => {
        cb({
          statusCode: 200,
          headers: { 'content-type': contentType },
          pipe: vi.fn(),
          on: vi.fn((ev: string, dataCb: (arg?: Buffer) => void) => {
            if (ev === 'data') setImmediate(() => dataCb(payload));
            else if (ev === 'end') {
              if (delayEnd) endCb = dataCb as () => void;
              else setImmediate(() => dataCb());
            }
          }),
        });
      });
    }),
    end: vi.fn(),
    abort: vi.fn(),
    setHeader: vi.fn(),
    setTimeout: vi.fn(),
  });
  return { flushEnd: () => endCb?.() };
}
