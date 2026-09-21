import { HlsClient } from '../hls-client';
import type {
  EngineKind,
  MediaEngine,
  MediaEngineEvent,
  MediaEngineEventData,
  PlaybackSource,
} from './types';

export class HlsMediaEngine implements MediaEngine {
  readonly kind: EngineKind = 'hls';
  private hlsClient: HlsClient | null = null;
  private videoEl: HTMLVideoElement;
  private source: PlaybackSource;
  private destroyed = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
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
