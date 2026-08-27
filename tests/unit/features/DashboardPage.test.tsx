// @vitest-environment happy-dom
/**
 * DashboardPage behavior tests — verifies that content renders from API responses
 * and that the degraded fallback appears when no items are present.
 *
 * Also covers the verify-report fix #1: enriched metadata (overview, backdrop,
 * rating, genres) flows from IndexedDB into the hero banner.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-tv-space-navigation', () => ({
  SpatialNavigationFocusableView: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement('div', rest, children),
  SpatialNavigationRoot: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationNode: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationView: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

const mockApi = vi.hoisted(() => ({
  catalog: {
    list: vi.fn(),
    getById: vi.fn(),
  },
  ingest: { start: vi.fn(), cancel: vi.fn(), getProgress: vi.fn(), onProgress: vi.fn(() => () => undefined) },
  enrichment: { getStatus: vi.fn() },
  tmdb: { setKey: vi.fn(), hasKey: vi.fn(), clearKey: vi.fn() },
}));

vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => mockApi,
}));

// Mock the enrichment hook so we can return controlled enrichment records
// (or nothing) without depending on IndexedDB in the test environment.
const mockEnrichmentBatch = vi.hoisted(() => vi.fn());
vi.mock('../../../src/renderer/queries/use-enrichment-data', () => ({
  useEnrichment: vi.fn(() => ({ data: null, isPending: false })),
  useEnrichmentBatch: mockEnrichmentBatch,
  useSaveEnrichment: vi.fn(() => ({ mutate: vi.fn() })),
}));

import { DashboardPage } from '../../../src/renderer/features/dashboard/DashboardPage.tsx';
import type { ContentEnrichmentRecord } from '../../../src/renderer/db/schema';

function setup() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(MemoryRouter, { initialEntries: ['/'] }, children),
    );
  return { qc, wrapper };
}

/**
 * Returns a TanStack-Query-shaped result for each requested id. When the
 * caller provides a `byContentId` map we return the matching record as `data`;
 * otherwise we return `data: null` (no enrichment found).
 */
function makeEnrichmentResults(
  ids: ReadonlyArray<string>,
  byContentId: ReadonlyMap<string, ContentEnrichmentRecord> = new Map(),
): Array<{ data: ContentEnrichmentRecord | null; isPending: boolean; fetchStatus: 'idle' | 'fetching' | 'paused' }> {
  return ids.map((id) => {
    const record = byContentId.get(id) ?? null;
    return {
      data: record,
      isPending: false,
      fetchStatus: 'idle' as const,
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no enrichment records are present (degraded mode).
  mockEnrichmentBatch.mockImplementation(
    (ids: ReadonlyArray<string | number>) => makeEnrichmentResults(ids.map(String)),
  );
});

describe('DashboardPage', () => {
  it('renders sidebar with all sections', async () => {
    mockApi.catalog.list.mockResolvedValue({ data: { items: [], total: 0 } });
    const { wrapper } = setup();
    render(<DashboardPage />, { wrapper });
    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Live TV')).toBeTruthy();
    expect(screen.getByLabelText('Movies')).toBeTruthy();
    expect(screen.getByLabelText('Series')).toBeTruthy();
    expect(screen.getByLabelText('Favorites')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('shows degraded hero when catalog is empty', async () => {
    mockApi.catalog.list.mockResolvedValue({ data: { items: [], total: 0 } });
    const { wrapper } = setup();
    render(<DashboardPage />, { wrapper });
    await waitFor(() => {
      expect(screen.getByText(/Welcome to Lux IPTV/i)).toBeTruthy();
    });
  });

  it('renders movie carousels when content is present', async () => {
    mockApi.catalog.list.mockImplementation(async (input: { type: string }) => {
      if (input.type === 'movie') {
        return { data: { items: [{ id: 1, name: 'Inception', url: '', groupTitle: null, cover: null, year: 2010 }], total: 1 } };
      }
      return { data: { items: [], total: 0 } };
    });
    const { wrapper } = setup();
    render(<DashboardPage />, { wrapper });
    await waitFor(() => {
      // Inception appears in the hero banner (h1) and in carousel cards
      const matches = screen.getAllByText(/Inception/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  it('calls catalog.list for each carousel type', async () => {
    mockApi.catalog.list.mockResolvedValue({ data: { items: [], total: 0 } });
    const { wrapper } = setup();
    render(<DashboardPage />, { wrapper });

    await waitFor(() => {
      const calls = mockApi.catalog.list.mock.calls;
      const types = new Set(calls.map((c) => (c[0] as { type: string }).type));
      expect(types.has('live')).toBe(true);
      expect(types.has('movie')).toBe(true);
      expect(types.has('series')).toBe(true);
    });
  });

  it('renders the hero synopsis from IndexedDB enrichment when available', async () => {
    // Single enriched movie; the hook should merge its overview into the hero.
    mockApi.catalog.list.mockImplementation(async (input: { type: string }) => {
      if (input.type === 'movie') {
        return {
          data: {
            items: [
              {
                id: 1,
                name: 'The Matrix',
                url: '',
                groupTitle: null,
                cover: null,
                year: 1999,
              },
            ],
            total: 1,
          },
        };
      }
      return { data: { items: [], total: 0 } };
    });
    const enrichment: ContentEnrichmentRecord = {
      contentId: '1',
      tmdbId: 603,
      mediaType: 'movie',
      title: 'The Matrix',
      overview: 'A hacker discovers reality is a simulation and joins the rebellion.',
      posterPath: '/matrix.jpg',
      backdropPath: '/matrix-backdrop.jpg',
      voteAverage: 8.7,
      voteCount: 25000,
      releaseYear: 1999,
      matchConfidence: 0.95,
      enrichmentStatus: 'succeeded',
      attempts: 1,
      lastAttemptAt: 0,
    };
    const map = new Map<string, ContentEnrichmentRecord>([['1', enrichment]]);
    mockEnrichmentBatch.mockImplementation((ids: ReadonlyArray<string | number>) =>
      makeEnrichmentResults(ids.map(String), map),
    );

    const { wrapper } = setup();
    render(<DashboardPage />, { wrapper });
    await waitFor(() => {
      // The HeroMetadata renders the synopsis in a <p> with line-clamp-3.
      expect(screen.getByText(/hacker discovers reality/i)).toBeTruthy();
    });
  });
});
