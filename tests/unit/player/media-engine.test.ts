// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMediaElementMock, createHlsJsMock } from '../../helpers/media-mock';
import { createTestMediaEngine } from './media-engine-harness';

describe('MediaEngine', () => {
  let videoEl: ReturnType<typeof createMediaElementMock>;
  let hlsMockFactory: () => ReturnType<typeof createHlsJsMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    videoEl = createMediaElementMock({ duration: 3600 });
    hlsMockFactory = () => createHlsJsMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('engine selection', () => {
    it('selects hls.js for HLS format', async () => {
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.m3u8', mediaFormat: 'hls', type: 'movie' },
        hlsMockFactory,
      );
      expect(engine.kind).toBe('hls');
      await engine.load();
      engine.destroy();
    });

    it('selects hls.js for DASH format (deferred engine)', async () => {
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.mpd', mediaFormat: 'dash', type: 'movie' },
        hlsMockFactory,
      );
      expect(engine.kind).toBe('hls');
      await engine.load();
      engine.destroy();
    });

    it('selects hls.js for TS format', async () => {
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.ts', mediaFormat: 'ts', type: 'live' },
        hlsMockFactory,
      );
      expect(engine.kind).toBe('hls');
      await engine.load();
      engine.destroy();
    });

    it('selects hls.js for unknown format (default to hls.js)', async () => {
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.bin', mediaFormat: 'unknown', type: 'movie' },
        hlsMockFactory,
      );
      expect(engine.kind).toBe('hls');
      await engine.load();
      engine.destroy();
    });

    it('selects native <video> for MP4 format', async () => {
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/video.mp4', mediaFormat: 'mp4', type: 'movie' },
        hlsMockFactory,
      );
      expect(engine.kind).toBe('native');
      await engine.load();
      expect(videoEl.src).toBe('https://example.com/video.mp4');
      engine.destroy();
    });
  });
});
