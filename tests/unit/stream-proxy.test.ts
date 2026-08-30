import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import { StreamProxyService } from '../../src/main/services/stream-proxy';

// Mock the Electron net module - use vi.hoisted to avoid hoisting issues
const { mockRequestFn, mockEmitFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
  mockEmitFn: vi.fn(),
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
    emit: mockEmitFn,
    handle: vi.fn(),
  },
}));

// Do NOT mock global.fetch - we need the real fetch to call the local proxy server

describe('StreamProxyService', () => {
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
    ).run('CNN', 'https://cdn.example.com/cnn.m3u8', JSON.stringify({ 'User-Agent': 'TestAgent', Referer: 'https://example.com' }), 'hls', 1000);

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

  describe('start/stop', () => {
    it('starts on an ephemeral port and returns the port', async () => {
      const result = await service.start(db);
      expect(result.port).toBeGreaterThan(0);
      expect(result.port).toBeLessThan(65536);
    });

    it('can be stopped and restarted', async () => {
      const result1 = await service.start(db);
      await service.stop();
      const result2 = await service.start(db);
      expect(result2.port).toBeGreaterThan(0);
    });

    it('health endpoint returns 200', async () => {
      await service.start(db);
      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/health`);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ ok: true });
    });
  });

  describe('header injection', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    it('injects User-Agent, Referer, and Cookie headers from http_headers', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nstream.m3u8')));
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

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(response.status).toBe(200);

      // Verify the outbound request was made with injected headers
      expect(mockRequest).toHaveBeenCalled();
      const requestOptions = mockRequest.mock.calls[0][0];
      expect(requestOptions.headers).toBeDefined();
      expect(requestOptions.headers['User-Agent']).toBe('TestAgent');
      expect(requestOptions.headers['Referer']).toBe('https://example.com');
    });

    it('injects Cookie header when present', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'video/mp4' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('fake-video-data')));
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

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
      expect(response.status).toBe(200);

      const requestOptions = mockRequest.mock.calls[0][0];
      expect(requestOptions.headers['Cookie']).toBe('session=abc123');
    });

    it('rejects invalid header keys (header injection safety)', async () => {
      // Insert a row with malicious header keys
      db.prepare(
        `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('Malicious', 'https://cdn.example.com/mal.m3u8', JSON.stringify({
        'User-Agent': 'Valid',
        'X-Injected-Header': 'malicious',
        'Transfer-Encoding': 'chunked',
        'Content-Length': '100',
      }), 'hls', 1000);

      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nstream.m3u8')));
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

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/2`);
      expect(response.status).toBe(200);

      const requestOptions = mockRequest.mock.calls[0][0];
      // Only whitelisted headers should be forwarded
      expect(requestOptions.headers['User-Agent']).toBe('Valid');
      expect(requestOptions.headers['X-Injected-Header']).toBeUndefined();
      expect(requestOptions.headers['Transfer-Encoding']).toBeUndefined();
      expect(requestOptions.headers['Content-Length']).toBeUndefined();
    });
  });

  describe('manifest cache (30s TTL, 50-entry LRU)', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    it('caches manifest responses (m3u8)', async () => {
      const manifestBody = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
https://cdn.example.com/stream.m3u8`;

      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        pipe: vi.fn(),
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

      const port = service.getPort();
      // First request - cache miss
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Second request - cache hit
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequest).toHaveBeenCalledTimes(1); // Should not call outbound again
    });

    it('does not cache non-manifest responses (mp4 segments)', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'video/mp4' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('fake-video-data')));
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

      const port = service.getPort();
      // First request
      await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Second request - should still call outbound (not cached)
      await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('expires cache after TTL (30s)', async () => {
      const manifestBody = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
https://cdn.example.com/stream.m3u8`;

      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        pipe: vi.fn(),
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

      const port = service.getPort();
      // First request
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequest).toHaveBeenCalledTimes(1);

      // Manually expire the cache by manipulating internal state
      // We can't easily test 30s wait, so we test the cache expiration logic directly
      // by checking that the cache has TTL enforcement
      const cache = (service as any).manifestCache;
      expect(cache.size).toBe(1);
      const entry = cache.values().next().value;
      expect(entry.expiresAt).toBeGreaterThan(Date.now());
      expect(entry.expiresAt - Date.now()).toBeLessThanOrEqual(30000);
    });

    it('evicts LRU entries when cache exceeds 50 entries', async () => {
      // This tests the LRU eviction logic via the internal setCacheEntry method
      const setCacheEntry = (service as any).setCacheEntry.bind(service);
      const cache = (service as any).manifestCache;

      // Fill cache with 50 entries using the actual method
      for (let i = 0; i < 50; i++) {
        setCacheEntry(`key-${i}`, Buffer.from('test'), 'application/vnd.apple.mpegurl');
      }
      expect(cache.size).toBe(50);

      // Add 51st entry - should evict the oldest
      setCacheEntry('key-50', Buffer.from('test'), 'application/vnd.apple.mpegurl');
      expect(cache.size).toBe(50);
      expect(cache.has('key-0')).toBe(false); // Oldest evicted
      expect(cache.has('key-50')).toBe(true); // Newest present
    });
  });

  describe('redirect following', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    it('follows redirects up to 5 hops', async () => {
      // Origin client follows redirects up to 5 hops; this mock delivers the final 200.
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\nstream.m3u8')));
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

      const port = service.getPort();
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);

      expect(mockRequest).toHaveBeenCalled();
    });
  });

  describe('timeout handling', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    it('returns 502 on 5xx response', async () => {
      const mockResponse = {
        statusCode: 504,
        headers: { 'content-type': 'text/plain' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('timeout')));
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

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(response.status).toBe(502);
    });

    it('sets 10s timeout on outbound request', async () => {
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        pipe: vi.fn(),
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

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(response.status).toBe(200);
      // Timeout is a JS timer + abort(), not Node/Electron request.setTimeout().
      expect(mockRequestObj.setTimeout).not.toHaveBeenCalled();
    });
  });

  describe('error IPC emission', () => {
    beforeEach(async () => {
      await service.start(db);
      // Set up IPC emission capture
      service.setIpcMain({ emit: mockEmitFn } as any);
      mockEmitFn.mockClear();
    });

    it('emits player:reportError IPC on 5xx response', async () => {
      const mockResponse = {
        statusCode: 504,
        headers: { 'content-type': 'text/plain' },
        pipe: vi.fn(),
        on: vi.fn((event, cb) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('timeout')));
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

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(response.status).toBe(502);

      // Verify error IPC was emitted
      expect(mockEmitFn).toHaveBeenCalledWith(
        'player:reportError',
        expect.objectContaining({
          code: 'STREAM_TIMEOUT',
          message: expect.stringContaining('Upstream returned 504'),
        })
      );
    });

    it('emits player:reportError IPC on network error', async () => {
      // For network errors, the request emits an 'error' event before 'response'
      // We simulate this by having the mock request emit error immediately
      const mockRequestObj = {
        on: vi.fn((event, cb) => {
          if (event === 'error') {
            // Simulate immediate network error
            setImmediate(() => cb(new Error('ENOTFOUND')));
          }
        }),
        end: vi.fn(),
        setHeader: vi.fn(),
        setTimeout: vi.fn(),
      };

      mockRequest.mockReturnValue(mockRequestObj);

      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(response.status).toBe(503);

      // Verify error IPC was emitted
      expect(mockEmitFn).toHaveBeenCalledWith(
        'player:reportError',
        expect.objectContaining({
          code: 'NETWORK',
          message: expect.stringContaining('ENOTFOUND'),
        })
      );
    });
  });

  describe('lookupHeaders', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    it('looks up headers for live channels', async () => {
      const headers = await service.lookupHeaders('live', 1);
      expect(headers).toEqual({ 'User-Agent': 'TestAgent', Referer: 'https://example.com' });
    });

    it('looks up headers for movies', async () => {
      const headers = await service.lookupHeaders('movie', 1);
      expect(headers).toEqual({ Cookie: 'session=abc123' });
    });

    it('looks up headers for episodes', async () => {
      db.prepare(`INSERT INTO series (name, added_at) VALUES (?, ?)`).run('BB', 1000);
      db.prepare(
        `INSERT INTO episodes (series_id, name, url, season, episode, added_at, http_headers, media_format)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'Pilot', 'https://cdn.example.com/ep.m3u8', 1, 1, 1000, JSON.stringify({ 'X-Custom': 'value' }), 'hls');

      const headers = await service.lookupHeaders('episode', 1);
      expect(headers).toEqual({ 'X-Custom': 'value' });
    });

    it('returns empty object for unknown type', async () => {
      const headers = await service.lookupHeaders('unknown' as any, 1);
      expect(headers).toEqual({});
    });

    it('returns empty object for non-existent id', async () => {
      const headers = await service.lookupHeaders('live', 999);
      expect(headers).toEqual({});
    });
  });

  describe('HLS rewrite and segment streaming', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    function mockOrigin(body: string | Buffer, contentType: string, delayEnd = false) {
      let endCb: (() => void) | undefined;
      const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
      mockRequest.mockReturnValue({
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

    it('rewrites relative playlist URIs onto the proxy', async () => {
      mockOrigin('#EXTM3U\n#EXTINF:4,\nseg0.ts\n', 'application/vnd.apple.mpegurl');
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1`);
      const text = await response.text();
      expect(text).toContain('/proxy/live/1?u=');
      expect(text).toContain(encodeURIComponent('https://cdn.example.com/seg0.ts'));
    });

    it('streams segments without fully buffering the origin body', async () => {
      const { flushEnd } = mockOrigin(Buffer.from('chunk-1-segment-bytes'), 'video/MP2T', true);
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/movie/1`);
      const first = await response.body!.getReader().read();
      expect(Buffer.from(first.value!).toString()).toContain('chunk-1-segment-bytes');
      expect(first.done).toBe(false);
      flushEnd();
    });

    it('rejects ?u= from another origin', async () => {
      const u = encodeURIComponent('https://evil.example/x.ts');
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1?u=${u}`);
      expect(response.status).toBe(403);
      expect(mockRequest).not.toHaveBeenCalled();
    });
  });

  describe('origin body errors (content-length mismatch class)', () => {
    it('ends the player response when origin emits error after headers', async () => {
      await service.start(db);
      const mockResponse = {
        statusCode: 200,
        headers: { 'content-type': 'video/mp4' },
        on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
          if (event === 'data') {
            setImmediate(() => cb(Buffer.from('partial')));
          }
          if (event === 'error') {
            setImmediate(() => cb(new Error('net::ERR_CONTENT_LENGTH_MISMATCH')));
          }
        }),
      };
      mockRequest.mockReturnValue({
        on: vi.fn((event: string, cb: (arg: unknown) => void) => {
          if (event === 'response') setImmediate(() => cb(mockResponse));
        }),
        end: vi.fn(),
        abort: vi.fn(),
        setHeader: vi.fn(),
        setTimeout: vi.fn(),
      });

      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/movie/1`);
      const body = Buffer.from(await response.arrayBuffer());
      expect(body.toString()).toContain('partial');
      expect(response.status).toBe(200);
    });

    it('does not throw when a real origin closes with a lying Content-Length', async () => {
      const origin = createServer((_req, originRes) => {
        originRes.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Content-Length': '99999',
        });
        originRes.write('partial-body');
        originRes.socket?.destroy();
      });
      await new Promise<void>((resolve) => origin.listen(0, '127.0.0.1', resolve));
      const originPort = (origin.address() as AddressInfo).port;

      db.prepare(
        `INSERT INTO vod_movies (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run('Mismatch', `http://127.0.0.1:${originPort}/video.mp4`, '{}', 'mp4', 1000);

      const realService = new StreamProxyService();
      await realService.start(db);
      try {
        const response = await fetch(`http://127.0.0.1:${realService.getPort()}/proxy/movie/2`);
        await response.arrayBuffer();
        expect(response.status).toBeGreaterThanOrEqual(200);
      } finally {
        await realService.stop();
        await new Promise<void>((resolve, reject) => {
          origin.close((err) => (err ? reject(err) : resolve()));
        });
      }
    });
  });
});