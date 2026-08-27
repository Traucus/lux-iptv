import { describe, it, expect } from 'vitest';
import { detectMediaFormat } from '../../src/main/services/m3u-client';

describe('detectMediaFormat', () => {
  describe('recognized extensions', () => {
    it('maps .m3u8 to hls', () => {
      expect(detectMediaFormat('https://cdn.example.com/live/ch1.m3u8')).toBe('hls');
    });

    it('maps .mp4 to mp4', () => {
      expect(detectMediaFormat('https://cdn.example.com/vod/movie.mp4')).toBe('mp4');
    });

    it('maps .mpd to dash', () => {
      expect(detectMediaFormat('https://cdn.example.com/manifest.mpd')).toBe('dash');
    });

    it('maps .ts to ts', () => {
      expect(detectMediaFormat('https://cdn.example.com/segment.ts')).toBe('ts');
    });
  });

  describe('query strings & fragments', () => {
    it('strips query string before matching (.m3u8)', () => {
      expect(detectMediaFormat('https://cdn.example.com/live/ch1.m3u8?token=abc')).toBe('hls');
    });

    it('strips query string before matching (.mp4)', () => {
      expect(detectMediaFormat('https://cdn.example.com/vod/movie.mp4?token=abc&exp=1700000000')).toBe('mp4');
    });

    it('strips fragment before matching (.mpd)', () => {
      expect(detectMediaFormat('https://cdn.example.com/manifest.mpd#segment')).toBe('dash');
    });

    it('handles query string with no extension', () => {
      expect(detectMediaFormat('https://cdn.example.com/stream/12345?session=xyz')).toBe('unknown');
    });
  });

  describe('case insensitivity', () => {
    it('uppercase .M3U8 maps to hls', () => {
      expect(detectMediaFormat('https://cdn.example.com/CH1.M3U8')).toBe('hls');
    });

    it('mixed case .Mp4 maps to mp4', () => {
      expect(detectMediaFormat('https://cdn.example.com/MOVIE.Mp4')).toBe('mp4');
    });
  });

  describe('unknown / malformed', () => {
    it('returns unknown for URL with no extension', () => {
      expect(detectMediaFormat('https://cdn.example.com/stream/12345')).toBe('unknown');
    });

    it('returns unknown for unrecognized extension', () => {
      expect(detectMediaFormat('https://cdn.example.com/movie.avi')).toBe('unknown');
    });

    it('returns unknown for empty string', () => {
      expect(detectMediaFormat('')).toBe('unknown');
    });

    it('returns unknown for an extension in the path but not at the end', () => {
      // Path has .m3u8 in a directory but no extension on the final segment.
      expect(detectMediaFormat('https://cdn.example.com/.m3u8/segment')).toBe('unknown');
    });

    it('returns unknown for invalid URL (defensive fallback)', () => {
      expect(detectMediaFormat('not a url at all')).toBe('unknown');
    });
  });

  describe('real-world shapes', () => {
    it('handles Xtream-style /live/user/pass/id.ts URLs', () => {
      expect(detectMediaFormat('https://example.com/live/user/pass/12345.ts')).toBe('ts');
    });

    it('handles Xtream-style /movie/user/pass/id.mp4 URLs', () => {
      expect(detectMediaFormat('https://example.com/movie/user/pass/12345.mp4')).toBe('mp4');
    });

    it('handles HLS chunklist.m3u8 with query', () => {
      expect(detectMediaFormat('https://cdn.example.com/playlist/chunklist.m3u8?token=xyz')).toBe('hls');
    });
  });
});
