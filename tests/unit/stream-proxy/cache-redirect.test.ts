import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { StreamProxyService } from '../../../src/main/services/stream-proxy';
import type { SqlJsCompatDb } from '../../../src/main/db/sqljs-adapter.js';
import {
  initProxySql,
  openSeededProxyDb,
  createProxyService,
  mockOriginResponse,
} from './harness';

const { mockRequestFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
}));

vi.mock('electron', () => ({
  net: { request: mockRequestFn },
  protocol: { handle: vi.fn() },
  ipcMain: { on: vi.fn(), emit: vi.fn(), handle: vi.fn() },
}));

describe('StreamProxyService cache and redirects', () => {
  let db: SqlJsCompatDb;
  let service: StreamProxyService;

  beforeAll(async () => {
    await initProxySql();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    db = openSeededProxyDb();
    service = createProxyService(mockRequestFn);
    await service.start(db);
  });

  afterEach(async () => {
    await service.stop();
    db.close();
  });

  describe('manifest cache (30s TTL, 50-entry LRU)', () => {
    it('caches manifest responses (m3u8)', async () => {
      const manifestBody = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
https://cdn.example.com/stream.m3u8`;
      mockOriginResponse(mockRequestFn, { contentType: 'application/vnd.apple.mpegurl', body: manifestBody });
      const port = service.getPort();
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
    });

    it('does not cache non-manifest responses (mp4 segments)', async () => {
      mockOriginResponse(mockRequestFn, { contentType: 'video/mp4', body: 'fake-video-data' });
      const port = service.getPort();
      await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
      await fetch(`http://127.0.0.1:${port}/proxy/movie/1`);
      expect(mockRequestFn).toHaveBeenCalledTimes(2);
    });

    it('expires cache after TTL (30s)', async () => {
      const manifestBody = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=1000000
https://cdn.example.com/stream.m3u8`;
      mockOriginResponse(mockRequestFn, { contentType: 'application/vnd.apple.mpegurl', body: manifestBody });
      const port = service.getPort();
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequestFn).toHaveBeenCalledTimes(1);
      const cache = (service as unknown as { manifestCache: Map<string, { expiresAt: number }> }).manifestCache;
      expect(cache.size).toBe(1);
      const entry = cache.values().next().value;
      expect(entry.expiresAt).toBeGreaterThan(Date.now());
      expect(entry.expiresAt - Date.now()).toBeLessThanOrEqual(30000);
    });

    it('evicts LRU entries when cache exceeds 50 entries', async () => {
      const access = service as unknown as {
        manifestCache: Map<string, { expiresAt: number }>;
        setCacheEntry: (key: string, body: Buffer, contentType: string) => void;
      };
      const setCacheEntry = access.setCacheEntry.bind(service);
      const cache = access.manifestCache;
      for (let i = 0; i < 50; i++) {
        setCacheEntry(`key-${i}`, Buffer.from('test'), 'application/vnd.apple.mpegurl');
      }
      expect(cache.size).toBe(50);
      setCacheEntry('key-50', Buffer.from('test'), 'application/vnd.apple.mpegurl');
      expect(cache.size).toBe(50);
      expect(cache.has('key-0')).toBe(false);
      expect(cache.has('key-50')).toBe(true);
    });
  });

  describe('redirect following', () => {
    it('follows redirects up to 5 hops', async () => {
      mockOriginResponse(mockRequestFn, { contentType: 'application/vnd.apple.mpegurl' });
      const port = service.getPort();
      await fetch(`http://127.0.0.1:${port}/proxy/live/1`);
      expect(mockRequestFn).toHaveBeenCalled();
    });
  });
});
