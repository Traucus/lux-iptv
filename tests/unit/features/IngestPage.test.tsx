// @vitest-environment happy-dom
/**
 * IngestPage behavioral tests — verify tab switching, validation triggering,
 * and the auto-transition logic on DONE.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock react-tv-space-navigation (needs react-native).
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

// Mock the API.
const mockApi = vi.hoisted(() => ({
  ingest: {
    start: vi.fn(),
    cancel: vi.fn(),
    getProgress: vi.fn(),
    onProgress: vi.fn(() => () => undefined),
  },
  catalog: { list: vi.fn(), getById: vi.fn() },
  enrichment: { getStatus: vi.fn() },
  tmdb: { setKey: vi.fn(), hasKey: vi.fn(), clearKey: vi.fn() },
  config: {
    saveCredentials: vi.fn().mockResolvedValue({ data: { ok: true } }),
    loadCredentials: vi.fn().mockResolvedValue({ data: null }),
  },
}));

vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => mockApi,
}));

import { IngestPage } from '../../../src/renderer/features/ingest/IngestPage.tsx';

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
      React.createElement(MemoryRouter, { initialEntries: ['/ingest'] }, children),
    );
  return { qc, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IngestPage', () => {
  it('renders both tabs', async () => {
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });
    expect(screen.getByRole('tab', { name: /Xtream Codes API/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /M3U Playlist URL/i })).toBeTruthy();
  });

  it('switches to Xtream tab and shows server/username/password fields', async () => {
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });
    fireEvent.click(screen.getByRole('tab', { name: /Xtream Codes API/i }));
    expect((document.getElementById('cf-server') as HTMLInputElement | null)).toBeTruthy();
    expect((document.getElementById('cf-username') as HTMLInputElement | null)).toBeTruthy();
    expect((document.getElementById('cf-password') as HTMLInputElement | null)).toBeTruthy();
  });

  it('shows validation error for M3U URL without protocol', async () => {
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });

    const urlInput = document.getElementById('cf-url') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'invalid-url' } });

    const listNameInput = document.getElementById('cf-listname') as HTMLInputElement;
    fireEvent.change(listNameInput, { target: { value: 'My List' } });

    const submit = screen.getByRole('button', { name: /Start Ingestion/i });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText(/URL must start with http/i)).toBeTruthy();
    });

    expect(mockApi.ingest.start).not.toHaveBeenCalled();
  });

  it('calls ingest.start when valid M3U inputs are submitted', async () => {
    mockApi.ingest.start.mockResolvedValue({ data: { jobId: 'job-abc' } });
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });

    const urlInput = document.getElementById('cf-url') as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: 'https://example.com/playlist.m3u' } });
    fireEvent.change(document.getElementById('cf-listname') as HTMLInputElement, {
      target: { value: 'My List' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Start Ingestion/i }));

    await waitFor(() => {
      expect(mockApi.ingest.start).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'm3u',
          url: 'https://example.com/playlist.m3u',
          listName: 'My List',
        }),
      );
    });
  });

  it('shows overlay once ingestion starts', async () => {
    mockApi.ingest.start.mockResolvedValue({ data: { jobId: 'job-overlay' } });
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });

    fireEvent.change(document.getElementById('cf-url') as HTMLInputElement, {
      target: { value: 'https://example.com/p.m3u' },
    });
    fireEvent.change(document.getElementById('cf-listname') as HTMLInputElement, {
      target: { value: 'L' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Start Ingestion/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Ingestion progress/i })).toBeTruthy();
    });
  });

  it('does NOT show overlay when only the form is visible', () => {
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
