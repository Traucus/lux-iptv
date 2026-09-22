import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { StreamProxyService } from '../../src/main/services/stream-proxy';
import type { SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import {
  initProxySql,
  openSeededProxyDb,
  createProxyService,
  mockOriginResponse,
} from './stream-proxy/harness';

const { mockRequestFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
}));

vi.mock('electron', () => ({
  net: { request: mockRequestFn },
  protocol: { handle: vi.fn() },
  ipcMain: { on: vi.fn(), emit: vi.fn(), handle: vi.fn() },
}));

describe('StreamProxyService', () => {
  let db: SqlJsCompatDb;
  let service: StreamProxyService;
  let mockRequest: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await initProxySql();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db = openSeededProxyDb();
    mockRequest = mockRequestFn;
    service = createProxyService(mockRequestFn);
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
      await service.start(db);
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
      mockOriginResponse(mockRequest, { contentType: 'application/vnd.apple.mpegurl' });
      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(response.status).toBe(200);
      expect(mockRequest).toHaveBeenCalled();
      const requestOptions = mockRequest.mock.calls[0][0] as { headers: Record<string, string> };
      expect(requestOptions.headers['User-Agent']).toBe('TestAgent');
      expect(requestOptions.headers['Referer']).toBe('https://example.com');
    });

    it('injects Cookie header when present', async () => {
      mockOriginResponse(mockRequest, { contentType: 'video/mp4', body: 'fake-video-data' });
      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
      expect(response.status).toBe(200);
      const requestOptions = mockRequest.mock.calls[0][0] as { headers: Record<string, string> };
      expect(requestOptions.headers['Cookie']).toBe('session=abc123');
    });

    it('rejects invalid header keys (header injection safety)', async () => {
      db.prepare(
        `INSERT INTO live_channels (name, url, http_headers, media_format, added_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(
        'Malicious',
        'https://cdn.example.com/mal.m3u8',
        JSON.stringify({
          'User-Agent': 'Valid',
          'X-Injected-Header': 'malicious',
          'Transfer-Encoding': 'chunked',
          'Content-Length': '100',
        }),
        'hls',
        1000,
      );
      mockOriginResponse(mockRequest, { contentType: 'application/vnd.apple.mpegurl' });
      const port = service.getPort();
      const response = await fetch(`http://127.0.0.1:${port}/proxy/live/2`);
      expect(response.status).toBe(200);
      const requestOptions = mockRequest.mock.calls[0][0] as { headers: Record<string, string> };
      expect(requestOptions.headers['User-Agent']).toBe('Valid');
      expect(requestOptions.headers['X-Injected-Header']).toBeUndefined();
      expect(requestOptions.headers['Transfer-Encoding']).toBeUndefined();
      expect(requestOptions.headers['Content-Length']).toBeUndefined();
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
      const headers = await service.lookupHeaders('unknown', 1);
      expect(headers).toEqual({});
    });

    it('returns empty object for non-existent id', async () => {
      const headers = await service.lookupHeaders('live', 999);
      expect(headers).toEqual({});
    });
  });
});
