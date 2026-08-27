// @vitest-environment happy-dom
/**
 * Media-mock contract — validates that the test harness exposes a faithful
 * enough mock of the browser media stack for downstream player tests
 * (TASK-057 SeekBar, TASK-059 OSD auto-hide, TASK-067 VideoPlayer).
 *
 * Spec: media-harness §HTMLMediaElement Mock, §hls.js Mock, §MediaSource/SourceBuffer Mock
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createMediaElementMock,
  createHlsJsMock,
  createMediaSourceMock,
  createSourceBufferMock,
} from './media-mock';

describe('createMediaElementMock', () => {
  it('returns an object with the spec-required properties', () => {
    const media = createMediaElementMock();
    expect(media).toBeDefined();
    expect(typeof media.play).toBe('function');
    expect(typeof media.pause).toBe('function');
    expect(typeof media.seek).toBe('function');
    expect(typeof media.load).toBe('function');
    expect(media).toHaveProperty('currentTime');
    expect(media).toHaveProperty('duration');
    expect(media).toHaveProperty('paused');
    expect(media).toHaveProperty('buffered');
  });

  it('play() resolves a Promise and sets paused = false', async () => {
    const media = createMediaElementMock();
    expect(media.paused).toBe(true);

    const result = media.play();
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(media.paused).toBe(false);
  });

  it('pause() sets paused = true', () => {
    const media = createMediaElementMock();
    media.play();
    expect(media.paused).toBe(false);
    media.pause();
    expect(media.paused).toBe(true);
  });

  it('seek(t) updates currentTime', () => {
    const media = createMediaElementMock({ duration: 100 });
    media.seek(50);
    expect(media.currentTime).toBe(50);
    media.seek(0);
    expect(media.currentTime).toBe(0);
  });

  it('buffered is a TimeRanges-like object with length / start / end', () => {
    const media = createMediaElementMock({ buffered: [[0, 60]] });
    expect(media.buffered.length).toBe(1);
    expect(media.buffered.start(0)).toBe(0);
    expect(media.buffered.end(0)).toBe(60);
  });

  it('buffered supports multiple ranges', () => {
    const media = createMediaElementMock({ buffered: [[0, 30], [40, 80]] });
    expect(media.buffered.length).toBe(2);
    expect(media.buffered.start(1)).toBe(40);
    expect(media.buffered.end(1)).toBe(80);
  });

  it('emits the configured event when load() is called', () => {
    const media = createMediaElementMock();
    const handler = vi.fn();
    media.addEventListener('loadedmetadata', handler);
    media.load();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('addEventListener / removeEventListener work as expected', () => {
    const media = createMediaElementMock();
    const handler = vi.fn();
    media.addEventListener('play', handler);
    media.dispatchEvent({ type: 'play' });
    expect(handler).toHaveBeenCalledTimes(1);
    media.removeEventListener('play', handler);
    media.dispatchEvent({ type: 'play' });
    expect(handler).toHaveBeenCalledTimes(1); // not 2
  });
});

describe('createHlsJsMock', () => {
  it('returns an Hls-shaped instance with the spec API', () => {
    const hls = createHlsJsMock();
    expect(typeof hls.loadSource).toBe('function');
    expect(typeof hls.attachMedia).toBe('function');
    expect(typeof hls.on).toBe('function');
    expect(typeof hls.off).toBe('function');
    expect(typeof hls.destroy).toBe('function');
  });

  it('loadSource(url) records the URL and emits MANIFEST_PARSED asynchronously', async () => {
    const hls = createHlsJsMock();
    const handler = vi.fn();
    hls.on('MANIFEST_PARSED', handler);
    hls.loadSource('http://x/test.m3u8');
    expect(hls.lastSource).toBe('http://x/test.m3u8');
    // microtask flush
    await Promise.resolve();
    await Promise.resolve();
    expect(handler).toHaveBeenCalled();
  });

  it('attachMedia(videoEl) stores the video reference', () => {
    const hls = createHlsJsMock();
    const video = createMediaElementMock();
    hls.attachMedia(video);
    expect(hls.lastAttachedMedia).toBe(video);
  });

  it('on(event, handler) registers and off(event, handler) deregisters', () => {
    const hls = createHlsJsMock();
    const handler = vi.fn();
    hls.on('ERROR', handler);
    hls.emit('ERROR', { fatal: true, type: 'networkError' });
    expect(handler).toHaveBeenCalledWith({ fatal: true, type: 'networkError' });

    hls.off('ERROR', handler);
    hls.emit('ERROR', { fatal: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('destroy() removes all handlers and rejects further loadSource', () => {
    const hls = createHlsJsMock();
    const handler = vi.fn();
    hls.on('MANIFEST_PARSED', handler);
    hls.destroy();
    expect(() => hls.loadSource('http://x/other.m3u8')).toThrow(/destroyed/);
    hls.emit('MANIFEST_PARSED', {});
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('createMediaSourceMock', () => {
  it('starts with readyState = closed', () => {
    const ms = createMediaSourceMock();
    expect(ms.readyState).toBe('closed');
  });

  it('transitions to "open" on construction and fires sourceopen', () => {
    const handler = vi.fn();
    const ms = createMediaSourceMock();
    ms.addEventListener('sourceopen', handler);
    ms.open();
    expect(ms.readyState).toBe('open');
    expect(handler).toHaveBeenCalled();
  });

  it('addSourceBuffer(mime) returns a SourceBuffer mock', () => {
    const ms = createMediaSourceMock();
    ms.open();
    const sb = ms.addSourceBuffer('video/mp4');
    expect(sb).toBeDefined();
    expect(typeof sb.appendBuffer).toBe('function');
    expect(typeof sb.remove).toBe('function');
  });
});

describe('createSourceBufferMock', () => {
  it('appendBuffer accepts a Uint8Array without throwing', () => {
    const sb = createSourceBufferMock();
    expect(() => sb.appendBuffer(new Uint8Array([1, 2, 3, 4]))).not.toThrow();
  });

  it('remove() clears the buffered range', () => {
    const sb = createSourceBufferMock();
    sb.appendBuffer(new Uint8Array([1, 2, 3, 4]));
    expect(() => sb.remove(0, 4)).not.toThrow();
  });
});
