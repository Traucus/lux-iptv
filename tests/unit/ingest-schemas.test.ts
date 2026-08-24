import { describe, it, expect } from 'vitest';
import { IngestStartInputSchema, IngestProgressSchema, IngestCancelInputSchema } from '../../src/shared/schemas/ingest';

describe('ingest schemas', () => {
  describe('IngestStartInputSchema', () => {
    it('accepts valid xtream input', () => {
      const result = IngestStartInputSchema.safeParse({
        source: 'xtream',
        credentials: {
          server: 'https://example.com',
          username: 'user',
          password: 'pass',
        },
        listName: 'My List',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid m3u input', () => {
      const result = IngestStartInputSchema.safeParse({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'My List',
      });
      expect(result.success).toBe(true);
    });

    it('rejects xtream without credentials', () => {
      const result = IngestStartInputSchema.safeParse({
        source: 'xtream',
        listName: 'My List',
      });
      expect(result.success).toBe(false);
    });

    it('rejects m3u without url', () => {
      const result = IngestStartInputSchema.safeParse({
        source: 'm3u',
        listName: 'My List',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid server URL', () => {
      const result = IngestStartInputSchema.safeParse({
        source: 'xtream',
        credentials: {
          server: 'not-a-url',
          username: 'user',
          password: 'pass',
        },
        listName: 'My List',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty listName', () => {
      const result = IngestStartInputSchema.safeParse({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestProgressSchema', () => {
    it('accepts valid progress', () => {
      const result = IngestProgressSchema.safeParse({
        phase: 'FETCH_ITEMS',
        percent: 50,
        counts: { live: 100, movies: 50, series: 25, radio: 5, total: 180 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects percent > 100', () => {
      const result = IngestProgressSchema.safeParse({
        phase: 'FETCH_ITEMS',
        percent: 150,
        counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('IngestCancelInputSchema', () => {
    it('accepts valid jobId', () => {
      const result = IngestCancelInputSchema.safeParse({ jobId: 'abc-123' });
      expect(result.success).toBe(true);
    });

    it('rejects empty jobId', () => {
      const result = IngestCancelInputSchema.safeParse({ jobId: '' });
      expect(result.success).toBe(false);
    });
  });
});
