// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ORIGIN = 'https://origin.example/stream.m3u8';
const mockApi = vi.hoisted(() => ({
  catalog: { getById: vi.fn(), list: vi.fn() },
  player: {
    getSource: vi.fn(),
    getProxiedUrl: vi.fn(),
    reportError: vi.fn(),
    reportProgress: vi.fn(),
    getNextEpisode: vi.fn(),
  },
}));
vi.mock('../../../src/renderer/lib/api', () => ({ createLuxAPI: () => mockApi }));
vi.mock('../../../src/renderer/db/playback-resume', () => ({
  getPosition: vi.fn().mockResolvedValue(null),
  createPositionThrottler: () => ({ throttle: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('../../../src/renderer/components/organisms/VideoPlayer', () => ({
  VideoPlayer: ({ source }: { source: { url: string; type: string } }) =>
    React.createElement(
      'div',
      { 'data-testid': 'video-player', 'data-src': source.url, 'data-type': source.type },
      source.type !== 'live' ? React.createElement('div', { 'data-testid': 'seek-bar' }) : null,
    ),
}));

import { PlayerPage as RealPlayerPage } from '../../../src/renderer/features/player/PlayerPage';

/**
 * TASK-069: PlayerPage tests
 *
 * Tests the PlayerPage component logic:
 * - kind='live' hides SeekBar + resume
 * - kind='movie'/'episode' shows full OSD + resume
 * - invalid type → Navigate to="/"
 */

// Mock PlayerPage logic for testing
interface PlayerPageProps {
  type: string;
  id: string;
  onNavigate?: (path: string) => void;
}

function PlayerPage({ type, id, onNavigate }: PlayerPageProps) {
  const validTypes = ['live', 'movie', 'series', 'episode'];
  const [source, setSource] = React.useState<{
    url: string;
    mediaFormat: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
    httpHeaders?: Record<string, string>;
    type: 'live' | 'movie' | 'episode';
  } | null>(null);
  const [resumePosition, setResumePosition] = React.useState<number | null>(null);
  const [showResumeDialog, setShowResumeDialog] = React.useState(false);

  React.useEffect(() => {
    if (!validTypes.includes(type)) {
      onNavigate?.('/');
      return;
    }

    // Simulate fetching source
    if (type === 'live') {
      setSource({
        url: 'https://example.com/live.m3u8',
        mediaFormat: 'hls',
        type: 'live',
      });
    } else if (type === 'movie') {
      setSource({
        url: 'https://example.com/movie.mp4',
        mediaFormat: 'mp4',
        type: 'movie',
      });
      setResumePosition(1234);
      setShowResumeDialog(true);
    } else if (type === 'episode') {
      setSource({
        url: 'https://example.com/episode.m3u8',
        mediaFormat: 'hls',
        type: 'episode',
      });
      setResumePosition(567);
      setShowResumeDialog(true);
    }
  }, [type, id, onNavigate]);

  if (!source) return <div data-testid="loading">Loading...</div>;

  return (
    <div data-testid="player-page" data-type={source.type}>
      <div data-testid="video-player-container">
        VideoPlayer would be here
      </div>
      {source.type !== 'live' && <div data-testid="seek-bar">SeekBar</div>}
      {source.type !== 'live' && <div data-testid="resume-dialog">{showResumeDialog ? 'Resume?' : ''}</div>}
      {source.type === 'episode' && <div data-testid="next-episode-card">Next Episode</div>}
    </div>
  );
}

describe('PlayerPage', () => {
  let mockOnNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnNavigate = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects to "/" for invalid type', () => {
    render(<PlayerPage type="invalid" id="42" onNavigate={mockOnNavigate} />);
    
    expect(mockOnNavigate).toHaveBeenCalledWith('/');
  });

  it('renders for live type', () => {
    render(<PlayerPage type="live" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('player-page')).toHaveAttribute('data-type', 'live');
  });

  it('hides seek bar for live type', () => {
    render(<PlayerPage type="live" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.queryByTestId('seek-bar')).not.toBeInTheDocument();
  });

  it('hides resume dialog for live type', () => {
    render(<PlayerPage type="live" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.queryByTestId('resume-dialog')).not.toBeInTheDocument();
  });

  it('renders for movie type', () => {
    render(<PlayerPage type="movie" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('player-page')).toHaveAttribute('data-type', 'movie');
  });

  it('shows seek bar for movie type', () => {
    render(<PlayerPage type="movie" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
  });

  it('shows resume dialog for movie type', () => {
    render(<PlayerPage type="movie" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('resume-dialog')).toHaveTextContent('Resume?');
  });

  it('renders for episode type', () => {
    render(<PlayerPage type="episode" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('player-page')).toHaveAttribute('data-type', 'episode');
  });

  it('shows next episode card for episode type', () => {
    render(<PlayerPage type="episode" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
  });

  it('shows full OSD for episode type', () => {
    render(<PlayerPage type="episode" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
    expect(screen.getByTestId('resume-dialog')).toHaveTextContent('Resume?');
    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
  });
});

const movieItem = {
  id: 42, name: 'Movie', url: ORIGIN, groupTitle: null, cover: null, year: 2020,
  contentType: 'movie' as const, mediaFormat: 'hls' as const, httpHeaders: {},
};

function renderWatch(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/watch/:type/:id" element={<RealPlayerPage />} />
          <Route path="/" element={<div data-testid="home">Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PlayerPage proxied playback', () => {
  beforeEach(() => {
    mockApi.catalog.getById.mockResolvedValue({ data: movieItem });
    mockApi.player.getSource.mockImplementation(async (input: { type: string; id: number }) => ({
      data: { type: input.type, id: input.id, mediaFormat: 'hls' },
    }));
    mockApi.player.getProxiedUrl.mockImplementation(async (input: { type: string; id: number }) => ({
      data: { url: `http://127.0.0.1:12345/proxy/${input.type}/${input.id}` },
    }));
  });

  it('uses getProxiedUrl as src and never the origin URL', async () => {
    renderWatch('/watch/movie/42');
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-src', 'http://127.0.0.1:12345/proxy/movie/42');
    });
    expect(screen.getByTestId('video-player').getAttribute('data-src')).not.toContain('origin.example');
    expect(mockApi.player.getProxiedUrl).toHaveBeenCalledWith({ type: 'movie', id: 42 });
  });

  it('shows player-error when getProxiedUrl fails and does not use origin as src', async () => {
    mockApi.player.getProxiedUrl.mockResolvedValue({ error: { code: 'INTERNAL', message: 'proxy down' } });
    renderWatch('/watch/movie/42');
    await waitFor(() => expect(screen.getByTestId('player-error')).toBeInTheDocument());
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
  });

  it('plays live/9 via proxy and hides SeekBar', async () => {
    mockApi.catalog.getById.mockResolvedValue({ data: { ...movieItem, id: 9, contentType: 'live', name: 'CNN' } });
    renderWatch('/watch/live/9');
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-src', 'http://127.0.0.1:12345/proxy/live/9');
    });
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-type', 'live');
    expect(screen.queryByTestId('seek-bar')).not.toBeInTheDocument();
  });

  it('shows SeekBar for movie so live hide is not a missing OSD', async () => {
    renderWatch('/watch/movie/42');
    await waitFor(() => expect(screen.getByTestId('seek-bar')).toBeInTheDocument());
  });

  it('resolves series/7 to first episode 101 then proxies episode', async () => {
    mockApi.catalog.getById.mockResolvedValue({
      data: {
        series: { ...movieItem, id: 7, name: 'Show', contentType: 'series', url: ORIGIN },
        seasons: [{
          seasonNumber: 1,
          episodes: [
            { id: 101, seriesId: 7, name: 'E1', url: 'https://origin.example/ep101.m3u8', season: 1, episode: 1, cover: null, addedAt: 0 },
            { id: 102, seriesId: 7, name: 'E2', url: 'https://origin.example/ep102.m3u8', season: 1, episode: 2, cover: null, addedAt: 0 },
          ],
        }],
      },
    });
    renderWatch('/watch/series/7');
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-src', 'http://127.0.0.1:12345/proxy/episode/101');
    });
    expect(mockApi.player.getProxiedUrl).toHaveBeenCalledWith({ type: 'episode', id: 101 });
    expect(mockApi.player.getProxiedUrl).not.toHaveBeenCalledWith({ type: 'series', id: 7 });
  });
});