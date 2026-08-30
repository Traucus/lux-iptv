import mpegts from 'mpegts.js';
import { HlsClient } from './hls-client';

/**
 * MediaEngine — Unified playback engine.
 *
 * IPTV origins lie about extensions. Probe in order:
 * 1. hls.js (playlists / HLS-disguised URLs)
 * 2. mpegts.js (raw MPEG-TS, common Xtream "mp4")
 * 3. native <video> (real progressive MP4)
 */

export type MediaFormat = 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';

export interface PlaybackSource {
  /** Proxied or direct stream URL */
  url: string;
  /** Media format for engine selection */
  mediaFormat: MediaFormat;
  /** Optional HTTP headers for degraded path (no proxy) */
  httpHeaders?: Record<string, string>;
  /** Content type for UI branching */
  type: 'live' | 'movie' | 'episode';
}

export type EngineKind = 'hls' | 'mpegts' | 'native';

export type MediaEngineEvent =
  | 'progress'
  | 'buffered'
  | 'error'
  | 'ended'
  | 'fatal'
  | 'recovering';

export type MediaEngineEventData = Record<string, unknown>;

export interface MediaEngine {
  /** Selected engine kind */
  readonly kind: EngineKind;
  /** Load the stream, resolves on MANIFEST_PARSED (hls) or loadedmetadata (native) */
  load(): Promise<void>;
  /** Destroy the engine and clean up resources */
  destroy(): void;
  /** Subscribe to engine events */
  on(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): () => void;
  /** Unsubscribe from engine events */
  off(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): void;
  /** Available quality levels (bitrate/resolution) - hls.js only */
  readonly levels: Array<{ width: number; height: number; bitrate: number }>;
  /** Available audio tracks - hls.js only */
  readonly audioTracks: Array<{ id: number; name: string; lang?: string }>;
  /** Available subtitle tracks - hls.js only */
  readonly subtitleTracks: Array<{ id: number; name: string; lang?: string }>;
  /** Current playback level index - hls.js only */
  readonly currentLevel: number;
}

/**
 * Creates a MediaEngine that probes HLS → MPEG-TS → native.
 * mediaFormat is a hint, not a hard engine switch.
 */
export function createMediaEngine(
  videoEl: HTMLVideoElement,
  source: PlaybackSource
): MediaEngine {
  return new FallbackMediaEngine(videoEl, source);
}

/**
 * HLS-based media engine using hls.js via HlsClient wrapper.
 */
class HlsMediaEngine implements MediaEngine {
  readonly kind: EngineKind = 'hls';
  private hlsClient: HlsClient | null = null;
  private videoEl: HTMLVideoElement;
  private source: PlaybackSource;
  private destroyed = false;

  // Resilience state (delegated to HlsClient)
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // Event emitter
  private handlers = new Map<string, Set<(data: MediaEngineEventData) => void>>();

  constructor(videoEl: HTMLVideoElement, source: PlaybackSource) {
    this.videoEl = videoEl;
    this.source = source;
  }

  get levels(): Array<{ width: number; height: number; bitrate: number }> {
    return this.hlsClient?.levels ?? [];
  }

  get audioTracks(): Array<{ id: number; name: string; lang?: string }> {
    return this.hlsClient?.audioTracks ?? [];
  }

  get subtitleTracks(): Array<{ id: number; name: string; lang?: string }> {
    return this.hlsClient?.subtitleTracks ?? [];
  }

  get currentLevel(): number {
    return this.hlsClient?.currentLevel ?? -1;
  }

  load(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('MediaEngine destroyed'));
    }

    this.hlsClient = new HlsClient({
      src: this.source.url,
      videoEl: this.videoEl,
      headers: this.source.httpHeaders,
      live: this.source.type === 'live',
    });

    this.attachHlsClientListeners();

    return this.hlsClient.load();
  }

  private attachHlsClientListeners(): void {
    if (!this.hlsClient) return;

    this.hlsClient.on('MANIFEST_PARSED', () => {
      // Reset resilience state on successful manifest parse (handled in HlsClient)
      this.emit('progress', { loaded: true });
    });

    this.hlsClient.on('retry', (data) => {
      this.emit('recovering', data);
    });

    this.hlsClient.on('mediaErrorRecovered', () => {
      this.emit('progress', { recovered: true });
    });

    this.hlsClient.on('fatal', (data) => {
      this.emit('fatal', data);
    });

    this.hlsClient.on('ERROR', (data) => {
      if (data.fatal === false) {
        this.emit('error', data);
      }
    });
  }

  destroy(): void {
    this.destroyed = true;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.hlsClient) {
      this.hlsClient.destroy();
      this.hlsClient = null;
    }

    this.handlers.clear();
  }

  on(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  off(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: MediaEngineEvent, data: MediaEngineEventData): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const h of set) h(data);
  }
}

/**
 * Native media engine using the browser's built-in <video> element.
 * Used for MP4 and other natively supported formats.
 */
class NativeMediaEngine implements MediaEngine {
  readonly kind: EngineKind = 'native';
  private videoEl: HTMLVideoElement;
  private source: PlaybackSource;
  private destroyed = false;
  private handlers = new Map<string, Set<(data: MediaEngineEventData) => void>>();
  private loadedMetadataHandler: (() => void) | null = null;
  private errorHandler: ((e: Event) => void) | null = null;
  private endedHandler: (() => void) | null = null;
  private progressHandler: (() => void) | null = null;

  constructor(videoEl: HTMLVideoElement, source: PlaybackSource) {
    this.videoEl = videoEl;
    this.source = source;
  }

  get levels(): Array<{ width: number; height: number; bitrate: number }> {
    return [];
  }

  get audioTracks(): Array<{ id: number; name: string; lang?: string }> {
    return [];
  }

  get subtitleTracks(): Array<{ id: number; name: string; lang?: string }> {
    return [];
  }

  get currentLevel(): number {
    return -1;
  }

  load(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('MediaEngine destroyed'));
    }

    return new Promise((resolve, reject) => {
      this.loadedMetadataHandler = () => {
        this.cleanupEventListeners();
        this.emit('progress', { loaded: true });
        resolve();
      };

      this.errorHandler = (e: Event) => {
        // Use event target for error info
        const videoEl = e.target as HTMLVideoElement;
        const error = videoEl.error;
        this.emit('error', {
          fatal: true,
          type: 'nativeError',
          details: { code: error?.code, message: error?.message },
        });
        this.emit('fatal', { code: error?.code, message: error?.message });
        this.cleanupEventListeners();
        reject(new Error(`Native video error: ${error?.code}`));
      };

      this.endedHandler = () => {
        this.emit('ended', {});
      };

      this.progressHandler = () => {
        this.emit('buffered', {
          buffered: this.getBufferedRanges(),
        });
      };

      this.videoEl.addEventListener('loadedmetadata', this.loadedMetadataHandler);
      this.videoEl.addEventListener('error', this.errorHandler);
      this.videoEl.addEventListener('ended', this.endedHandler);
      this.videoEl.addEventListener('progress', this.progressHandler);

      // Set source and start loading
      this.videoEl.src = this.source.url;
      this.videoEl.load();
    });
  }

  private getBufferedRanges(): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    const buffered = this.videoEl.buffered;
    for (let i = 0; i < buffered.length; i++) {
      ranges.push({ start: buffered.start(i), end: buffered.end(i) });
    }
    return ranges;
  }

  private cleanupEventListeners(): void {
    if (this.loadedMetadataHandler) {
      this.videoEl.removeEventListener('loadedmetadata', this.loadedMetadataHandler);
      this.loadedMetadataHandler = null;
    }
    if (this.errorHandler) {
      this.videoEl.removeEventListener('error', this.errorHandler);
      this.errorHandler = null;
    }
    if (this.endedHandler) {
      this.videoEl.removeEventListener('ended', this.endedHandler);
      this.endedHandler = null;
    }
    if (this.progressHandler) {
      this.videoEl.removeEventListener('progress', this.progressHandler);
      this.progressHandler = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanupEventListeners();
    this.videoEl.src = '';
    this.videoEl.load();
    this.handlers.clear();
  }

  on(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  off(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: MediaEngineEvent, data: MediaEngineEventData): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const h of set) h(data);
  }
}

class MpegtsMediaEngine implements MediaEngine {
  readonly kind: EngineKind = 'mpegts';
  private player: ReturnType<typeof mpegts.createPlayer> | null = null;
  private videoEl: HTMLVideoElement;
  private source: PlaybackSource;
  private destroyed = false;
  private handlers = new Map<string, Set<(data: MediaEngineEventData) => void>>();

  constructor(videoEl: HTMLVideoElement, source: PlaybackSource) {
    this.videoEl = videoEl;
    this.source = source;
  }

  get levels(): Array<{ width: number; height: number; bitrate: number }> {
    return [];
  }

  get audioTracks(): Array<{ id: number; name: string; lang?: string }> {
    return [];
  }

  get subtitleTracks(): Array<{ id: number; name: string; lang?: string }> {
    return [];
  }

  get currentLevel(): number {
    return -1;
  }

  load(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('MediaEngine destroyed'));
    }
    if (typeof mpegts.isSupported === 'function' && !mpegts.isSupported()) {
      return Promise.reject(new Error('mpegts.js not supported'));
    }

    return new Promise((resolve, reject) => {
      const player = mpegts.createPlayer({
        type: 'mse',
        isLive: this.source.type === 'live',
        url: this.source.url,
      });
      this.player = player;

      const onMeta = () => {
        this.videoEl.removeEventListener('loadedmetadata', onMeta);
        this.emit('progress', { loaded: true });
        this.videoEl.muted = false;
        this.videoEl.volume = 1;
        void this.videoEl.play()?.catch(() => undefined);
        resolve();
      };

      player.on(mpegts.Events.ERROR, (errorType: string, errorDetail: string) => {
        this.videoEl.removeEventListener('loadedmetadata', onMeta);
        this.emit('fatal', { type: errorType, detail: errorDetail });
        reject(new Error(`mpegts error: ${errorType}`));
      });

      this.videoEl.addEventListener('loadedmetadata', onMeta);
      player.attachMediaElement(this.videoEl);
      player.load();
    });
  }

  destroy(): void {
    this.destroyed = true;
    if (this.player) {
      this.player.unload();
      this.player.detachMediaElement();
      this.player.destroy();
      this.player = null;
    }
    this.handlers.clear();
  }

  on(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  off(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: MediaEngineEvent, data: MediaEngineEventData): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const h of set) h(data);
  }
}

class FallbackMediaEngine implements MediaEngine {
  private active: MediaEngine | null = null;
  private videoEl: HTMLVideoElement;
  private source: PlaybackSource;
  private destroyed = false;
  private unsubs: Array<() => void> = [];
  private handlers = new Map<string, Set<(data: MediaEngineEventData) => void>>();

  constructor(videoEl: HTMLVideoElement, source: PlaybackSource) {
    this.videoEl = videoEl;
    this.source = source;
  }

  get kind(): EngineKind {
    return this.active?.kind ?? 'hls';
  }

  get levels(): Array<{ width: number; height: number; bitrate: number }> {
    return this.active?.levels ?? [];
  }

  get audioTracks(): Array<{ id: number; name: string; lang?: string }> {
    return this.active?.audioTracks ?? [];
  }

  get subtitleTracks(): Array<{ id: number; name: string; lang?: string }> {
    return this.active?.subtitleTracks ?? [];
  }

  get currentLevel(): number {
    return this.active?.currentLevel ?? -1;
  }

  async load(): Promise<void> {
    const candidates: MediaEngine[] = [
      new HlsMediaEngine(this.videoEl, this.source),
      new MpegtsMediaEngine(this.videoEl, this.source),
      new NativeMediaEngine(this.videoEl, this.source),
    ];

    let lastError: unknown;
    for (const engine of candidates) {
      if (this.destroyed) {
        engine.destroy();
        throw new Error('MediaEngine destroyed');
      }
      this.detachActive();
      this.active = engine;
      this.attachActive();
      try {
        await engine.load();
        return;
      } catch (error) {
        lastError = error;
        engine.destroy();
      }
    }

    throw lastError instanceof Error ? lastError : new Error('No playback engine could load the stream');
  }

  destroy(): void {
    this.destroyed = true;
    this.detachActive();
    this.active?.destroy();
    this.active = null;
    this.handlers.clear();
  }

  on(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  off(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  private attachActive(): void {
    if (!this.active) return;
    const events: MediaEngineEvent[] = ['progress', 'buffered', 'error', 'ended', 'fatal', 'recovering'];
    for (const event of events) {
      this.unsubs.push(
        this.active.on(event, (data) => {
          const set = this.handlers.get(event);
          if (!set) return;
          for (const handler of set) handler(data);
        }),
      );
    }
  }

  private detachActive(): void {
    for (const unsub of this.unsubs) unsub();
    this.unsubs = [];
  }
}