import { HlsMediaEngine } from './hls-engine';
import { MpegtsMediaEngine } from './mpegts-engine';
import { NativeMediaEngine } from './native-engine';
import {
  isHlsNetworkFailure,
  probeOrder,
  type EngineKind,
  type MediaEngine,
  type MediaEngineEvent,
  type MediaEngineEventData,
  type PlaybackSource,
} from './types';

export class FallbackMediaEngine implements MediaEngine {
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
    const candidates = this.buildCandidates();

    let lastError: unknown;
    for (const engine of candidates) {
      if (this.destroyed) {
        engine.destroy();
        throw new Error('MediaEngine destroyed');
      }
      this.detachActive();
      this.active = engine;
      this.attachActive({ forwardFatal: false });
      try {
        await engine.load();
        this.detachActive();
        this.attachActive({ forwardFatal: true });
        return;
      } catch (error) {
        lastError = error;
        engine.destroy();
        this.active = null;
        if (
          this.source.type === 'live' &&
          engine.kind === 'hls' &&
          isHlsNetworkFailure(error)
        ) {
          this.emit('fatal', { attempts: 3, reason: 'hls-network' });
          throw error;
        }
      }
    }

    this.emit('fatal', { attempts: candidates.length, reason: 'all-engines-failed' });
    throw lastError instanceof Error ? lastError : new Error('No playback engine could load the stream');
  }

  destroy(): void {
    this.destroyed = true;
    this.detachActive();
    this.active?.destroy();
    this.active = null;
    this.handlers.clear();
  }

  private buildCandidates(): MediaEngine[] {
    const make: Record<EngineKind, () => MediaEngine> = {
      hls: () => new HlsMediaEngine(this.videoEl, this.source),
      mpegts: () => new MpegtsMediaEngine(this.videoEl, this.source),
      native: () => new NativeMediaEngine(this.videoEl, this.source),
    };
    return probeOrder(this.source.type, this.source.mediaFormat).map((kind) => make[kind]());
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

  private attachActive(opts: { forwardFatal: boolean }): void {
    if (!this.active) return;
    const events: MediaEngineEvent[] = opts.forwardFatal
      ? ['progress', 'buffered', 'error', 'ended', 'fatal', 'recovering']
      : ['progress', 'buffered', 'error', 'ended', 'recovering'];
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
