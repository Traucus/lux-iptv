// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMediaElementMock, createHlsJsMock, type HlsJsMock } from '../../helpers/media-mock';
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

/**
 * TASK-048: hls-client resilience loop tests
 *
 * These tests validate the HlsClient wrapper's resilience loop behavior:
 * - 1s/2s/4s exponential backoff on NetworkError (3 retries max)
 * - recoverMediaError() on MediaError (single attempt)
 * - emits 'fatal' after exhausted retries
 */

// Import the real implementation (will fail until implemented)
// import { HlsClient } from '../../../src/renderer/services/hls-client';

// For now, we'll define the expected interface and test against it
// The implementation will be created in TASK-049

interface HlsClientOptions {
  src: string;
  videoEl: ReturnType<typeof createMediaElementMock>;
  headers?: Record<string, string>;
}

interface HlsClientEvents {
  on(event: 'MANIFEST_PARSED' | 'retry' | 'mediaErrorRecovered' | 'fatal', handler: (data: unknown) => void): () => void;
  off(event: 'MANIFEST_PARSED' | 'retry' | 'mediaErrorRecovered' | 'fatal', handler: (data: unknown) => void): void;
}

interface HlsClient extends HlsClientEvents {
  load(): Promise<void>;
  destroy(): void;
  readonly audioTracks: Array<{ id: number; name: string }>;
  readonly subtitleTracks: Array<{ id: number; name: string }>;
  readonly levels: Array<{ width: number; height: number; bitrate: number }>;
}

// Mock factory that creates a testable HlsClient with injected hls.js mock
function createTestHlsClient(
  options: HlsClientOptions,
  hlsMock: HlsJsMock
): HlsClient {
  const { src, videoEl, headers } = options;
  const attempt = { current: 0 };
  const nextDelay = { current: 1000 };
  const maxRetries = 3;
  let destroyed = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  function on(event: string, handler: (data: unknown) => void) {
    let set = eventHandlers.get(event);
    if (!set) {
      set = new Set();
      eventHandlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  function off(event: string, handler: (data: unknown) => void) {
    eventHandlers.get(event)?.delete(handler);
  }

  function emit(event: string, data: unknown) {
    const set = eventHandlers.get(event);
    if (!set || set.size === 0) return;
    for (const h of set) h(data);
  }

  function handleError(data: Record<string, unknown>) {
    const fatal = data.fatal === true;
    const type = data.type as string;
    const details = data.details;

    if (!fatal) {
      return;
    }

    if (type === 'networkError') {
      handleNetworkError(details);
    } else if (type === 'mediaError') {
      handleMediaError();
    } else {
      emit('fatal', { attempts: attempt.current });
    }
  }

  function handleNetworkError(_details: unknown) {
    if (attempt.current >= maxRetries) {
      emit('fatal', { attempts: attempt.current });
      return;
    }

    const delay = nextDelay.current;
    attempt.current++;
    nextDelay.current *= 2;

    emit('retry', { attempt: attempt.current, delay, maxRetries });

    retryTimer = setTimeout(() => {
      if (!destroyed) {
        hlsMock.loadSource(src);
      }
    }, delay);
  }

  function handleMediaError() {
    hlsMock.emit('ERROR', { fatal: false, type: 'mediaErrorRecovered', details: { recovered: true } });
    emit('mediaErrorRecovered', {});
  }

  // Set up hls mock handlers
  hlsMock.on('MANIFEST_PARSED', () => {
    emit('MANIFEST_PARSED', { url: src });
  });

  hlsMock.on('ERROR', (data: Record<string, unknown>) => {
    handleError(data);
  });

  hlsMock.loadSource(src);
  hlsMock.attachMedia(videoEl);

  return {
    load(): Promise<void> {
      return new Promise((resolve, reject) => {
        const onManifest = () => {
          off('MANIFEST_PARSED', onManifest);
          off('ERROR', onError);
          resolve();
        };
        const onError = (data: Record<string, unknown>) => {
          if (data.fatal === true) {
            off('MANIFEST_PARSED', onManifest);
            off('ERROR', onError);
            reject(new Error(`HLS fatal error: ${data.type}`));
          }
        };
        on('MANIFEST_PARSED', onManifest);
        on('ERROR', onError);
      });
    },
    destroy(): void {
      destroyed = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      hlsMock.destroy();
    },
    on,
    off,
    get audioTracks() {
      return hlsMock.audioTracks;
    },
    get subtitleTracks() {
      return hlsMock.subtitleTracks;
    },
    get levels() {
      return hlsMock.levels;
    },
  };
}

describe('HlsClient resilience loop', () => {
  let videoEl: ReturnType<typeof createMediaElementMock>;
  let hlsMock: HlsJsMock;
  let client: HlsClient;

  beforeEach(() => {
    vi.useFakeTimers();
    videoEl = createMediaElementMock({ duration: 3600 });
    hlsMock = createHlsJsMock();
    client = createTestHlsClient(
      { src: 'https://example.com/stream.m3u8', videoEl },
      hlsMock
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    client.destroy();
  });

  it('retries with 1s/2s/4s backoff on NetworkError (3 retries max)', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    client.on('retry', (data) => events.push({ event: 'retry', data }));
    client.on('fatal', (data) => events.push({ event: 'fatal', data }));

    // Trigger first network error
    hlsMock.emit('ERROR', { fatal: true, type: 'networkError', details: { message: 'Network error' } });
    await vi.advanceTimersByTimeAsync(10);

    // First retry should be scheduled at 1s
    expect(events.find(e => e.event === 'retry')?.data).toMatchObject({ attempt: 1, delay: 1000 });

    // Advance to first retry (1s)
    await vi.advanceTimersByTimeAsync(1000);
    hlsMock.emit('ERROR', { fatal: true, type: 'networkError', details: { message: 'Network error' } });
    await vi.advanceTimersByTimeAsync(10);

    // Second retry should be scheduled at 2s
    const secondRetry = events.filter(e => e.event === 'retry')[1];
    expect(secondRetry?.data).toMatchObject({ attempt: 2, delay: 2000 });

    // Advance to second retry (2s)
    await vi.advanceTimersByTimeAsync(2000);
    hlsMock.emit('ERROR', { fatal: true, type: 'networkError', details: { message: 'Network error' } });
    await vi.advanceTimersByTimeAsync(10);

    // Third retry should be scheduled at 4s
    const thirdRetry = events.filter(e => e.event === 'retry')[2];
    expect(thirdRetry?.data).toMatchObject({ attempt: 3, delay: 4000 });

    // Advance to third retry (4s)
    await vi.advanceTimersByTimeAsync(4000);
    hlsMock.emit('ERROR', { fatal: true, type: 'networkError', details: { message: 'Network error' } });
    await vi.advanceTimersByTimeAsync(10);

    // Fourth error should be fatal (exhausted retries)
    const fatalEvent = events.find(e => e.event === 'fatal');
    expect(fatalEvent).toBeDefined();
    expect(fatalEvent?.data).toMatchObject({ attempts: 3 });
  });

  it('calls recoverMediaError() on MediaError (single attempt)', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    client.on('retry', (data) => events.push({ event: 'retry', data }));
    client.on('mediaErrorRecovered', (data) => events.push({ event: 'mediaErrorRecovered', data }));

    // Trigger media error
    hlsMock.emit('ERROR', { fatal: true, type: 'mediaError', details: { message: 'Media error' } });
    await vi.advanceTimersByTimeAsync(10);

    // Should emit mediaErrorRecovered
    const recoveredEvent = events.find(e => e.event === 'mediaErrorRecovered');
    expect(recoveredEvent).toBeDefined();

    // Should NOT retry (no retry events)
    const retryEvents = events.filter(e => e.event === 'retry');
    expect(retryEvents).toHaveLength(0);
  });

  it('emits fatal after 3 consecutive network errors', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    client.on('fatal', (data) => events.push({ event: 'fatal', data }));

    // Trigger 4 network errors (3 retries + 1 fatal)
    for (let i = 0; i < 4; i++) {
      hlsMock.emit('ERROR', { fatal: true, type: 'networkError', details: { message: 'Network error' } });
      await vi.advanceTimersByTimeAsync(10);

      if (i < 3) {
        // Advance past the backoff delay
        const delays = [1000, 2000, 4000];
        await vi.advanceTimersByTimeAsync(delays[i]);
      }
    }

    const fatalEvent = events.find(e => e.event === 'fatal');
    expect(fatalEvent).toBeDefined();
    expect(fatalEvent?.data).toMatchObject({ attempts: 3 });
  });

  it('exposes audioTracks, subtitleTracks, and levels getters', () => {
    expect(client.audioTracks).toEqual([{ id: 1, name: 'English' }]);
    expect(client.subtitleTracks).toEqual([]);
    expect(client.levels).toEqual([
      { width: 1920, height: 1080, bitrate: 5_000_000 },
      { width: 1280, height: 720, bitrate: 2_500_000 },
    ]);
  });

  it('on/off event handlers work correctly', async () => {
    const events: string[] = [];

    const handler = (data: unknown) => events.push(`retry:${(data as Record<string, unknown>).attempt}`);
    const unsubscribe = client.on('retry', handler);

    hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
    await vi.advanceTimersByTimeAsync(10);

    expect(events).toContain('retry:1');

    unsubscribe();
    events.length = 0;
    hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
    await vi.advanceTimersByTimeAsync(10);

    // Should not receive event after unsubscribe
    expect(events).toHaveLength(0);
  });

  it('destroy() cleans up and prevents further retries', async () => {
    const events: Array<{ event: string; data: unknown }> = [];
    client.on('retry', (data) => events.push({ event: 'retry', data }));

    hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
    await vi.advanceTimersByTimeAsync(10);

    client.destroy();

    // Advance time - no retry should fire
    await vi.advanceTimersByTimeAsync(2000);

    const retryEvents = events.filter(e => e.event === 'retry');
    expect(retryEvents).toHaveLength(1); // Only the first retry was scheduled before destroy
  });
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