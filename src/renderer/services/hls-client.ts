import Hls from 'hls.js';

/**
 * HlsClient — Thin wrapper around hls.js providing a stable interface for the
 * MediaEngine and VideoPlayer components.
 *
 * Design §7.1: Wraps hls.js with load()/destroy(), on/off event handling,
 * and reactive getters for audioTracks, subtitleTracks, and quality levels.
 *
 * Resilience loop (player-core spec §hls.js Engine with Resilience):
 * - NetworkError: exponential backoff 1s/2s/4s, max 3 retries, then fatal
 * - MediaError: single recoverMediaError() attempt, then fatal if still failing
 * - Other fatal errors: immediate fatal emission
 */

export type HlsEvent =
  | 'MANIFEST_PARSED'
  | 'MEDIA_ATTACHED'
  | 'ERROR'
  | 'FRAG_LOADED'
  | 'LEVEL_SWITCHED'
  | 'AUDIO_TRACKS_UPDATED'
  | 'SUBTITLE_TRACKS_UPDATED'
  | 'retry'
  | 'mediaErrorRecovered'
  | 'fatal';

export type HlsEventData = Record<string, unknown>;

export interface HlsClientOptions {
  /** Stream URL (proxied or direct) */
  src: string;
  /** HTMLVideoElement to attach hls.js to */
  videoEl: HTMLVideoElement;
  /** Optional headers to inject via xhrSetup (degraded path without proxy) */
  headers?: Record<string, string>;
  /** When true, enable hls.js lowLatencyMode (live only) */
  live?: boolean;
}

export class HlsClient {
  private hls: Hls | null = null;
  private videoEl: HTMLVideoElement;
  private src: string;
  private headers?: Record<string, string>;
  private live: boolean;
  private destroyed = false;

  // Resilience state
  private attempt = 0;
  private nextDelay = 1000; // 1s initial backoff
  private readonly maxRetries = 3;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  // Event emitter
  private handlers = new Map<string, Set<(data: HlsEventData) => void>>();

  constructor(options: HlsClientOptions) {
    this.videoEl = options.videoEl;
    this.src = options.src;
    this.headers = options.headers;
    this.live = options.live === true;
    this.initializeHls();
  }

  private initializeHls(): void {
    if (this.destroyed) return;

    // Destroy any existing instance
    if (this.hls) {
      this.hls.destroy();
    }

    // Check if hls.js is supported
    if (!Hls.isSupported()) {
      this.emit('ERROR', { fatal: true, type: 'unsupported', details: { message: 'hls.js not supported' } });
      return;
    }

    this.hls = new Hls({
      lowLatencyMode: this.live,
      capLevelToPlayerSize: true,
      backBufferLength: 30,
      maxBufferLength: 60,
      maxMaxBufferLength: 600,
      // Header injection for degraded path (no proxy)
      xhrSetup: this.headers
        ? (xhr: XMLHttpRequest, _url: string) => {
            for (const [key, value] of Object.entries(this.headers!)) {
              xhr.setRequestHeader(key, value);
            }
          }
        : undefined,
    });

    this.attachEventListeners();
    this.hls.loadSource(this.src);
    this.hls.attachMedia(this.videoEl);
  }

private attachEventListeners(): void {
    if (!this.hls) return;

    this.hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      if (this.hls && this.hls.levels.length > 0) {
        this.hls.startLevel = Math.floor((this.hls.levels.length - 1) / 2);
      }
      this.emit('MANIFEST_PARSED', data as unknown as HlsEventData);
      this.attempt = 0;
      this.nextDelay = 1000;
    });

    this.hls.on(Hls.Events.MEDIA_ATTACHED, (_, data) => {
      this.emit('MEDIA_ATTACHED', data as unknown as HlsEventData);
    });

    this.hls.on(Hls.Events.ERROR, (_, data) => {
      this.handleError(data);
    });

    this.hls.on(Hls.Events.FRAG_LOADED, (_, data) => {
      this.emit('FRAG_LOADED', data as unknown as HlsEventData);
    });

    this.hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      this.emit('LEVEL_SWITCHED', data as unknown as HlsEventData);
    });

    this.hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
      this.emit('AUDIO_TRACKS_UPDATED', data as unknown as HlsEventData);
    });

    this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
      this.emit('SUBTITLE_TRACKS_UPDATED', data as unknown as HlsEventData);
    });
  }

  private handleError(data: HlsErrorData): void {
    const { fatal, type, details } = data;

    if (!fatal) {
      // Non-fatal errors are just forwarded
      this.emit('ERROR', data as unknown as HlsEventData);
      return;
    }

    // Fatal errors — apply resilience logic
    if (type === Hls.ErrorTypes.NETWORK_ERROR) {
      this.handleNetworkError(details);
    } else if (type === Hls.ErrorTypes.MEDIA_ERROR) {
      this.handleMediaError();
    } else {
      // Other fatal errors (muxError, etc.) — immediate fatal
      this.emit('fatal', { attempts: this.attempt });
      this.emit('ERROR', { fatal: true, type, details: { ...(details as Record<string, unknown>), attempts: this.attempt } });
    }
  }

  private handleNetworkError(details: unknown): void {
    if (this.attempt >= this.maxRetries) {
      // Exhausted retries
      this.emit('fatal', { attempts: this.attempt });
      this.emit('ERROR', { fatal: true, type: Hls.ErrorTypes.NETWORK_ERROR, details: { ...(details as Record<string, unknown>), attempts: this.attempt } });
      return;
    }

    const delay = this.nextDelay;
    this.attempt++;
    this.nextDelay *= 2; // Exponential backoff: 1s, 2s, 4s

    this.emit('retry', { attempt: this.attempt, delay, maxRetries: this.maxRetries });

    this.retryTimer = setTimeout(() => {
      if (!this.destroyed && this.hls) {
        this.hls.loadSource(this.src);
      }
    }, delay);
  }

  private handleMediaError(): void {
    if (!this.hls) return;

    // Single recoverMediaError attempt
    this.hls.recoverMediaError();

    // Emit recovery event for UI feedback
    this.emit('mediaErrorRecovered', {});
  }

  /**
   * Loads the stream and resolves when MANIFEST_PARSED fires.
   * Rejects if a fatal error occurs before manifest parse.
   */
  load(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.destroyed || !this.hls) {
        reject(new Error('HlsClient destroyed or not initialized'));
        return;
      }

      const onManifest = () => {
        this.off('MANIFEST_PARSED', onManifest);
        this.off('ERROR', onError);
        resolve();
      };

      const onError = (data: HlsEventData) => {
        if (data.fatal === true) {
          this.off('MANIFEST_PARSED', onManifest);
          this.off('ERROR', onError);
          reject(new Error(`HLS fatal error: ${data.type}`));
        }
      };

      this.on('MANIFEST_PARSED', onManifest);
      this.on('ERROR', onError);
    });
  }

  /** Destroys the hls.js instance and cleans up all resources. */
  destroy(): void {
    this.destroyed = true;

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }

    this.handlers.clear();
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, handler: (data: HlsEventData) => void): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  /** Unsubscribe from an event. */
  off(event: string, handler: (data: HlsEventData) => void): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: HlsEventData): void {
    const set = this.handlers.get(event);
    if (!set || set.size === 0) return;
    for (const h of set) h(data);
  }

  // Reactive getters mirroring hls.js properties

  /** Available quality levels (bitrate/resolution). */
  get levels(): Array<{ width: number; height: number; bitrate: number }> {
    return this.hls?.levels.map((l) => ({
      width: l.width,
      height: l.height,
      bitrate: l.bitrate,
    })) ?? [];
  }

  /** Available audio tracks. */
  get audioTracks(): Array<{ id: number; name: string; lang?: string }> {
    return this.hls?.audioTracks.map((t) => ({
      id: t.id,
      name: t.name || t.lang || `Track ${t.id}`,
      lang: t.lang,
    })) ?? [];
  }

  /** Available subtitle tracks. */
  get subtitleTracks(): Array<{ id: number; name: string; lang?: string }> {
    return this.hls?.subtitleTracks.map((t) => ({
      id: t.id,
      name: t.name || t.lang || `Subtitle ${t.id}`,
      lang: t.lang,
    })) ?? [];
  }

  /** Current playback level index. */
  get currentLevel(): number {
    return this.hls?.currentLevel ?? -1;
  }

  /** Set playback level by index. */
  set currentLevel(level: number) {
    if (this.hls) this.hls.currentLevel = level;
  }

  /** Next level to load (-1 = auto). */
  get nextLevel(): number {
    return this.hls?.nextLevel ?? -1;
  }

  /** Set next level to load. */
  set nextLevel(level: number) {
    if (this.hls) this.hls.nextLevel = level;
  }

  /** Whether the stream is live. */
  get isLive(): boolean {
    // hls.js adds a `live` property to the media element when attached
    const media = this.hls?.media as HTMLVideoElement & { live?: boolean } | null;
    return media?.live ?? false;
  }
}

// Type for hls.js error data
interface HlsErrorData {
  fatal: boolean;
  type: string;
  details: unknown;
}