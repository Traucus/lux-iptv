// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HlsClient as RealHlsClient } from '../../../src/renderer/services/hls-client';

const hlsState = vi.hoisted(() => ({ instances: [] as Array<{
  config: Record<string, unknown>;
  startLevel: number;
  levels: Array<{ width: number; height: number; bitrate: number }>;
  emit: (event: string, data?: unknown) => void;
}> }));

vi.mock('hls.js', () => {
  const Events = {
    MANIFEST_PARSED: 'MANIFEST_PARSED', MEDIA_ATTACHED: 'MEDIA_ATTACHED', ERROR: 'ERROR',
    FRAG_LOADED: 'FRAG_LOADED', LEVEL_SWITCHED: 'LEVEL_SWITCHED',
    AUDIO_TRACKS_UPDATED: 'AUDIO_TRACKS_UPDATED', SUBTITLE_TRACKS_UPDATED: 'SUBTITLE_TRACKS_UPDATED',
  };
  function Hls(this: Record<string, unknown>, config: Record<string, unknown>) {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
    this.config = config;
    this.startLevel = -1;
    this.levels = [
      { width: 416, height: 234, bitrate: 4e5 }, { width: 640, height: 360, bitrate: 8e5 },
      { width: 854, height: 480, bitrate: 14e5 }, { width: 1280, height: 720, bitrate: 25e5 },
      { width: 1920, height: 1080, bitrate: 5e6 },
    ];
    this.audioTracks = [];
    this.subtitleTracks = [];
    this.on = (event: string, cb: (...args: unknown[]) => void) => {
      const set = handlers.get(event) ?? new Set();
      set.add(cb);
      handlers.set(event, set);
    };
    this.off = () => undefined;
    this.loadSource = () => undefined;
    this.attachMedia = () => undefined;
    this.destroy = () => undefined;
    this.recoverMediaError = () => undefined;
    this.emit = (event: string, data: unknown = {}) => {
      for (const cb of handlers.get(event) ?? []) cb(event, data);
    };
    hlsState.instances.push(this as (typeof hlsState.instances)[number]);
  }
  Hls.isSupported = () => true;
  Hls.Events = Events;
  Hls.ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
  return { default: Hls };
});

describe('HlsClient ABR and latency', () => {
  beforeEach(() => {
    hlsState.instances.length = 0;
  });

  function makeClient(live?: boolean) {
    return new RealHlsClient({
      src: 'http://127.0.0.1/proxy/movie/1',
      videoEl: document.createElement('video'),
      live,
    });
  }

  it('uses the IPTV ABR profile: no size cap, auto start, 30s buffer', () => {
    const client = makeClient(false);
    const hls = hlsState.instances[0];
    expect(hls.config.capLevelToPlayerSize).toBe(false);
    expect(hls.config.startLevel).toBe(-1);
    expect(hls.config.maxBufferLength).toBe(30);
    expect(hls.config.lowLatencyMode).toBe(false);
    hls.emit('MANIFEST_PARSED');
    expect(hls.startLevel).toBe(-1);
    client.destroy();
  });

  it('unmutes and plays after MANIFEST_PARSED', () => {
    const video = document.createElement('video');
    const play = vi.spyOn(video, 'play').mockResolvedValue(undefined);
    const client = new RealHlsClient({
      src: 'http://127.0.0.1/proxy/movie/1',
      videoEl: video,
    });
    hlsState.instances[0].emit('MANIFEST_PARSED');
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(1);
    expect(play).toHaveBeenCalled();
    client.destroy();
  });

  it('keeps lowLatencyMode off for live IPTV and VOD', () => {
    const live = makeClient(true);
    expect(hlsState.instances[0].config.lowLatencyMode).toBe(false);
    live.destroy();
    const vod = makeClient(false);
    expect(hlsState.instances[1].config.lowLatencyMode).toBe(false);
    vod.destroy();
  });
});
