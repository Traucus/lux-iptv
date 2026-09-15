// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

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
  epg: { nowNext: vi.fn() },
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

import { EpgPage } from '../../../src/renderer/features/epg/EpgPage';

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
      React.createElement(MemoryRouter, { initialEntries: ['/epg'] }, children),
    );
  return { wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.tmdb.hasKey.mockResolvedValue({ data: true });
  mockApi.epg.nowNext.mockResolvedValue({ data: { items: [] } });
});

describe('EpgPage FA-11', () => {
  it('lists now/next and plays the selected live channel', async () => {
    mockApi.catalog.list.mockResolvedValue({
      data: {
        items: [{ id: 3, name: 'CNN', url: '', groupTitle: 'News', cover: null, year: null }],
        total: 1,
      },
    });
    mockApi.epg.nowNext.mockResolvedValue({
      data: {
        items: [
          {
            channelId: 3,
            now: { title: 'News at 9', endAt: Date.now() + 1000 },
            next: { title: 'Weather', startAt: Date.now() + 1000 },
          },
        ],
      },
    });

    function LocationProbe(): React.ReactElement {
      const location = useLocation();
      return <div data-testid="location-pathname">{location.pathname}</div>;
    }

    const { wrapper } = setup();
    render(
      <>
        <EpgPage />
        <LocationProbe />
      </>,
      { wrapper },
    );

    await waitFor(() => {
      expect(screen.getByTestId('epg-now-next-list')).toBeTruthy();
      expect(screen.getByText('News at 9')).toBeTruthy();
      expect(screen.getByText(/Next: Weather/)).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('epg-row-3'));
    expect(screen.getByTestId('location-pathname').textContent).toBe('/watch/live/3');
  });
});
