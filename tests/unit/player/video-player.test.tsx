// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

/**
 * TASK-067: VideoPlayer tests
 *
 * Tests the production VideoPlayer organism (in-process libmpv host + OSD).
 */

const { mockMediaEngine } = vi.hoisted(() => ({
  mockMediaEngine: {
    kind: 'hls' as const,
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    off: vi.fn(),
  },
}));

vi.mock('../../../src/renderer/services/media-engine', () => ({
  createMediaEngine: vi.fn().mockReturnValue(mockMediaEngine),
  MediaEngine: {},
  EngineKind: {},
  PlaybackSource: {},
}));

const playerMocks = vi.hoisted(() => {
  const state = {
    audio: [
      { id: 1, name: 'English' },
      { id: 2, name: 'Spanish' },
    ],
    subtitles: [{ id: 1, name: 'English' }],
  };
  return {
    state,
    mockStop: vi.fn().mockResolvedValue({ data: { stopped: true } }),
    mockGetTracks: vi.fn(async () => ({
      data: { audio: [...state.audio], subtitles: [...state.subtitles] },
    })),
    mockSetAudioTrack: vi.fn().mockResolvedValue({ data: true }),
    mockSetSubtitleTrack: vi.fn().mockResolvedValue({ data: true }),
    mockAddSubtitle: vi.fn(async (input: { path: string }) => {
      const name = input.path.replace(/^.*[/\\]/, '');
      const id = Math.max(0, ...state.subtitles.map((track) => track.id)) + 1;
      state.subtitles.push({ id, name });
      return { data: { id, name } };
    }),
    mockSeek: vi.fn().mockResolvedValue({ data: true }),
    mockGetStatus: vi.fn(async () => ({
      data: { currentTime: 50, duration: 100, buffered: 60 },
    })),
    mockSetFullScreen: vi.fn().mockResolvedValue({ data: { fullscreen: true } }),
    mockSetPaused: vi.fn().mockResolvedValue({ data: { paused: true } }),
    reset() {
      state.audio = [
        { id: 1, name: 'English' },
        { id: 2, name: 'Spanish' },
      ];
      state.subtitles = [{ id: 1, name: 'English' }];
    },
  };
});
vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => ({
    player: {
      stop: playerMocks.mockStop,
      play: vi.fn(),
      getTracks: playerMocks.mockGetTracks,
      setAudioTrack: playerMocks.mockSetAudioTrack,
      setSubtitleTrack: playerMocks.mockSetSubtitleTrack,
      addSubtitle: playerMocks.mockAddSubtitle,
      seek: playerMocks.mockSeek,
      getStatus: playerMocks.mockGetStatus,
      getNextEpisode: vi.fn().mockResolvedValue({ data: null }),
      setFullScreen: playerMocks.mockSetFullScreen,
      setPaused: playerMocks.mockSetPaused,
    },
  }),
}));

import { VideoPlayer as ProductionVideoPlayer } from '../../../src/renderer/components/organisms/VideoPlayer';
import { createMediaEngine } from '../../../src/renderer/services/media-engine';

describe('Production VideoPlayer libmpv host', () => {
  const source = {
    url: 'https://origin.example/movie.mkv',
    mediaFormat: 'unknown' as const,
    type: 'movie' as const,
    engine: 'libmpv' as const,
  };

  it('hosts a libmpv surface and does not render a native video engine', () => {
    render(<ProductionVideoPlayer source={source} />);
    expect(screen.getByTestId('libmpv-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('video-element')).not.toBeInTheDocument();
    expect(createMediaEngine).not.toHaveBeenCalled();
  });

  it('shows diagnosis UI when libmpv failed to load', () => {
    render(
      <ProductionVideoPlayer
        source={source}
        diagnosis={{ kind: 'libmpv-load-failed' }}
      />,
    );
    expect(screen.getByTestId('libmpv-diagnosis')).toBeInTheDocument();
    expect(screen.getByTestId('libmpv-diagnosis')).toHaveTextContent(/libmpv/i);
  });

  it('does not stop libmpv when the OSD effect re-runs', () => {
    const { unmount } = render(<ProductionVideoPlayer source={source} />);
    unmount();
    expect(playerMocks.mockStop).not.toHaveBeenCalled();
  });
});

describe('Production VideoPlayer tracks (slice 3)', () => {
  const source = {
    url: 'https://origin.example/movie.mkv',
    mediaFormat: 'unknown' as const,
    type: 'movie' as const,
    engine: 'libmpv' as const,
  };

  beforeEach(() => {
    playerMocks.reset();
    vi.clearAllMocks();
  });

  it('selects audio track aid 2', async () => {
    render(<ProductionVideoPlayer source={source} />);
    await waitFor(() => expect(screen.getByTestId('osd-audio-button')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('osd-audio-button'));
    fireEvent.click(screen.getByTestId('track-option-1'));
    expect(playerMocks.mockSetAudioTrack).toHaveBeenCalledWith({ aid: 2 });
  });

  it('selects Off so no subtitle shows', async () => {
    render(<ProductionVideoPlayer source={source} />);
    await waitFor(() => expect(screen.getByTestId('osd-subtitle-button')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('osd-subtitle-button'));
    fireEvent.click(screen.getByText('Off'));
    expect(playerMocks.mockSetSubtitleTrack).toHaveBeenCalledWith({ sid: -1 });
  });

  it('makes loaded .srt and .ass files selectable', async () => {
    render(<ProductionVideoPlayer source={source} />);
    const input = await screen.findByTestId('osd-add-subtitle');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'movie.srt', { type: 'text/plain' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'movie.ass', { type: 'text/plain' })] },
    });
    await waitFor(() => {
      expect(playerMocks.mockAddSubtitle).toHaveBeenCalledWith({ path: 'movie.srt' });
      expect(playerMocks.mockAddSubtitle).toHaveBeenCalledWith({ path: 'movie.ass' });
    });
    fireEvent.click(screen.getByTestId('osd-subtitle-button'));
    expect(screen.getByText('movie.srt')).toBeInTheDocument();
    expect(screen.getByText('movie.ass')).toBeInTheDocument();
  });

  it('seeks libmpv when SeekBar drags to 75%', async () => {
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        left: 0,
        width: 200,
        right: 200,
        top: 0,
        bottom: 8,
        height: 8,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
    render(<ProductionVideoPlayer source={source} />);
    const seekBar = await screen.findByTestId('seek-bar');
    await waitFor(() => expect(seekBar).toHaveAttribute('aria-valuemax', '100'));
    fireEvent.pointerDown(seekBar, { clientX: 100, pointerId: 1, bubbles: true });
    fireEvent.pointerMove(seekBar, { clientX: 150, pointerId: 1, bubbles: true });
    fireEvent.pointerUp(seekBar, { clientX: 150, pointerId: 1, bubbles: true });
    expect(playerMocks.mockSeek).toHaveBeenLastCalledWith({ time: 75 });
  });
});

describe('Production VideoPlayer fullscreen and OSD (slice 3)', () => {
  const movie = {
    url: 'https://origin.example/movie.mkv',
    mediaFormat: 'unknown' as const,
    type: 'movie' as const,
    engine: 'libmpv' as const,
  };

  beforeEach(() => {
    playerMocks.reset();
    vi.clearAllMocks();
  });

  it('enters exclusive fullscreen via setFullScreen', async () => {
    render(<ProductionVideoPlayer source={movie} />);
    fireEvent.click(await screen.findByTestId('osd-fullscreen'));
    expect(playerMocks.mockSetFullScreen).toHaveBeenCalledWith({ fullscreen: true });
  });

  it('Escape exits exclusive fullscreen', async () => {
    render(<ProductionVideoPlayer source={movie} />);
    await screen.findByTestId('osd-fullscreen');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(playerMocks.mockSetFullScreen).toHaveBeenCalledWith({ fullscreen: false });
  });

  it('disables live −10s', async () => {
    render(
      <ProductionVideoPlayer
        source={{ ...movie, type: 'live', url: 'https://origin.example/live.m3u8' }}
      />,
    );
    const rewind = await screen.findByTestId('osd-rewind10');
    expect(rewind).toBeDisabled();
    fireEvent.click(rewind);
    expect(playerMocks.mockSeek).not.toHaveBeenCalled();
  });

  it('OSD controls expose title tooltips', async () => {
    render(<ProductionVideoPlayer source={movie} />);
    expect(await screen.findByTestId('osd-rewind10')).toHaveAttribute('title');
    expect(screen.getByTestId('osd-play-pause')).toHaveAttribute('title');
    expect(screen.getByTestId('osd-forward10')).toHaveAttribute('title');
    expect(screen.getByTestId('osd-audio-button')).toHaveAttribute('title');
    expect(screen.getByTestId('osd-subtitle-button')).toHaveAttribute('title');
    expect(screen.getByTestId('osd-fullscreen')).toHaveAttribute('title');
  });

  it('play/pause toggles libmpv pause property', async () => {
    render(<ProductionVideoPlayer source={movie} />);
    fireEvent.click(await screen.findByTestId('osd-play-pause'));
    expect(playerMocks.mockSetPaused).toHaveBeenCalledWith({ paused: true });
  });

  it('forwards 10 seconds via seek', async () => {
    render(<ProductionVideoPlayer source={movie} />);
    const forward = await screen.findByTestId('osd-forward10');
    await waitFor(() => expect(screen.getByTestId('seek-bar')).toHaveAttribute('aria-valuemax', '100'));
    fireEvent.click(forward);
    expect(playerMocks.mockSeek).toHaveBeenCalledWith({ time: 60 });
  });
});
