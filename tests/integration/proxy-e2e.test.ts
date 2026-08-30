import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import { StreamProxyService } from '../../src/main/services/stream-proxy';

// Mock the Electron net module
const { mockRequestFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
}));

vi.mock('electron', () => ({
  net: {
    request: mockRequestFn,
  },
  protocol: {
    handle: vi.fn(),
  },
  ipcMain: {
    on: vi.fn(),
    emit: vi.fn(),
    handle: vi.fn(),
  },
}));

describe('StreamProxyService - E2E Integration', () => {
  let db: SqlJsCompatDb;
  let service: StreamProxyService;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await initSqlJsModule();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up in-memory database with catalog tables
    db = createSqlJsDb(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(`
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
    `);

    // Insert test data
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('CNN', 'https://cdn.example.com/cnn.m3u8', JSON.stringify({ 'User-Agent': 'TestAgent' }), 'hls', 1000);

    db.prepare(
      `INSERT INTO vod_movies (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Avatar', 'https://cdn.example.com/avatar.mp4', JSON.stringify({ Cookie: 'session=abc123' }), 'mp4', 1000);

    mockRequest = mockRequestFn;
    service = new StreamProxyService((opts) => mockRequest(opts));
  });

  afterEach(async () => {
    await service.stop();
    db.close();
  });

  it('spins up service and proxies manifest request to mocked origin', async () => {
    const manifestBody = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
https://cdn.example.com/stream.m3u8`;

    const mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      on: vi.fn((event, cb) => {
        if (event === 'data') {
          setImmediate(() => cb(Buffer.from(manifestBody)));
        } else if (event === 'end') {
          setImmediate(() => cb());
        }
      }),
    };

    const mockRequestObj = {
      on: vi.fn((event, cb) => {
        if (event === 'response') setImmediate(() => cb(mockResponse));
      }),
      end: vi.fn(),
      setHeader: vi.fn(),
      setTimeout: vi.fn(),
    };

    mockRequest.mockReturnValue(mockRequestObj);

    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');

    const body = await response.text();
    expect(body).toBe(manifestBody);

    // Verify outbound request was made with correct URL
    expect(mockRequest).toHaveBeenCalledTimes(1);
    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.url).toBe('https://cdn.example.com/cnn.m3u8');
    expect(requestOptions.method).toBe('GET');
    expect(requestOptions.headers['User-Agent']).toBe('TestAgent');
  });

  it('proxies segment request (non-manifest) without caching', async () => {
    const segmentData = Buffer.from('fake-ts-segment-data');

    const mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'video/mp2t' },
      on: vi.fn((event, cb) => {
        if (event === 'data') {
          setImmediate(() => cb(segmentData));
        } else if (event === 'end') {
          setImmediate(() => cb());
        }
      }),
    };

    const mockRequestObj = {
      on: vi.fn((event, cb) => {
        if (event === 'response') setImmediate(() => cb(mockResponse));
      }),
      end: vi.fn(),
      setHeader: vi.fn(),
      setTimeout: vi.fn(),
    };

    mockRequest.mockReturnValue(mockRequestObj);

    await service.start(db);
    const port = service.getPort();

    // First request
    const response1 = await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
    expect(response1.status).toBe(200);
    const body1 = await response1.arrayBuffer();
    expect(Buffer.from(body1)).toEqual(segmentData);

    // Second request - should call outbound again (not cached)
    const response2 = await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
    expect(response2.status).toBe(200);
    const body2 = await response2.arrayBuffer();
    expect(Buffer.from(body2)).toEqual(segmentData);

    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('returns 404 for non-existent content', async () => {
    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/live/999`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe('Content not found');
  });

  it('returns 400 for invalid ID', async () => {
    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/live/abc`);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe('Invalid ID');
  });

  it('returns 404 for invalid content type', async () => {
    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/invalid/1`);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.error).toBe('Invalid content type');
  });

  it('health endpoint works', async () => {
    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/health`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  it('injects custom headers from http_headers.headers object', async () => {
    // Insert a row with custom headers
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Custom', 'https://cdn.example.com/custom.m3u8', JSON.stringify({
      headers: { 'X-Custom-Header': 'custom-value', 'X-Another': 'another' }
    }), 'hls', 1000);

    const mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      on: vi.fn((event, cb) => {
        if (event === 'data') {
          setImmediate(() => cb(Buffer.from('#EXTM3U\n')));
        } else if (event === 'end') {
          setImmediate(() => cb());
        }
      }),
    };

    const mockRequestObj = {
      on: vi.fn((event, cb) => {
        if (event === 'response') setImmediate(() => cb(mockResponse));
      }),
      end: vi.fn(),
      setHeader: vi.fn(),
      setTimeout: vi.fn(),
    };

    mockRequest.mockReturnValue(mockRequestObj);

    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/live/2`);
    expect(response.status).toBe(200);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Custom-Header']).toBe('custom-value');
    expect(requestOptions.headers['X-Another']).toBe('another');
  });

  it('rejects invalid header keys in custom headers', async () => {
    // Insert a row with malicious custom header keys
    db.prepare(
      `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('Malicious', 'https://cdn.example.com/mal.m3u8', JSON.stringify({
      headers: { 'X-Valid': 'ok', 'X-Invalid-Header!': 'bad', 'Transfer-Encoding': 'chunked' }
    }), 'hls', 1000);

    const mockResponse = {
      statusCode: 200,
      headers: { 'content-type': 'application/vnd.apple.mpegurl' },
      on: vi.fn((event, cb) => {
        if (event === 'data') {
          setImmediate(() => cb(Buffer.from('#EXTM3U\n')));
        } else if (event === 'end') {
          setImmediate(() => cb());
        }
      }),
    };

    const mockRequestObj = {
      on: vi.fn((event, cb) => {
        if (event === 'response') setImmediate(() => cb(mockResponse));
      }),
      end: vi.fn(),
      setHeader: vi.fn(),
      setTimeout: vi.fn(),
    };

    mockRequest.mockReturnValue(mockRequestObj);

    await service.start(db);
    const port = service.getPort();

    const response = await fetch(`http://127.0.0.1:${port}/proxy/live/2`);
    expect(response.status).toBe(200);

    const requestOptions = mockRequest.mock.calls[0][0];
    expect(requestOptions.headers['X-Valid']).toBe('ok');
    expect(requestOptions.headers['X-Invalid-Header!']).toBeUndefined();
    expect(requestOptions.headers['Transfer-Encoding']).toBeUndefined();
  });
});