import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchM3U, readLocalM3U } from '../../src/main/services/m3u-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const VALID_M3U = `#EXTM3U
#EXTINF:-1 tvg-id="cnn" tvg-logo="https://example.com/cnn.png" group-title="News",CNN
https://stream.example.com/cnn
#EXTINF:-1 tvg-id="bbc" tvg-logo="https://example.com/bbc.png" group-title="News",BBC
https://stream.example.com/bbc
#EXTINF:-1 group-title="Movies",Avatar
https://stream.example.com/movie/avatar
`;

describe('m3u-client', () => {
  describe('fetchM3U', () => {
    it('fetches and parses a valid M3U playlist', async () => {
      server.use(
        http.get('https://example.com/playlist.m3u', () => {
          return new HttpResponse(VALID_M3U, {
            headers: { 'Content-Type': 'application/x-mpegurl' },
          });
        }),
      );

      const entries = await fetchM3U('https://example.com/playlist.m3u');
      expect(entries).toHaveLength(3);
      expect(entries[0].name).toBe('CNN');
      expect(entries[0].url).toBe('https://stream.example.com/cnn');
      expect(entries[0].groupTitle).toBe('News');
      expect(entries[0].tvgId).toBe('cnn');
      expect(entries[0].tvgLogo).toBe('https://example.com/cnn.png');
    });

    it('skips malformed entries without crashing', async () => {
      const malformedM3U = `#EXTM3U
#EXTINF:-1 group-title="Good",Good Entry
https://stream.example.com/good
#EXTINF:-1
https://stream.example.com/no-name
#EXTINF:-1 group-title="Also Good",Also Good
https://stream.example.com/also-good
`;
      server.use(
        http.get('https://example.com/malformed.m3u', () => {
          return new HttpResponse(malformedM3U, {
            headers: { 'Content-Type': 'application/x-mpegurl' },
          });
        }),
      );

      const entries = await fetchM3U('https://example.com/malformed.m3u');
      // Should still parse the valid ones
      expect(entries.length).toBeGreaterThanOrEqual(2);
      expect(entries.some((e) => e.name === 'Good Entry')).toBe(true);
    });

    it('throws CONNECTION_ERROR on timeout', async () => {
      server.use(
        http.get('https://example.com/slow.m3u', async () => {
          await new Promise((resolve) => setTimeout(resolve, 20000));
          return new HttpResponse('');
        }),
      );

      await expect(fetchM3U('https://example.com/slow.m3u', { timeoutMs: 100 })).rejects.toThrow(
        /CONNECTION_ERROR|timeout/i,
      );
    });
  });

  describe('readLocalM3U', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm3u-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('reads a local .m3u file within allowed directory', async () => {
      const filePath = path.join(tmpDir, 'test.m3u');
      fs.writeFileSync(filePath, VALID_M3U);

      const entries = await readLocalM3U(filePath, tmpDir);
      expect(entries).toHaveLength(3);
    });

    it('reads a local .m3u8 file', async () => {
      const filePath = path.join(tmpDir, 'test.m3u8');
      fs.writeFileSync(filePath, VALID_M3U);

      const entries = await readLocalM3U(filePath, tmpDir);
      expect(entries).toHaveLength(3);
    });

    it('rejects files outside the allowed directory', async () => {
      const filePath = '/etc/passwd';
      await expect(readLocalM3U(filePath, tmpDir)).rejects.toThrow(/INVALID_INPUT|outside/i);
    });

    it('rejects files with invalid extension', async () => {
      const filePath = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(filePath, VALID_M3U);

      await expect(readLocalM3U(filePath, tmpDir)).rejects.toThrow(/INVALID_INPUT|extension/i);
    });

    it('rejects path traversal attempts', async () => {
      const filePath = path.join(tmpDir, '..', '..', 'etc', 'passwd');
      await expect(readLocalM3U(filePath, tmpDir)).rejects.toThrow(/INVALID_INPUT|outside/i);
    });
  });
});
