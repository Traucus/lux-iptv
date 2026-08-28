// @vitest-environment happy-dom
/**
 * Routing tests for HashRouter + /watch/:type/:id PlayerPage.
 *
 * REQ-ROUTER-1: The renderer MUST use HashRouter so deep links work on file://
 * in packaged Electron builds.
 *
 * /watch/:type/:id MUST mount PlayerPage. Invalid type falls back to "/".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../../src/renderer/App';

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
    list: vi.fn().mockResolvedValue({ data: { items: [], total: 0 } }),
    getById: vi.fn().mockResolvedValue({
      data: { id: 42, name: 'Movie', url: 'https://origin.example/stream.m3u8', groupTitle: null, cover: null, year: 2020, contentType: 'movie', mediaFormat: 'hls', httpHeaders: {} },
    }),
  },
  ingest: { start: vi.fn(), refresh: vi.fn(), cancel: vi.fn(), getProgress: vi.fn(), onProgress: vi.fn(() => () => undefined) },
  enrichment: { getStatus: vi.fn() },
  tmdb: { setKey: vi.fn(), hasKey: vi.fn(), clearKey: vi.fn() },
  config: {
    saveCredentials: vi.fn(), loadCredentials: vi.fn(),
    hasSource: vi.fn().mockResolvedValue({ data: { configured: false } }),
    sourceSummary: vi.fn().mockResolvedValue({ data: { configured: false } }),
  },
  player: {
    getSource: vi.fn().mockResolvedValue({ data: { type: 'movie', id: 42, mediaFormat: 'hls' } }),
    getProxiedUrl: vi.fn().mockResolvedValue({ data: { url: 'http://127.0.0.1:12345/proxy/movie/42' } }),
    reportError: vi.fn(), reportProgress: vi.fn(), getNextEpisode: vi.fn(),
  },
}));
vi.mock('../../src/renderer/lib/api', () => ({ createLuxAPI: () => mockApi }));
vi.mock('../../src/renderer/db/playback-resume', () => ({
  getPosition: vi.fn().mockResolvedValue(null),
  createPositionThrottler: () => ({ throttle: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('../../src/renderer/components/organisms/VideoPlayer', () => ({
  VideoPlayer: ({ source }: { source: { url: string } }) =>
    React.createElement('div', { 'data-testid': 'video-player', 'data-src': source.url }),
}));
vi.mock('../../src/renderer/features/ingest/IngestProgressHost', () => ({ IngestProgressHost: () => null }));
vi.mock('../../src/renderer/queries/use-enrichment-data', () => ({
  useEnrichment: vi.fn(() => ({ data: null, isPending: false })),
  useEnrichmentBatch: vi.fn(() => []),
  useSaveEnrichment: vi.fn(() => ({ mutate: vi.fn() })),
}));

beforeEach(() => {
  // HashRouter reads window.location.hash; reset to a known state.
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

/**
 * Compile-time + import-side guard: confirms the App component uses HashRouter
 * (not BrowserRouter). This is the cheapest way to assert REQ-ROUTER-1 without
 * standing up Electron + Playwright.
 *
 * We grep the source text of `src/renderer/App.tsx` for the symbol. This is
 * intentionally a STRING-based assertion because react-router-dom exports both
 * names from the same package, so a runtime import in this test cannot
 * distinguish which one the App picks up.
 */
describe('App.tsx router selection', () => {
  it('imports HashRouter and does NOT import BrowserRouter', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const appPath = path.resolve(here, '../../src/renderer/App.tsx');
    const source = await readFile(appPath, 'utf8');

    // REQ-ROUTER-1: HashRouter must be the chosen router. We match the
    // JSX / import usage specifically (a token boundary on either side), so
    // docstring references like "HashRouter (not BrowserRouter)" don't trip
    // the negative assertion.
    expect(source).toMatch(/from ['"]react-router-dom['"]/);
    expect(source).toMatch(/\bHashRouter\b/);
    expect(source).not.toMatch(/import\s+\{[^}]*\bBrowserRouter\b/);
    expect(source).not.toMatch(/<BrowserRouter\b/);
  });

  it('declares the /watch/:type/:id route', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const appPath = path.resolve(here, '../../src/renderer/App.tsx');
    const source = await readFile(appPath, 'utf8');

    expect(source).toMatch(/path=["']\/watch\/:type\/:id["']/);
    expect(source).toMatch(/import \{ PlayerPage \}/);
    expect(source).not.toMatch(/import \{ PlayerPlaceholder \}/);
    expect(source).toMatch(/element=\{<PlayerPage/);
  });
});

function renderApp(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App /watch mounts PlayerPage', () => {
  it('mounts video-player at #/watch/movie/42 and does not render the placeholder', async () => {
    window.location.hash = '#/watch/movie/42';
    renderApp();

    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toBeTruthy();
    });
    expect(screen.queryByTestId('player-placeholder')).toBeNull();
  });

  it('redirects to "/" when type is invalid', async () => {
    window.location.hash = '#/watch/invalid/42';
    renderApp();

    await waitFor(() => {
      expect(window.location.hash === '#/' || window.location.hash === '').toBe(true);
    });
    expect(screen.queryByTestId('player-placeholder')).toBeNull();
    expect(screen.queryByTestId('video-player')).toBeNull();
  });
});
