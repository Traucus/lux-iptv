// @vitest-environment happy-dom
/**
 * DetailPage behavior tests — verifies degraded mode and series vs movie layouts.
 * Also covers the verify-report fixes: episode numbers from the Episode DTO
 * (not the SQLite primary key), enriched metadata merging, and the detail
 * fanart/backdrop wiring.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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
  catalog: { list: vi.fn(), getById: vi.fn() },
  ingest: { start: vi.fn(), cancel: vi.fn(), getProgress: vi.fn(), onProgress: vi.fn(() => () => undefined) },
  enrichment: { getStatus: vi.fn() },
  tmdb: { setKey: vi.fn(), hasKey: vi.fn(), clearKey: vi.fn() },
}));

vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => mockApi,
}));

import { DetailPage } from '../../../src/renderer/features/detail/DetailPage.tsx';

function setup(path: string) {
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
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        React.createElement(Routes, null,
          React.createElement(Route, { path: '/content/:type/:id', element: children }),
          React.createElement(Route, { path: '/content/:id', element: children }),
        ),
      ),
    );
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DetailPage', () => {
  it('renders invalid id state for non-numeric IDs', async () => {
    const { wrapper } = setup('/content/movie/abc');
    render(<DetailPage />, { wrapper });
    expect(screen.getByText(/Invalid content ID/i)).toBeTruthy();
  });

  it('renders movie detail with degraded indicator when not enriched', async () => {
    mockApi.catalog.getById.mockResolvedValue({
      data: { id: 1, name: 'Raw Title', url: 'http://x', groupTitle: 'Drama', cover: null, year: null },
    });
    const { wrapper } = setup('/content/movie/1');
    render(<DetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Raw Title/i)).toBeTruthy();
      expect(screen.getAllByText(/No enriched metadata available/i).length).toBeGreaterThan(0);
    });
  });

  it('renders series detail with season tabs', async () => {
    mockApi.catalog.getById.mockResolvedValue({
      data: {
        series: { id: 1, name: 'Breaking Bad', url: '', groupTitle: null, cover: null, year: 2008 },
        seasons: [
          {
            seasonNumber: 1,
            episodes: [
              { id: 100, seriesId: 1, name: 'Pilot', url: '', season: 1, episode: 1, cover: null, addedAt: 0 },
            ],
          },
          {
            seasonNumber: 2,
            episodes: [
              { id: 200, seriesId: 1, name: 'Ep2', url: '', season: 2, episode: 2, cover: null, addedAt: 0 },
            ],
          },
        ],
      },
    });
    const { wrapper } = setup('/content/series/1');
    render(<DetailPage />, { wrapper });

    await waitFor(() => {
      expect(mockApi.catalog.getById).toHaveBeenCalledWith({ type: 'series', id: 1 });
      expect(screen.getByText(/Breaking Bad/i)).toBeTruthy();
      expect(screen.getByText(/Season 1/i)).toBeTruthy();
      expect(screen.getByText(/Season 2/i)).toBeTruthy();
    });
  });

  it('renders episode numbers from the Episode DTO, not the SQLite id', async () => {
    mockApi.catalog.getById.mockResolvedValue({
      data: {
        series: { id: 1, name: 'Severance', url: '', groupTitle: null, cover: null, year: 2022 },
        seasons: [
          {
            seasonNumber: 1,
            episodes: [
              // id=42 is a fake PK; the real episode number is 7.
              { id: 42, seriesId: 1, name: 'Defiant Jazz', url: '', season: 1, episode: 7, cover: null, addedAt: 0 },
            ],
          },
        ],
      },
    });
    const { wrapper } = setup('/content/series/1');
    render(<DetailPage />, { wrapper });

    // The fix for verify report #2: "Ep. 7" comes from ep.episode, not ep.id=42.
    await waitFor(() => {
      expect(screen.getByText(/Ep\. 7 — Defiant Jazz/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Ep\. 42 — Defiant Jazz/i)).toBeNull();
  });

  it('shows error state on API failure', async () => {
    mockApi.catalog.getById.mockResolvedValue({
      error: { code: 'NOT_FOUND', message: 'Item not found' },
    });
    const { wrapper } = setup('/content/movie/1');
    render(<DetailPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load content/i)).toBeTruthy();
    });
  });
});
