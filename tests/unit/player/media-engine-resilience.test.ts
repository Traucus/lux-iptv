// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMediaElementMock, createHlsJsMock } from '../../helpers/media-mock';
import { createTestMediaEngine } from './media-engine-harness';

describe('MediaEngine resilience and cleanup', () => {
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

  describe('resilience loop integration', () => {
    it('emits recovering events during hls.js retries', async () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.m3u8', mediaFormat: 'hls', type: 'movie' },
        hlsMockFactory,
      );
      engine.on('recovering', (data) => events.push({ event: 'recovering', data }));
      engine.on('fatal', (data) => events.push({ event: 'fatal', data }));
      await engine.load();
      const hlsMock = engine._test.getHlsMock();
      if (hlsMock) {
        hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(events.find((e) => e.event === 'recovering')).toBeDefined();
      engine.destroy();
    });

    it('emits fatal event after exhausted retries', async () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.m3u8', mediaFormat: 'hls', type: 'movie' },
        hlsMockFactory,
      );
      engine.on('fatal', (data) => events.push({ event: 'fatal', data }));
      await engine.load();
      const hlsMock = engine._test.getHlsMock();
      if (hlsMock) {
        hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
        await vi.advanceTimersByTimeAsync(10);
        hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
        await vi.advanceTimersByTimeAsync(10);
        hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
        await vi.advanceTimersByTimeAsync(10);
        hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
        await vi.advanceTimersByTimeAsync(10);
      }
      const fatalEvent = events.find((e) => e.event === 'fatal');
      expect(fatalEvent).toBeDefined();
      expect(fatalEvent?.data).toMatchObject({ attempts: 3 });
      engine.destroy();
    });

    it('emits progress event on successful load', async () => {
      const events: Array<{ event: string; data: unknown }> = [];
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.m3u8', mediaFormat: 'hls', type: 'movie' },
        hlsMockFactory,
      );
      engine.on('progress', (data) => events.push({ event: 'progress', data }));
      await engine.load();
      const progressEvent = events.find(
        (e) => e.event === 'progress' && (e.data as Record<string, unknown>).loaded === true,
      );
      expect(progressEvent).toBeDefined();
      engine.destroy();
    });
  });

  describe('cleanup', () => {
    it('destroy() cleans up hls.js instance', async () => {
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.m3u8', mediaFormat: 'hls', type: 'movie' },
        hlsMockFactory,
      );
      await engine.load();
      const hlsMock = engine._test.getHlsMock();
      expect(hlsMock).not.toBeNull();
      expect(() => engine.destroy()).not.toThrow();
      expect(hlsMock.destroyed).toBe(true);
      expect(engine._test.getHlsMock()).toBeNull();
    });

    it('destroy() prevents further events', async () => {
      const events: string[] = [];
      const engine = createTestMediaEngine(
        videoEl,
        { url: 'https://example.com/stream.m3u8', mediaFormat: 'hls', type: 'movie' },
        hlsMockFactory,
      );
      engine.on('recovering', () => events.push('recovering'));
      await engine.load();
      engine.destroy();
      const hlsMock = engine._test.getHlsMock();
      if (hlsMock) {
        hlsMock.emit('ERROR', { fatal: true, type: 'networkError' });
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(events).toHaveLength(0);
    });
  });
});
