/**
 * m3u8-fixture-server — minimal local HTTP server that serves a static HLS
 * playlist + binary TS segments for player tests.
 *
 * Spec: media-harness §Playwright E2E Fixture with Local .m3u8 Server
 *  - Binds to 127.0.0.1 on an ephemeral port (no fixed port collisions).
 *  - Serves `/test.m3u8` (master playlist), `/media.m3u8` (variant),
 *    and `/segment{n}.ts` (188-byte MPEG-TS null packets).
 *  - Returns `{ url, port, close }` so test code can teardown.
 *
 * This is intentionally synchronous and free of test-runner APIs so it can
 * be reused from both Vitest (`tests/helpers`) and Playwright
 * (`tests/fixtures/playwright-fixtures.ts`).
 */
import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type M3u8FixtureServer = {
  url: string;
  port: number;
  close(): Promise<void>;
};

const MASTER_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
media.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
media.m3u8
`;

const VARIANT_PLAYLIST = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXTINF:6.0,
segment0.ts
#EXTINF:6.0,
segment1.ts
#EXTINF:6.0,
segment2.ts
#EXT-X-ENDLIST
`;

/** A single MPEG-TS null packet (188 bytes, sync byte 0x47). */
function makeNullPacket(): Buffer {
  const buf = Buffer.alloc(188);
  buf[0] = 0x47; // sync byte
  buf[1] = 0x40; // PUSI set, no field adaptation
  buf[2] = 0x00;
  buf[3] = 0x10; // CC=0
  // Rest is zero (null packet payload)
  return buf;
}

function send(res: ServerResponse, status: number, body: Buffer | string, contentType?: string): void {
  res.statusCode = status;
  if (contentType) res.setHeader('content-type', contentType);
  res.setHeader('content-length', String(Buffer.byteLength(body)));
  res.end(body);
}

/**
 * Starts a fixture m3u8 server on 127.0.0.1 with an ephemeral port.
 * Resolves once the server is bound and accepting requests.
 */
export function startM3u8FixtureServer(): Promise<M3u8FixtureServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? '/';
      if (url === '/test.m3u8') {
        send(res, 200, MASTER_PLAYLIST, 'application/vnd.apple.mpegurl');
        return;
      }
      if (url === '/media.m3u8') {
        send(res, 200, VARIANT_PLAYLIST, 'application/vnd.apple.mpegurl');
        return;
      }
      const segMatch = url.match(/^\/segment(\d+)\.ts$/);
      if (segMatch) {
        // 3 segments of 188 bytes each → 564 bytes total per request, enough
        // for a parser to detect a valid TS stream.
        const packet = makeNullPacket();
        const body = Buffer.concat([packet, packet, packet]);
        send(res, 200, body, 'video/mp2t');
        return;
      }
      send(res, 404, 'Not Found', 'text/plain');
    });

    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        port: addr.port,
        close() {
          return new Promise<void>((res2, rej) => {
            server.close((err) => (err ? rej(err) : res2()));
          });
        },
      });
    });
  });
}
