import mpegts from 'mpegts.js';
import type {
  EngineKind,
  MediaEngine,
  MediaEngineEvent,
  MediaEngineEventData,
  PlaybackSource,
} from './types';

export class MpegtsMediaEngine implements MediaEngine {
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
