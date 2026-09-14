// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ContentEnrichmentRecord } from '../../../src/renderer/db/schema';

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
    grouped: vi.fn(),
  },
  ingest: {
    start: vi.fn(),
    refresh: vi.fn().mockResolvedValue({ data: { jobId: 'j1' } }),
    cancel: vi.fn(),
    getProgress: vi.fn(),
    onProgress: vi.fn(() => () => undefined),
  },
  enrichment: { getStatus: vi.fn() },
  tmdb: { setKey: vi.fn(), hasKey: vi.fn().mockResolvedValue({ data: true }), getKey: vi.fn(), clearKey: vi.fn() },
  config: {
    saveCredentials: vi.fn(),
    loadCredentials: vi.fn(),
    hasSource: vi.fn().mockResolvedValue({ data: { configured: true } }),
    sourceSummary: vi.fn().mockResolvedValue({ data: { configured: true } }),
  },
}));

vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => mockApi,
}));

const mockGetEnrichment = vi.hoisted(() => vi.fn());
vi.mock('../../../src/renderer/db/enrichment', () => ({
  getEnrichment: mockGetEnrichment,
  upsertEnrichment: vi.fn(),
}));

import { MoviesPage } from '../../../src/renderer/features/movies/MoviesPage';

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
      React.createElement(MemoryRouter, { initialEntries: ['/movies'] }, children),
    );
  return { wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.tmdb.hasKey.mockResolvedValue({ data: true });
  mockGetEnrichment.mockResolvedValue(null);
});

describe('MoviesPage PA-06', () => {
  it('hydrates row posters from TMDB enrichment instead of forcing enriched false', async () => {
    mockApi.catalog.grouped.mockResolvedValue({
      data: {
        groups: [
          {
            title: 'Action',
            count: 1,
            items: [
              {
                id: 7,
                name: 'The Matrix',
                url: '',
                groupTitle: 'Action',
                cover: 'http://m3u.example/cover.jpg',
                year: 1999,
              },
            ],
          },
        ],
      },
    });
    const enrichment: ContentEnrichmentRecord = {
      contentId: '7',
      tmdbId: 603,
      mediaType: 'movie',
      title: 'The Matrix',
      overview: 'A hacker discovers reality is a simulation.',
      posterPath: '/matrix.jpg',
      backdropPath: null,
      voteAverage: 8.7,
      voteCount: 1,
      releaseYear: 1999,
      matchConfidence: 1,
      enrichmentStatus: 'succeeded',
      attempts: 1,
      lastAttemptAt: 0,
    };
    mockGetEnrichment.mockImplementation(async (id: string) => (id === '7' ? enrichment : null));

    const { wrapper } = setup();
    render(<MoviesPage />, { wrapper });

    await waitFor(() => {
      const img = document.querySelector('img[src*="matrix.jpg"]');
      expect(img).toBeTruthy();
    });
    expect(screen.getByText('The Matrix')).toBeTruthy();
  });
});
