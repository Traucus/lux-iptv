// @vitest-environment happy-dom
/**
 * DashboardPage behavior tests — verifies that content renders from API responses
 * and that the degraded fallback appears when no items are present.
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

import { DashboardPage } from '../../../src/renderer/features/dashboard/DashboardPage.tsx';

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

beforeEach(() => {
  vi.clearAllMocks();
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
        return { data: { items: [{ id: 1, name: 'Inception', url: '', groupTitle: null, cover: null, year: 2010, enrichmentStatus: 'enriched' }], total: 1 } };
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
});
