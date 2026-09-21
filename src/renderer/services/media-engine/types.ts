export type MediaFormat = 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';

export interface PlaybackSource {
  url: string;
  mediaFormat: MediaFormat;
  httpHeaders?: Record<string, string>;
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
  readonly kind: EngineKind;
  load(): Promise<void>;
  destroy(): void;
  on(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): () => void;
  off(event: MediaEngineEvent, handler: (data: MediaEngineEventData) => void): void;
  readonly levels: Array<{ width: number; height: number; bitrate: number }>;
  readonly audioTracks: Array<{ id: number; name: string; lang?: string }>;
  readonly subtitleTracks: Array<{ id: number; name: string; lang?: string }>;
  readonly currentLevel: number;
}

export function isHlsNetworkFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /HLS fatal error: networkError/i.test(message);
}

export function probeOrder(
  type: PlaybackSource['type'],
  mediaFormat: MediaFormat,
): EngineKind[] {
  if (type === 'live') return ['hls', 'mpegts', 'native'];
  if (mediaFormat === 'mp4') return ['native', 'hls'];
  if (mediaFormat === 'hls' || mediaFormat === 'dash') return ['hls', 'native'];
  if (mediaFormat === 'ts') return ['mpegts', 'hls', 'native'];
  return ['hls', 'native', 'mpegts'];
}
