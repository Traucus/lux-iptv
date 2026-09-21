import type {
  EngineKind,
  MediaEngine,
  MediaEngineEvent,
  MediaEngineEventData,
  PlaybackSource,
} from './types';

export class NativeMediaEngine implements MediaEngine {
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
