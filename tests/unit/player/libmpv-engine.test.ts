import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawn = vi.fn();
vi.mock('node:child_process', () => ({ spawn, execFile: vi.fn(), exec: vi.fn() }));
vi.mock('child_process', () => ({ spawn, execFile: vi.fn(), exec: vi.fn() }));

import {
  createLibmpvEngine,
  libmpvPlaybackOptions,
  type LibmpvBinding,
} from '../../../src/main/player/libmpv-engine';

function failingBinding(): LibmpvBinding {
  return {
    loadLibrary: () => false,
    play: vi.fn(),
    stop: vi.fn(),
  };
}

function playingBinding(): LibmpvBinding {
  return {
    loadLibrary: vi.fn(() => true),
    play: vi.fn(),
    stop: vi.fn(),
    setOptions: vi.fn(),
  };
}

describe('LibmpvEngine', () => {
  beforeEach(() => {
    spawn.mockReset();
  });

  it('returns libmpv-load-failed when the in-process library cannot load', async () => {
    const engine = createLibmpvEngine(failingBinding());
    const result = await engine.play({
      url: 'https://origin.example/movie.mkv',
      httpHeaders: { 'User-Agent': 'Lux/1' },
    });

    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL', details: { kind: 'libmpv-load-failed' } },
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('never spawns mpv.exe on load failure or play', async () => {
    const engine = createLibmpvEngine(failingBinding());
    await engine.play({ url: 'https://origin.example/movie.mkv', httpHeaders: {} });
    expect(spawn).not.toHaveBeenCalled();
    expect(spawn.mock.calls.flat().join(' ')).not.toMatch(/mpv\.exe/i);
  });

  it('loads the origin URL with item headers in-process when libmpv is available', async () => {
    const binding = playingBinding();
    const engine = createLibmpvEngine(binding);
    const result = await engine.play({
      url: 'https://origin.example/movie.mkv',
      httpHeaders: { Referer: 'https://panel.example' },
    });

    expect(result).toEqual({ ok: true, engine: 'libmpv' });
    expect(binding.play).toHaveBeenCalledWith(
      'https://origin.example/movie.mkv',
      { Referer: 'https://panel.example' },
      undefined,
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it('forwards the native window handle to in-process play', async () => {
    const binding = playingBinding();
    const engine = createLibmpvEngine(binding);
    const nativeWindowHandle = Buffer.alloc(8);
    nativeWindowHandle.writeBigUInt64LE(0x12345678n);
    const result = await engine.play({
      url: 'https://origin.example/movie.mkv',
      httpHeaders: {},
      nativeWindowHandle,
    });

    expect(result).toEqual({ ok: true, engine: 'libmpv' });
    expect(binding.play).toHaveBeenCalledWith(
      'https://origin.example/movie.mkv',
      {},
      nativeWindowHandle,
    );
  });

  it('returns libmpv-open-failed when play reports the file did not open', async () => {
    const binding = playingBinding();
    (binding.play as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const engine = createLibmpvEngine(binding);
    const result = await engine.play({
      url: 'https://origin.example/dead.m3u8',
      httpHeaders: {},
    });
    expect(result).toEqual({
      ok: false,
      error: { code: 'INTERNAL', details: { kind: 'libmpv-open-failed' } },
    });
  });

  it('reuses the same in-process session across two plays', async () => {
    const binding = playingBinding();
    const engine = createLibmpvEngine(binding);
    await engine.play({ url: 'https://origin.example/a.mkv', httpHeaders: {} });
    await engine.play({ url: 'https://origin.example/b.mkv', httpHeaders: {} });
    expect(binding.loadLibrary).toHaveBeenCalledTimes(2);
    expect(binding.play).toHaveBeenCalledTimes(2);
  });

  it('does not start a Chromium hls/mpegts/video probe', async () => {
    const engine = createLibmpvEngine(playingBinding());
    const result = await engine.play({
      url: 'https://origin.example/movie.mkv',
      httpHeaders: {},
    });
    expect(result.ok).toBe(true);
    expect('probe' in engine).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
  });

  it('stop is a no-op when libmpv never loaded', async () => {
    const binding = failingBinding();
    const engine = createLibmpvEngine(binding);
    await engine.play({ url: 'https://origin.example/movie.mkv', httpHeaders: {} });
    await engine.stop();
    expect(binding.stop).not.toHaveBeenCalled();
  });

  it('live options enable ~20s cache, reconnect, and auto-safe hwdec', () => {
    const live = libmpvPlaybackOptions('live');
    expect(live.cache).toBe('yes');
    expect(live['cache-secs']).toBe(20);
    expect(live.reconnect).toBe('yes');
    expect(live.hwdec).toBe('auto-safe');
  });

  it('VOD options keep origin quality without live cache or downscale', () => {
    const vod = libmpvPlaybackOptions('vod');
    expect(vod).not.toHaveProperty('cache');
    expect(vod).not.toHaveProperty('cache-secs');
    expect(vod).not.toHaveProperty('reconnect');
    expect(vod).not.toHaveProperty('vf');
    expect(vod['hls-bitrate']).not.toBe('min');
  });

  it('reads track-list and sets aid 2 in-process', async () => {
    const binding = playingBinding();
    binding.getTrackList = () => [
      { id: 1, type: 'audio', title: 'English' },
      { id: 2, type: 'audio', title: 'Spanish' },
      { id: 1, type: 'sub', title: 'English' },
    ];
    binding.setProperty = vi.fn();
    const engine = createLibmpvEngine(binding);
    expect(engine.getTracks().audio).toEqual([
      { id: 1, name: 'English' },
      { id: 2, name: 'Spanish' },
    ]);
    engine.setAudioTrack(2);
    expect(binding.setProperty).toHaveBeenCalledWith('aid', 2);
  });

  it('turns subtitles Off and sub-add loads .srt/.ass', () => {
    const binding = playingBinding();
    binding.setProperty = vi.fn();
    binding.command = vi.fn();
    const engine = createLibmpvEngine(binding);
    engine.setSubtitleTrack(-1);
    expect(binding.setProperty).toHaveBeenCalledWith('sid', 'no');
    engine.addSubtitle('movie.srt');
    engine.addSubtitle('movie.ass');
    expect(binding.command).toHaveBeenCalledWith(['sub-add', 'movie.srt']);
    expect(binding.command).toHaveBeenCalledWith(['sub-add', 'movie.ass']);
  });

  it('seeks libmpv to an absolute time', () => {
    const binding = playingBinding();
    binding.command = vi.fn();
    createLibmpvEngine(binding).seek(75);
    expect(binding.command).toHaveBeenCalledWith(['seek', 75, 'absolute']);
  });

  it('setPaused writes the libmpv pause property after play', async () => {
    const binding = playingBinding();
    binding.setProperty = vi.fn();
    const engine = createLibmpvEngine(binding);
    await engine.play({ url: 'https://origin.example/movie.mkv', httpHeaders: {} });
    engine.setPaused(true);
    expect(binding.setProperty).toHaveBeenCalledWith('pause', 'yes');
    engine.setPaused(false);
    expect(binding.setProperty).toHaveBeenCalledWith('pause', 'no');
  });

  it('applies live options in-process before loading the origin URL', async () => {
    const binding = playingBinding();
    const engine = createLibmpvEngine(binding);
    await engine.play({
      url: 'https://origin.example/live.m3u8',
      httpHeaders: { 'User-Agent': 'Lux/1' },
      profile: 'live',
    });
    expect(binding.setOptions).toHaveBeenCalledWith(libmpvPlaybackOptions('live'));
    expect(binding.play).toHaveBeenCalledWith(
      'https://origin.example/live.m3u8',
      { 'User-Agent': 'Lux/1' },
      undefined,
    );
    expect(spawn).not.toHaveBeenCalled();
  });
});
