import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readLocalM3U, detectMediaFormat } from '../../src/main/services/m3u-client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * EXTVLCOPT is parsed by `iptv-m3u-playlist-parser` only when it appears
 * between the EXTINF line and the URL line (per parser.js logic).
 * The referrer key in the wire format is `http-referrer` (two r's), but
 * the parsed output field is `referer` (one r).
 */
const EXTVLCOPT_HINTS = `#EXTVLCOPT:http-user-agent=CustomAgent
#EXTVLCOPT:http-referrer=https://example.com
#EXTVLCOPT:http-cookie=session=abc123`;

describe('M3U parser — Entry.http capture', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm3u-http-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function writeAndParse(playlist: string) {
    const filePath = path.join(tmpDir, 'test.m3u');
    fs.writeFileSync(filePath, playlist);
    return readLocalM3U(filePath, tmpDir);
  }

  it('captures userAgent, referer, cookie from EXTVLCOPT', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="cnn" group-title="News",CNN
${EXTVLCOPT_HINTS}
https://stream.example.com/cnn.m3u8
`;
    const entries = await writeAndParse(playlist);
    expect(entries).toHaveLength(1);
    expect(entries[0].http).toEqual({
      headers: {},
      userAgent: 'CustomAgent',
      referer: 'https://example.com',
      cookie: 'session=abc123',
    });
  });

  it('captures only userAgent when only that EXTVLCOPT is present', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 group-title="Movies",Avatar
#EXTVLCOPT:http-user-agent=MovieAgent/1.0
https://stream.example.com/movie/avatar.mp4
`;
    const entries = await writeAndParse(playlist);
    expect(entries).toHaveLength(1);
    expect(entries[0].http).toEqual({
      headers: {},
      userAgent: 'MovieAgent/1.0',
    });
  });

  it('captures only cookie when only that EXTVLCOPT is present', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 group-title="Movies",Avatar
#EXTVLCOPT:http-cookie=session=abc123
https://stream.example.com/movie/avatar.mp4
`;
    const entries = await writeAndParse(playlist);
    expect(entries).toHaveLength(1);
    expect(entries[0].http).toEqual({
      headers: {},
      cookie: 'session=abc123',
    });
  });

  it('returns null for entries without EXTVLCOPT http directives', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="bbc" group-title="News",BBC
https://stream.example.com/bbc
`;
    const entries = await writeAndParse(playlist);
    expect(entries).toHaveLength(1);
    expect(entries[0].http).toBeNull();
  });

  it('forwards http hints only to the next entry, not subsequent ones', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 group-title="A",Channel A
#EXTVLCOPT:http-user-agent=OnlyForFirst
https://stream.example.com/a.m3u8
#EXTINF:-1 group-title="B",Channel B
https://stream.example.com/b.m3u8
`;
    const entries = await writeAndParse(playlist);
    expect(entries).toHaveLength(2);
    expect(entries[0].http).toEqual({ headers: {}, userAgent: 'OnlyForFirst' });
    expect(entries[1].http).toBeNull();
  });

  it('propagates mediaFormat alongside http for each entry', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 group-title="VOD",Movie
#EXTVLCOPT:http-user-agent=Agent
https://cdn.example.com/movie.mp4
#EXTINF:-1 group-title="Live",Channel
https://cdn.example.com/live.m3u8
`;
    const entries = await writeAndParse(playlist);
    expect(entries[0].mediaFormat).toBe('mp4');
    expect(entries[0].http).toEqual({ headers: {}, userAgent: 'Agent' });
    expect(entries[1].mediaFormat).toBe('hls');
    expect(entries[1].http).toBeNull();
  });

  it('preserves the existing tvg/group/url fields alongside http + mediaFormat', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1 tvg-id="cnn" tvg-logo="https://logo.example.com/cnn.png" group-title="News",CNN
#EXTVLCOPT:http-user-agent=Agent
https://stream.example.com/cnn.m3u8
`;
    const entries = await writeAndParse(playlist);
    expect(entries[0]).toMatchObject({
      name: 'CNN',
      url: 'https://stream.example.com/cnn.m3u8',
      groupTitle: 'News',
      tvgId: 'cnn',
      tvgLogo: 'https://logo.example.com/cnn.png',
      http: { headers: {}, userAgent: 'Agent' },
      mediaFormat: 'hls',
    });
  });
});

describe('M3U parser — mediaFormat integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'm3u-mf-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function writeAndParse(playlist: string) {
    const filePath = path.join(tmpDir, 'test.m3u');
    fs.writeFileSync(filePath, playlist);
    return readLocalM3U(filePath, tmpDir);
  }

  it('detects ts format on .ts URLs', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1,Raw TS
https://stream.example.com/raw.ts
`;
    const entries = await writeAndParse(playlist);
    expect(entries[0].mediaFormat).toBe('ts');
  });

  it('returns unknown for URLs with no recognized extension', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1,Mystery
https://stream.example.com/12345
`;
    const entries = await writeAndParse(playlist);
    expect(entries[0].mediaFormat).toBe('unknown');
  });

  it('still parses entries that lack an explicit name (parser falls back to URL)', async () => {
    const playlist = `#EXTM3U
#EXTINF:-1
https://stream.example.com/no-name.m3u8
#EXTINF:-1 group-title="G",Valid
https://stream.example.com/valid.m3u8
`;
    const entries = await writeAndParse(playlist);
    // The parser falls back to URL when no name is set, so the entry survives
    // but with a derived name. We accept this and only assert on the well-formed
    // entry that comes after.
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const valid = entries.find((e) => e.name === 'Valid');
    expect(valid).toBeDefined();
    expect(valid!.mediaFormat).toBe('hls');
  });
});

describe('detectMediaFormat (re-exported integration)', () => {
  it('is accessible from the public surface', () => {
    expect(detectMediaFormat('https://x.example.com/foo.m3u8')).toBe('hls');
  });
});
