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
    refresh: vi.fn(),
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
    hasSource: vi.fn().mockResolvedValue({ data: { configured: false } }),
    sourceSummary: vi.fn().mockResolvedValue({ data: { configured: false } }),
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
  mockApi.config.sourceSummary.mockResolvedValue({ data: { configured: false } });
  mockApi.config.hasSource.mockResolvedValue({ data: { configured: false } });
  mockApi.config.loadCredentials.mockResolvedValue({ data: null });
  mockApi.config.saveCredentials.mockResolvedValue({ data: { ok: true } });
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

  it('shows listName and source type only when a source is configured (FL-01, D-2)', async () => {
    mockApi.config.sourceSummary.mockResolvedValue({
      data: { configured: true, listName: 'Home IPTV', source: 'xtream' },
    });
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('Home IPTV')).toBeTruthy();
    });
    expect(screen.getByText(/Xtream Codes API/i)).toBeTruthy();
    expect(document.getElementById('cf-server')).toBeNull();
    expect(document.getElementById('cf-username')).toBeNull();
    expect(document.getElementById('cf-password')).toBeNull();
    expect(mockApi.config.loadCredentials).not.toHaveBeenCalled();
  });

  it('shows a blank form with password show/hide when no source is saved', async () => {
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Xtream Codes API/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('tab', { name: /Xtream Codes API/i }));

    const password = document.getElementById('cf-password') as HTMLInputElement;
    expect(password).toBeTruthy();
    expect(password.value).toBe('');
    expect(password.type).toBe('password');
    expect(screen.getByRole('button', { name: /Show password/i })).toBeTruthy();
    expect(mockApi.config.loadCredentials).not.toHaveBeenCalled();
  });

  it('opens a blank form on Replace source and does not prefill secrets (D-2)', async () => {
    mockApi.config.sourceSummary.mockResolvedValue({
      data: { configured: true, listName: 'Home IPTV', source: 'xtream' },
    });
    const { wrapper } = setup();
    render(<IngestPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Replace source/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Replace source/i }));

    fireEvent.click(screen.getByRole('tab', { name: /Xtream Codes API/i }));
    expect((document.getElementById('cf-server') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('cf-username') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('cf-password') as HTMLInputElement).value).toBe('');
    expect(mockApi.config.loadCredentials).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Start Ingestion/i }));
    expect(mockApi.ingest.start).not.toHaveBeenCalled();
  });
});
