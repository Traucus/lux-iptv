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
    expect(screen.getByTestId('player-shell')).toHaveClass('h-screen', 'w-screen');
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
