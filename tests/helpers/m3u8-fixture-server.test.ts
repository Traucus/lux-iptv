/**
 * m3u8-fixture-server contract.
 *
 * Spec: media-harness §Playwright E2E Fixture with Local .m3u8 Server
 *  - A local HTTP server MUST serve `/test.m3u8` (master playlist),
 *    `/media.m3u8` (variant), and `/segment{n}.ts` (binary segments).
 *  - The server MUST bind to 127.0.0.1 on an ephemeral port.
 *  - `start()` returns `{ url, close }` so test code can teardown cleanly.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { startM3u8FixtureServer, type M3u8FixtureServer } from './m3u8-fixture-server';

describe('m3u8-fixture-server', () => {
  let server: M3u8FixtureServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = null;
    }
  });

  it('binds to 127.0.0.1 on an ephemeral port and returns a URL', async () => {
    server = await startM3u8FixtureServer();
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(server.port).toBeGreaterThan(0);
  });

  it('serves a valid master HLS playlist at /test.m3u8', async () => {
    server = await startM3u8FixtureServer();
    const res = await fetch(`${server.url}/test.m3u8`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/(vnd\.apple\.mpegurl|x-mpegurl)/);
    const body = await res.text();
    expect(body).toMatch(/#EXTM3U/);
    expect(body).toMatch(/#EXT-X-STREAM-INF/);
    expect(body).toMatch(/media\.m3u8/);
  });

  it('serves a variant playlist at /media.m3u8 with at least one segment', async () => {
    server = await startM3u8FixtureServer();
    const res = await fetch(`${server.url}/media.m3u8`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/#EXTM3U/);
    expect(body).toMatch(/#EXTINF:/);
    expect(body).toMatch(/segment\d+\.ts/);
  });

  it('serves a 188-byte binary TS segment at /segment0.ts', async () => {
    server = await startM3u8FixtureServer();
    const res = await fetch(`${server.url}/segment0.ts`);
    expect(res.status).toBe(200);
    const buf = new Uint8Array(await res.arrayBuffer());
    // MPEG-TS sync byte is 0x47, and a real TS packet is 188 bytes.
    expect(buf.length).toBeGreaterThanOrEqual(188);
    expect(buf[0]).toBe(0x47);
  });

  it('returns 404 for unknown paths', async () => {
    server = await startM3u8FixtureServer();
    const res = await fetch(`${server.url}/no-such-route.m3u8`);
    expect(res.status).toBe(404);
  });

  it('close() shuts the server down (subsequent requests reject)', async () => {
    const s = await startM3u8FixtureServer();
    const url = s.url;
    await s.close();
    server = null;
    await expect(fetch(`${url}/test.m3u8`)).rejects.toThrow();
  });
});
