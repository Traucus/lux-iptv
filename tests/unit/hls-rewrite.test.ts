import { describe, it, expect } from 'vitest';
import { rewritePlaylist, resolveSameOriginHttp } from '../../src/main/services/hls-rewrite';

const ctx = {
  type: 'live',
  id: 1,
  originUrl: 'https://cdn.example.com/live/cnn.m3u8',
};

describe('rewritePlaylist', () => {
  it('rewrites relative URI onto /proxy/{type}/{id}?u=', () => {
    const out = rewritePlaylist('#EXTM3U\n#EXTINF:4,\nseg0.ts\n', ctx);
    expect(out).toContain('/proxy/live/1?u=');
    expect(out).toContain(encodeURIComponent('https://cdn.example.com/live/seg0.ts'));
  });

  it('leaves absolute same-origin URIs unchanged', () => {
    const abs = 'https://cdn.example.com/live/seg0.ts';
    const out = rewritePlaylist(`#EXTM3U\n${abs}\n`, ctx);
    expect(out).toContain(abs);
    expect(out).not.toContain('/proxy/live/1?u=');
  });

  it('does not rewrite other-origin URIs onto the proxy', () => {
    const evil = 'https://evil.example/seg.ts';
    const out = rewritePlaylist(`#EXTM3U\n${evil}\n`, ctx);
    expect(out).toContain(evil);
    expect(out).not.toContain('/proxy/');
  });

  it('rewrites relative URI= on EXT-X-KEY', () => {
    const out = rewritePlaylist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.key"\n', ctx);
    expect(out).toMatch(/URI="\/proxy\/live\/1\?u=/);
  });
});

describe('resolveSameOriginHttp', () => {
  it('rejects a different origin', () => {
    expect(resolveSameOriginHttp('https://evil.example/x.ts', ctx.originUrl)).toBeNull();
  });

  it('accepts same-origin http(s)', () => {
    expect(resolveSameOriginHttp('https://cdn.example.com/live/seg0.ts', ctx.originUrl)).toBe(
      'https://cdn.example.com/live/seg0.ts',
    );
  });
});
