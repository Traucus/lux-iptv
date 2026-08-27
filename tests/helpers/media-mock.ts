/**
 * Media-mock test harness.
 *
 * Spec: media-harness §HTMLMediaElement Mock, §hls.js Mock, §MediaSource/SourceBuffer Mock
 *
 * The mocks below intentionally cover the surface area the Slice-2 player
 * actually exercises. They are NOT a full WHATWG media polyfill — they
 * encode just enough of the contract that downstream tests (SeekBar, OSD,
 * VideoPlayer, next-episode card) can assert behavior without spinning up
 * a real browser.
 *
 *  - createMediaElementMock: HTMLMediaElement-shaped class with play/pause/
 *    seek/load, currentTime/duration, paused, buffered (TimeRanges-like),
 *    addEventListener/removeEventListener/dispatchEvent.
 *
 *  - createHlsJsMock: enough of the hls.js API to drive the resilience loop
 *    and event-driven integration tests. Includes a private `emit()` for
 *    test code to drive events, and `destroy()` to make the instance inert.
 *
 *  - createMediaSourceMock + createSourceBufferMock: minimal MediaSource /
 *    SourceBuffer surface used by MSE-style code paths.
 */

export type BufferedRange = readonly [start: number, end: number];

export type MediaElementMockOptions = {
  duration?: number;
  buffered?: readonly BufferedRange[];
};

export type MockEvent = { type: string; [key: string]: unknown };

type Listener = (event: MockEvent) => void;

export interface MediaElementMock {
  currentTime: number;
  duration: number;
  paused: boolean;
  buffered: TimeRangesLike;
  volume: number;
  muted: boolean;
  playbackRate: number;
  readyState: number;
  src: string;
  play(): Promise<void>;
  pause(): void;
  seek(time: number): void;
  load(): void;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  dispatchEvent(event: MockEvent): boolean;
}

export interface TimeRangesLike {
  readonly length: number;
  start(index: number): number;
  end(index: number): number;
}

function makeTimeRanges(ranges: readonly BufferedRange[]): TimeRangesLike {
  return {
    length: ranges.length,
    start: (i: number) => {
      const r = ranges[i];
      if (!r) throw new RangeError(`TimeRanges index ${i} out of bounds`);
      return r[0];
    },
    end: (i: number) => {
      const r = ranges[i];
      if (!r) throw new RangeError(`TimeRanges index ${i} out of bounds`);
      return r[1];
    },
  };
}

export function createMediaElementMock(options: MediaElementMockOptions = {}): MediaElementMock {
  const listeners = new Map<string, Set<Listener>>();
  const buffered = makeTimeRanges(options.buffered ?? [[0, 0]]);

  const media: MediaElementMock = {
    currentTime: 0,
    duration: options.duration ?? 0,
    paused: true,
    buffered,
    volume: 1,
    muted: false,
    playbackRate: 1,
    readyState: 0,
    src: '',
    play() {
      media.paused = false;
      return Promise.resolve();
    },
    pause() {
      media.paused = true;
    },
    seek(time: number) {
      media.currentTime = time;
    },
    load() {
      // Spec scenario: load() dispatches 'loadedmetadata'. Tests attach a
      // handler to drive their assertions from this signal.
      media.dispatchEvent({ type: 'loadedmetadata' });
    },
    addEventListener(type: string, listener: Listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event: MockEvent) {
      const set = listeners.get(event.type);
      if (!set || set.size === 0) return false;
      for (const listener of set) {
        listener(event);
      }
      return true;
    },
  };

  return media;
}

// ─── hls.js mock ──────────────────────────────────────────────────────────────

export type HlsEvent = 'MANIFEST_PARSED' | 'MEDIA_ATTACHED' | 'ERROR' | 'FRAG_LOADED' | (string & {});

export type HlsEventData = Record<string, unknown>;

export interface HlsJsMock {
  loadSource(url: string): void;
  attachMedia(videoEl: unknown): void;
  on(event: HlsEvent, handler: (data: HlsEventData) => void): void;
  off(event: HlsEvent, handler: (data: HlsEventData) => void): void;
  destroy(): void;
  /** Test-only — drive events synchronously. Not part of real hls.js. */
  emit(event: HlsEvent, data: HlsEventData): void;
  /** Last URL passed to loadSource (null if never called or after destroy). */
  readonly lastSource: string | null;
  /** Last element passed to attachMedia (null if never called or after destroy). */
  readonly lastAttachedMedia: unknown;
  readonly destroyed: boolean;
  readonly levels: Array<{ width: number; height: number; bitrate: number }>;
  readonly audioTracks: Array<{ id: number; name: string }>;
  readonly subtitleTracks: Array<{ id: number; name: string }>;
}

export function createHlsJsMock(): HlsJsMock {
  const handlers = new Map<string, Set<(data: HlsEventData) => void>>();
  let destroyed = false;
  let attachedTo: unknown = null;
  let lastSource: string | null = null;

  const hls: HlsJsMock = {
    loadSource(url: string) {
      if (destroyed) throw new Error('HlsJsMock: cannot loadSource() on destroyed instance');
      lastSource = url;
      // Spec: loadSource emits MANIFEST_PARSED asynchronously. We use a
      // microtask (queueMicrotask) so test code can still attach handlers
      // before the event fires.
      queueMicrotask(() => {
        if (!destroyed) hls.emit('MANIFEST_PARSED', { url });
      });
    },
    attachMedia(videoEl: unknown) {
      if (destroyed) throw new Error('HlsJsMock: cannot attachMedia() on destroyed instance');
      attachedTo = videoEl;
      queueMicrotask(() => {
        if (!destroyed) hls.emit('MEDIA_ATTACHED', { media: videoEl });
      });
    },
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
    },
    off(event, handler) {
      handlers.get(event)?.delete(handler);
    },
    destroy() {
      destroyed = true;
      handlers.clear();
      attachedTo = null;
      lastSource = null;
    },
    emit(event, data) {
      const set = handlers.get(event);
      if (!set || set.size === 0) return;
      for (const h of set) h(data);
    },
    get lastSource() {
      return destroyed ? null : lastSource;
    },
    get lastAttachedMedia() {
      return destroyed ? null : attachedTo;
    },
    get destroyed() {
      return destroyed;
    },
    levels: [
      { width: 1920, height: 1080, bitrate: 5_000_000 },
      { width: 1280, height: 720, bitrate: 2_500_000 },
    ],
    audioTracks: [{ id: 1, name: 'English' }],
    subtitleTracks: [],
  };
  return hls;
}

// ─── MediaSource / SourceBuffer mock ─────────────────────────────────────────

export type MediaSourceReadyState = 'closed' | 'open' | 'ended';

export interface SourceBufferMock {
  appendBuffer(data: Uint8Array | ArrayBuffer): void;
  remove(start: number, end: number): void;
  readonly buffered: TimeRangesLike;
  readonly updating: boolean;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  dispatchEvent(event: MockEvent): boolean;
}

export interface MediaSourceMock {
  readyState: MediaSourceReadyState;
  duration: number;
  readonly sourceBuffers: SourceBufferMock[];
  open(): void;
  addSourceBuffer(mime: string): SourceBufferMock;
  endOfStream(): void;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  dispatchEvent(event: MockEvent): boolean;
}

export function createSourceBufferMock(): SourceBufferMock {
  const listeners = new Map<string, Set<Listener>>();
  const ranges: BufferedRange[] = [];
  const buffered: TimeRangesLike = {
    length: 0,
    start: (i: number) => {
      const r = ranges[i];
      if (!r) throw new RangeError(`SourceBuffer buffered index ${i} OOB`);
      return r[0];
    },
    end: (i: number) => {
      const r = ranges[i];
      if (!r) throw new RangeError(`SourceBuffer buffered index ${i} OOB`);
      return r[1];
    },
  };

  return {
    appendBuffer(data) {
      // Record a synthetic range [0, byteLength] so consumers can inspect.
      const size = data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
      ranges.push([0, size]);
      // Make `length` reactive-ish: the object identity is stable; tests
      // access fields directly and re-read via the `buffered` proxy. We
      // rebuild the proxy on each append to keep `length` accurate.
      Object.defineProperty(buffered, 'length', { value: ranges.length, configurable: true });
    },
    remove(start, end) {
      // Best-effort: drop any range fully inside [start, end].
      for (let i = ranges.length - 1; i >= 0; i--) {
        const r = ranges[i]!;
        if (r[0] >= start && r[1] <= end) ranges.splice(i, 1);
      }
      Object.defineProperty(buffered, 'length', { value: ranges.length, configurable: true });
    },
    buffered,
    updating: false,
    addEventListener(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (!set || set.size === 0) return false;
      for (const l of set) l(event);
      return true;
    },
  };
}

export function createMediaSourceMock(): MediaSourceMock {
  const listeners = new Map<string, Set<Listener>>();
  const sourceBuffers: SourceBufferMock[] = [];

  const ms: MediaSourceMock = {
    readyState: 'closed',
    duration: Infinity,
    sourceBuffers,
    open() {
      ms.readyState = 'open';
      ms.dispatchEvent({ type: 'sourceopen' });
    },
    addSourceBuffer(_mime: string) {
      const sb = createSourceBufferMock();
      sourceBuffers.push(sb);
      return sb;
    },
    endOfStream() {
      ms.readyState = 'ended';
    },
    addEventListener(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent(event) {
      const set = listeners.get(event.type);
      if (!set || set.size === 0) return false;
      for (const l of set) l(event);
      return true;
    },
  };

  // Spec: MediaSource dispatches `sourceopen` on construction. Tests attach
  // the handler before this fires, so we defer to a microtask.
  queueMicrotask(() => {
    ms.open();
  });

  return ms;
}
