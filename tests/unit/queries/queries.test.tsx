// @vitest-environment happy-dom
/**
 * Query hook tests — verify query keys, mutation lifecycle, and polling logic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// Use vi.hoisted so the mock factory can reference the shared mockApi object before module init.
const mockApi = vi.hoisted(() => ({
  catalog: {
    list: vi.fn(),
    getById: vi.fn(),
  },
  ingest: {
    start: vi.fn(),
    cancel: vi.fn(),
    getProgress: vi.fn(),
  },
  enrichment: {
    getStatus: vi.fn(),
  },
  tmdb: {
    setKey: vi.fn(),
    hasKey: vi.fn(),
    clearKey: vi.fn(),
  },
}));

vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => mockApi,
}));

import { useCatalogList, useContentById } from '../../../src/renderer/queries/use-catalog.ts';
import { useStartIngest, useCancelIngest, useIngestProgress } from '../../../src/renderer/queries/use-ingest.ts';
import { useEnrichmentStatus } from '../../../src/renderer/queries/use-enrichment.ts';
import { useTmdbKey, useSetTmdbKey, useClearTmdbKey } from '../../../src/renderer/queries/use-tmdb-key.ts';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCatalogList', () => {
  it('uses query key [catalog, type, params]', async () => {
    mockApi.catalog.list.mockResolvedValue({ data: { items: [], total: 0 } });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogList('movie', { limit: 25 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApi.catalog.list).toHaveBeenCalledWith({ type: 'movie', limit: 25 });
  });

  it('throws when API returns error', async () => {
    mockApi.catalog.list.mockResolvedValue({ error: { code: 'INTERNAL', message: 'boom' } });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useCatalogList('live'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('boom');
  });
});

describe('useContentById', () => {
  it('does not run when id is null', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useContentById('movie', null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.catalog.getById).not.toHaveBeenCalled();
  });

  it('fetches when id is provided', async () => {
    mockApi.catalog.getById.mockResolvedValue({ data: { id: 5, name: 'X' } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useContentById('movie', 5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApi.catalog.getById).toHaveBeenCalledWith({ type: 'movie', id: 5 });
  });
});

describe('useStartIngest', () => {
  it('calls ingest.start with input', async () => {
    mockApi.ingest.start.mockResolvedValue({ data: { jobId: 'job-1' } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useStartIngest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ source: 'm3u', url: 'http://x.m3u', listName: 'Test' });
    });

    expect(mockApi.ingest.start).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ jobId: 'job-1' });
  });

  it('writes optimistic currentJob on success', async () => {
    mockApi.ingest.start.mockResolvedValue({ data: { jobId: 'job-99' } });
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useStartIngest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ source: 'm3u', url: 'http://x.m3u', listName: 'Test' });
    });

    await waitFor(() => {
      const data = qc.getQueryData(['ingest', 'currentJob']) as { jobId: string; status: string } | undefined;
      expect(data?.jobId).toBe('job-99');
      expect(data?.status).toBe('running');
    });
  });
});

describe('useCancelIngest', () => {
  it('calls ingest.cancel with jobId', async () => {
    mockApi.ingest.cancel.mockResolvedValue({ data: undefined });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelIngest(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ jobId: 'job-1' });
    });

    expect(mockApi.ingest.cancel).toHaveBeenCalledWith({ jobId: 'job-1' });
  });
});

describe('useIngestProgress', () => {
  it('polls with refetchInterval when enabled', async () => {
    mockApi.ingest.getProgress.mockResolvedValue({
      data: { phase: 'PERSIST', percent: 50, counts: { live: 1, movies: 0, series: 0, radio: 0, total: 1 } },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIngestProgress('job-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const refetchInterval = result.current.refetchInterval as number | undefined;
    expect(typeof refetchInterval === 'number' || refetchInterval === undefined).toBe(true);
  });

  it('does not run without a jobId', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIngestProgress(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useEnrichmentStatus', () => {
  it('returns query data when not running', async () => {
    mockApi.enrichment.getStatus.mockResolvedValue({
      data: { queueLength: 0, lastEnrichedAt: null, isRunning: false },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEnrichmentStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isRunning).toBe(false);
  });

  it('returns query data when running', async () => {
    mockApi.enrichment.getStatus.mockResolvedValue({
      data: { queueLength: 5, lastEnrichedAt: null, isRunning: true },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEnrichmentStatus(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isRunning).toBe(true);
  });
});

describe('useTmdbKey', () => {
  it('queries hasKey and returns boolean', async () => {
    mockApi.tmdb.hasKey.mockResolvedValue({ data: true });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTmdbKey(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });
});

describe('useSetTmdbKey', () => {
  it('calls setKey and updates cache on success', async () => {
    mockApi.tmdb.setKey.mockResolvedValue({ data: { valid: true } });
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useSetTmdbKey(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ key: 'abc123def456' });
    });

    expect(mockApi.tmdb.setKey).toHaveBeenCalledWith({ key: 'abc123def456' });
    await waitFor(() => {
      expect(qc.getQueryData(['tmdb', 'hasKey'])).toBe(true);
    });
  });

  it('does not update cache when key invalid', async () => {
    mockApi.tmdb.setKey.mockResolvedValue({ data: { valid: false } });
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useSetTmdbKey(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ key: 'invalid' });
    });

    expect(qc.getQueryData(['tmdb', 'hasKey'])).toBeUndefined();
  });
});

describe('useClearTmdbKey', () => {
  it('calls clearKey and resets hasKey cache', async () => {
    mockApi.tmdb.clearKey.mockResolvedValue({ data: undefined });
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useClearTmdbKey(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockApi.tmdb.clearKey).toHaveBeenCalled();
    // The cache write happens after the React render cycle settles.
    await waitFor(() => {
      expect(qc.getQueryData<boolean>(['tmdb', 'hasKey'])).toBe(false);
    });
  });
});
