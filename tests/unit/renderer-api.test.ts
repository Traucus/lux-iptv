import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLuxAPI } from '../../src/renderer/lib/api';

describe('renderer api', () => {
  beforeEach(() => {
    // Mock window.luxAPI
    (globalThis as Record<string, unknown>).window = {
      luxAPI: {
        ingest: {
          start: vi.fn().mockResolvedValue({ data: { jobId: '123' } }),
          cancel: vi.fn().mockResolvedValue({ data: undefined }),
          getProgress: vi.fn().mockResolvedValue({ data: { phase: 'DONE', percent: 100, counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 } } }),
          onProgress: vi.fn().mockReturnValue(() => {}),
        },
        catalog: {
          list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
          getById: vi.fn().mockResolvedValue({ data: { id: 1, name: 'Test' } }),
        },
        enrichment: {
          getStatus: vi.fn().mockResolvedValue({ data: { queueLength: 0, lastEnrichedAt: null, isRunning: false } }),
        },
        tmdb: {
          setKey: vi.fn().mockResolvedValue({ data: { valid: true } }),
          hasKey: vi.fn().mockResolvedValue({ data: true }),
          clearKey: vi.fn().mockResolvedValue({ data: undefined }),
        },
      },
    };
  });

  it('creates a typed API wrapper', () => {
    const api = createLuxAPI();
    expect(api).toBeDefined();
    expect(api.ingest).toBeDefined();
    expect(api.catalog).toBeDefined();
    expect(api.enrichment).toBeDefined();
    expect(api.tmdb).toBeDefined();
  });

  it('ingest.start calls window.luxAPI.ingest.start', async () => {
    const api = createLuxAPI();
    const result = await api.ingest.start({
      source: 'm3u',
      url: 'https://example.com/playlist.m3u',
      listName: 'Test',
    });
    expect(result).toEqual({ data: { jobId: '123' } });
  });

  it('catalog.list calls window.luxAPI.catalog.list', async () => {
    const api = createLuxAPI();
    const result = await api.catalog.list({ type: 'movie' });
    expect(result).toEqual({ data: { items: [], total: 0 } });
  });

  it('tmdb.setKey calls window.luxAPI.tmdb.setKey', async () => {
    const api = createLuxAPI();
    const result = await api.tmdb.setKey({ key: 'abc123def456' });
    expect(result).toEqual({ data: { valid: true } });
  });
});
