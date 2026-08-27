import { HlsClient } from './hls-client';

/**
 * MediaEngine — Unified playback engine that selects between hls.js and native
 * <video> based on media format.
 *
 * Design §7.2: Engine selection:
 * - hls.js for HLS, DASH, TS, unknown
 * - native <video> for MP4
 *
 * Resilience loop (player-core spec §hls.js Engine with Resilience):
 * - NetworkError: exponential backoff 1s/2s/4s, max 3 retries, then fatal
 * - MediaError: single recoverMediaError() attempt, then fatal if still failing
 * - Other fatal errors: immediate fatal emission
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

export type EngineKind = 'hls' | 'native';

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
}

/**
 * Creates a MediaEngine instance for the given source.
 * The engine kind is determined by mediaFormat.
 */
export function createMediaEngine(
  videoEl: HTMLVideoElement,
  source: PlaybackSource
): MediaEngine {
  const { mediaFormat } = source;
  const kind: EngineKind = mediaFormat === 'mp4' ? 'native' : 'hls';

  if (kind === 'hls') {
    return new HlsMediaEngine(videoEl, source);
  } else {
    return new NativeMediaEngine(videoEl, source);
  }
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

  // Resilience state
  private attempt = 0;
  private nextDelay = 1000;
  private readonly maxRetries = 3;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // Event emitter
  private handlers = new Map<string, Set<(data: MediaEngineEventData) => void>>();

  constructor(videoEl: HTMLVideoElement, source: PlaybackSource) {
    this.videoEl = videoEl;
    this.source = source;
  }

  load(): Promise<void> {
    if (this.destroyed) {
      return Promise.reject(new Error('MediaEngine destroyed'));
    }

    this.hlsClient = new HlsClient({
      src: this.source.url,
      videoEl: this.videoEl,
      headers: this.source.httpHeaders,
    });

    this.attachHlsClientListeners();

    return this.hlsClient.load();
  }

  private attachHlsClientListeners(): void {
    if (!this.hlsClient) return;

    this.hlsClient.on('MANIFEST_PARSED', () => {
      // Reset resilience state on successful manifest parse
      this.attempt = 0;
      this.nextDelay = 1000;
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
        const error = this.videoEl.error;
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