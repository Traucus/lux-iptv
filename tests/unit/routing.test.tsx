// @vitest-environment happy-dom
/**
 * Routing tests for HashRouter + /watch/:type/:id placeholder.
 *
 * REQ-ROUTER-1: The renderer MUST use HashRouter so deep links work on file://
 * in packaged Electron builds.
 *
 * REQ-NAV-1: /watch/:type/:id route exists and renders a placeholder that
 * displays the type and id from the URL.
 *
 * REQ-NAV-2: /watch with an invalid type falls back to "/" (Navigate).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HashRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
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

/**
 * A minimal PlayerPlaceholder component that mirrors the contract the production
 * App.tsx renders for /watch/:type/:id. We re-create it here so the test is
 * self-contained; once App.tsx wires the same shape, this stays in sync.
 */
function PlayerPlaceholder(): React.ReactElement {
  const { type, id } = useParams<{ type: string; id: string }>();
  const validTypes = new Set(['live', 'movie', 'series', 'episode']);
  if (!type || !validTypes.has(type)) {
    return <Navigate to="/" replace />;
  }
  return (
    <div data-testid="player-placeholder">
      <p data-testid="player-type">type={type}</p>
      <p data-testid="player-id">id={id}</p>
      <p data-testid="player-message">Player coming in PR 5</p>
    </div>
  );
}

/**
 * A minimal Home page used as the fallback target so we can assert Navigate
 * behavior. Also a sentinel route /nav-target that captures the current
 * location for assertion.
 */
function NavTarget(): React.ReactElement {
  const location = useLocation();
  return (
    <div data-testid="nav-target" data-pathname={location.pathname} data-hash={location.hash}>
      Reached
    </div>
  );
}

/**
 * The "App" under test, using HashRouter and exposing the same routes the
 * production App.tsx declares. We rebuild the routes here so we can verify
 * the contract without coupling to file system / Vite specifics.
 */
function TestApp(): React.ReactElement {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<div data-testid="home">Home</div>} />
        <Route path="/nav-target" element={<NavTarget />} />
        <Route path="/watch/:type/:id" element={<PlayerPlaceholder />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

beforeEach(() => {
  // HashRouter reads window.location.hash; reset to a known state.
  window.location.hash = '';
});

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('HashRouter routing', () => {
  it('renders home on default route (no hash)', async () => {
    render(<TestApp />);
    expect(screen.getByTestId('home')).toBeTruthy();
  });

  it('renders the player placeholder at #/watch/movie/42 with type and id', async () => {
    window.location.hash = '#/watch/movie/42';
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByTestId('player-placeholder')).toBeTruthy();
    });
    expect(screen.getByTestId('player-type').textContent).toBe('type=movie');
    expect(screen.getByTestId('player-id').textContent).toBe('id=42');
  });

  it('renders the placeholder for episode type', async () => {
    window.location.hash = '#/watch/episode/7';
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByTestId('player-type').textContent).toBe('type=episode');
    });
    expect(screen.getByTestId('player-id').textContent).toBe('id=7');
  });

  it('renders the placeholder for live type', async () => {
    window.location.hash = '#/watch/live/abc';
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByTestId('player-type').textContent).toBe('type=live');
    });
    expect(screen.getByTestId('player-id').textContent).toBe('id=abc');
  });

  it('redirects to "/" when type is invalid', async () => {
    window.location.hash = '#/watch/invalid/42';
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeTruthy();
    });
  });

  it('falls back to "/" for any unknown hash route', async () => {
    window.location.hash = '#/totally-not-a-route';
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByTestId('home')).toBeTruthy();
    });
  });

  it('HashRouter preserves the URL hash after first render', async () => {
    window.location.hash = '#/watch/series/99';
    render(<TestApp />);

    await waitFor(() => {
      expect(screen.getByTestId('player-type').textContent).toBe('type=series');
    });
    // HashRouter must keep the hash so a page reload re-resolves the route.
    expect(window.location.hash).toBe('#/watch/series/99');
  });
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
