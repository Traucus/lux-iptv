import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { StreamProxyService } from '../../../src/main/services/stream-proxy';
import type { SqlJsCompatDb } from '../../../src/main/db/sqljs-adapter.js';
import {
  initProxySql,
  openSeededProxyDb,
  createProxyService,
  mockStreamingOrigin,
} from './harness';

const { mockRequestFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
}));

vi.mock('electron', () => ({
  net: { request: mockRequestFn },
  protocol: { handle: vi.fn() },
  ipcMain: { on: vi.fn(), emit: vi.fn(), handle: vi.fn() },
}));

describe('StreamProxyService HLS rewrite and origin body errors', () => {
  let db: SqlJsCompatDb;
  let service: StreamProxyService;

  beforeAll(async () => {
    await initProxySql();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    db = openSeededProxyDb();
    service = createProxyService(mockRequestFn);
  });

  afterEach(async () => {
    await service.stop();
    db.close();
  });

  describe('HLS rewrite and segment streaming', () => {
    beforeEach(async () => {
      await service.start(db);
    });

    it('rewrites relative playlist URIs onto the proxy', async () => {
      mockStreamingOrigin(mockRequestFn, '#EXTM3U\n#EXTINF:4,\nseg0.ts\n', 'application/vnd.apple.mpegurl');
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1`);
      const text = await response.text();
      expect(text).toContain('/proxy/live/1?u=');
      expect(text).toContain(encodeURIComponent('https://cdn.example.com/seg0.ts'));
    });

    it('streams segments without fully buffering the origin body', async () => {
      const { flushEnd } = mockStreamingOrigin(
        mockRequestFn,
        Buffer.from('chunk-1-segment-bytes'),
        'video/MP2T',
        true,
      );
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
      expect(mockRequestFn).not.toHaveBeenCalled();
    });
  });

  describe('origin body errors (content-length mismatch class)', () => {
    it('ends the player response when origin emits error after headers', async () => {
      await service.start(db);
      mockRequestFn.mockReturnValue({
        on: vi.fn((event: string, cb: (arg: unknown) => void) => {
          if (event !== 'response') return;
          setImmediate(() => {
            cb({
              statusCode: 200,
              headers: { 'content-type': 'video/mp4' },
              on: vi.fn((ev: string, dataCb: (arg?: unknown) => void) => {
                if (ev === 'data') setImmediate(() => dataCb(Buffer.from('partial')));
                if (ev === 'error') setImmediate(() => dataCb(new Error('net::ERR_CONTENT_LENGTH_MISMATCH')));
              }),
            });
          });
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
