import { describe, it, expect } from 'vitest';
import { CatalogListInputSchema, CatalogGetByIdInputSchema } from '../../src/shared/schemas/catalog';
import { TmdbKeyInputSchema } from '../../src/shared/schemas/tmdb';

describe('catalog schemas', () => {
  describe('CatalogListInputSchema', () => {
    it('accepts valid input with defaults', () => {
      const result = CatalogListInputSchema.safeParse({ type: 'movie' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(100);
        expect(result.data.offset).toBe(0);
      }
    });

    it('accepts valid input with custom pagination', () => {
      const result = CatalogListInputSchema.safeParse({
        type: 'live',
        limit: 100,
        offset: 200,
        search: 'news',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid type', () => {
      const result = CatalogListInputSchema.safeParse({ type: 'radio' });
      expect(result.success).toBe(false);
    });

    it('rejects limit > 1000', () => {
      const result = CatalogListInputSchema.safeParse({ type: 'movie', limit: 1001 });
      expect(result.success).toBe(false);
    });

    it('rejects negative offset', () => {
      const result = CatalogListInputSchema.safeParse({ type: 'movie', offset: -1 });
      expect(result.success).toBe(false);
    });
  });

  describe('CatalogGetByIdInputSchema', () => {
    it('accepts valid input', () => {
      const result = CatalogGetByIdInputSchema.safeParse({ type: 'series', id: 42 });
      expect(result.success).toBe(true);
    });

    it('rejects non-positive id', () => {
      const result = CatalogGetByIdInputSchema.safeParse({ type: 'movie', id: 0 });
      expect(result.success).toBe(false);
    });
  });
});

describe('tmdb schemas', () => {
  describe('TmdbKeyInputSchema', () => {
    it('accepts valid API key format', () => {
      const result = TmdbKeyInputSchema.safeParse({ key: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4' });
      expect(result.success).toBe(true);
    });

    it('rejects key too short', () => {
      const result = TmdbKeyInputSchema.safeParse({ key: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejects key with invalid characters', () => {
      const result = TmdbKeyInputSchema.safeParse({ key: 'not-a-valid-key!!!' });
      expect(result.success).toBe(false);
    });
  });
});
