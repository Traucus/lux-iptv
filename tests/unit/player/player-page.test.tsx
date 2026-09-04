// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    play: vi.fn(),
    stop: vi.fn(),
  },
}));
vi.mock('../../../src/renderer/lib/api', () => ({ createLuxAPI: () => mockApi }));
vi.mock('../../../src/renderer/db/playback-resume', () => ({
  getPosition: vi.fn().mockResolvedValue(null),
  createPositionThrottler: () => ({ throttle: vi.fn(), flush: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock('../../../src/renderer/components/organisms/VideoPlayer', () => ({
  VideoPlayer: ({
    source,
    diagnosis,
  }: {
    source: { type: string; engine?: string; url?: string };
    diagnosis?: { kind: string } | null;
  }) =>
    diagnosis
      ? React.createElement('div', { 'data-testid': 'libmpv-diagnosis' }, diagnosis.kind)
      : React.createElement(
          'div',
          { 'data-testid': 'video-player', 'data-engine': source.engine, 'data-type': source.type },
          source.type !== 'live' ? React.createElement('div', { 'data-testid': 'seek-bar' }) : null,
        ),
}));

import { PlayerPage as RealPlayerPage } from '../../../src/renderer/features/player/PlayerPage';

const movieItem = {
  id: 42, name: 'Movie', url: ORIGIN, groupTitle: null, cover: null, year: 2020,
  contentType: 'movie' as const, mediaFormat: 'unknown' as const, httpHeaders: {},
  containerExtension: 'mkv', directSource: '',
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

describe('PlayerPage libmpv playback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.catalog.getById.mockResolvedValue({ data: movieItem });
    mockApi.player.getSource.mockImplementation(async (input: { type: string; id: number }) => ({
      data: { type: input.type, id: input.id, mediaFormat: 'unknown' },
    }));
    mockApi.player.play.mockResolvedValue({ data: { engine: 'libmpv' } });
    mockApi.player.stop.mockResolvedValue({ data: { stopped: true } });
    mockApi.player.getProxiedUrl.mockResolvedValue({ error: { code: 'INTERNAL', message: 'not the happy path' } });
  });

  it('starts in-process libmpv play and does not call getProxiedUrl', async () => {
    renderWatch('/watch/movie/42');
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-engine', 'libmpv');
    });
    expect(mockApi.player.play).toHaveBeenCalledWith({ type: 'movie', id: 42 });
    expect(mockApi.player.getProxiedUrl).not.toHaveBeenCalled();
    expect(screen.getByTestId('player-shell')).toHaveClass('h-screen', 'w-screen');
  });

  it('shows libmpv diagnosis when play returns libmpv-load-failed', async () => {
    mockApi.player.play.mockResolvedValue({
      error: { code: 'INTERNAL', details: { kind: 'libmpv-load-failed' } },
    });
    renderWatch('/watch/movie/42');
    await waitFor(() => expect(screen.getByTestId('libmpv-diagnosis')).toBeInTheDocument());
    expect(screen.queryByTestId('video-player')).not.toBeInTheDocument();
    expect(mockApi.player.getProxiedUrl).not.toHaveBeenCalled();
  });

  it('plays live/9 via libmpv and hides SeekBar', async () => {
    mockApi.catalog.getById.mockResolvedValue({ data: { ...movieItem, id: 9, contentType: 'live', name: 'CNN' } });
    renderWatch('/watch/live/9');
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-engine', 'libmpv');
    });
    expect(mockApi.player.play).toHaveBeenCalledWith({ type: 'live', id: 9 });
    expect(screen.getByTestId('video-player')).toHaveAttribute('data-type', 'live');
    expect(screen.queryByTestId('seek-bar')).not.toBeInTheDocument();
  });

  it('shows SeekBar for movie so live hide is not a missing OSD', async () => {
    renderWatch('/watch/movie/42');
    await waitFor(() => expect(screen.getByTestId('seek-bar')).toBeInTheDocument());
  });

  it('resolves series/7 to first episode 101 then plays via libmpv', async () => {
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
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-engine', 'libmpv');
    });
    expect(mockApi.player.play).toHaveBeenCalledWith({ type: 'episode', id: 101 });
    expect(mockApi.player.play).not.toHaveBeenCalledWith({ type: 'series', id: 7 });
    expect(mockApi.player.getProxiedUrl).not.toHaveBeenCalled();
  });

  it('resolves series/7 to episode 101 even when 102 is listed first', async () => {
    mockApi.catalog.getById.mockResolvedValue({
      data: {
        series: { ...movieItem, id: 7, name: 'Show', contentType: 'series', url: ORIGIN },
        seasons: [{
          seasonNumber: 1,
          episodes: [
            { id: 102, seriesId: 7, name: 'E2', url: 'https://origin.example/ep102.m3u8', season: 1, episode: 2, cover: null, addedAt: 0 },
            { id: 101, seriesId: 7, name: 'E1', url: 'https://origin.example/ep101.m3u8', season: 1, episode: 1, cover: null, addedAt: 0 },
          ],
        }],
      },
    });
    renderWatch('/watch/series/7');
    await waitFor(() => {
      expect(mockApi.player.play).toHaveBeenCalledWith({ type: 'episode', id: 101 });
    });
    expect(mockApi.player.play).not.toHaveBeenCalledWith({ type: 'episode', id: 102 });
  });

  it('plays /watch/episode/:id via libmpv without catalog.getById(episode)', async () => {
    renderWatch('/watch/episode/501');
    await waitFor(() => {
      expect(screen.getByTestId('video-player')).toHaveAttribute('data-engine', 'libmpv');
    });
    expect(mockApi.catalog.getById).not.toHaveBeenCalled();
    expect(mockApi.player.play).toHaveBeenCalledWith({ type: 'episode', id: 501 });
    expect(mockApi.player.getSource).toHaveBeenCalledWith({ type: 'episode', id: 501 });
    expect(mockApi.player.getProxiedUrl).not.toHaveBeenCalled();
  });
});
