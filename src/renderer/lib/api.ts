import type { IpcResult, IngestStartInput, IngestStartOutput, IngestCancelInput, IngestProgressInput, IngestProgress, CatalogListInput, CatalogListOutput, CatalogGetByIdInput, CatalogItem, CatalogType, CatalogGroupedInput, CatalogGroupedOutput, SeriesDetail, EnrichmentStatus,   TmdbKeyInput, TmdbKeyOutput, TmdbKeyPlainOutput, HasSource, SourceSummary, Episode } from '../../shared/types/ipc';
import type { MediaFormat } from '../../shared/types/player';
import type {
  PlayerGetSourceInputParsed,
  PlayerGetProxiedUrlInputParsed,
  PlayerReportErrorInputParsed,
  PlayerReportProgressInputParsed,
  PlayerGetNextEpisodeInputParsed,
  PlayerPlayInputParsed,
} from '../../shared/schemas/player';

export type PlayerSourceMeta = {
  type: CatalogType;
  id: number;
  mediaFormat: MediaFormat;
};

export type TypedLuxAPI = {
  ingest: {
    start: (input: IngestStartInput) => Promise<IpcResult<IngestStartOutput>>;
    refresh: () => Promise<IpcResult<IngestStartOutput>>;
    cancel: (input: IngestCancelInput) => Promise<IpcResult<void>>;
    getProgress: (input: IngestProgressInput) => Promise<IpcResult<IngestProgress>>;
    onProgress: (cb: (progress: IngestProgress) => void) => () => void;
  };
  catalog: {
    list: (input: CatalogListInput) => Promise<IpcResult<CatalogListOutput>>;
    getById: (input: CatalogGetByIdInput) => Promise<IpcResult<CatalogItem | SeriesDetail>>;
    groups: (input: { type: CatalogType }) => Promise<IpcResult<string[]>>;
    grouped: (input: CatalogGroupedInput) => Promise<IpcResult<CatalogGroupedOutput>>;
  };
  enrichment: {
    getStatus: () => Promise<IpcResult<EnrichmentStatus>>;
  };
  tmdb: {
    setKey: (input: TmdbKeyInput) => Promise<IpcResult<TmdbKeyOutput>>;
    hasKey: () => Promise<IpcResult<boolean>>;
    getKey: () => Promise<IpcResult<TmdbKeyPlainOutput>>;
    clearKey: () => Promise<IpcResult<void>>;
  };
  config: {
    saveCredentials: (input: CredentialsConfig) => Promise<IpcResult<{ ok: boolean }>>;
    hasSource: () => Promise<IpcResult<HasSource>>;
    sourceSummary: () => Promise<IpcResult<SourceSummary>>;
  };
  player: {
    getSource: (input: PlayerGetSourceInputParsed) => Promise<IpcResult<PlayerSourceMeta>>;
    getProxiedUrl: (input: PlayerGetProxiedUrlInputParsed) => Promise<IpcResult<{ url: string }>>;
    reportError: (input: PlayerReportErrorInputParsed) => Promise<IpcResult<void>>;
    reportProgress: (input: PlayerReportProgressInputParsed) => Promise<IpcResult<void>>;
    getNextEpisode: (input: PlayerGetNextEpisodeInputParsed) => Promise<IpcResult<Episode | null>>;
    play: (input: PlayerPlayInputParsed) => Promise<IpcResult<{ engine: 'libmpv' }>>;
    stop: () => Promise<IpcResult<{ stopped: true }>>;
    setPaused: (input: { paused: boolean }) => Promise<IpcResult<{ paused: boolean }>>;
    getTracks: () => Promise<IpcResult<{ audio: Array<{ id: number; name: string; lang?: string }>; subtitles: Array<{ id: number; name: string; lang?: string }> }>>;
    setAudioTrack: (input: { aid: number }) => Promise<IpcResult<true>>;
    setSubtitleTrack: (input: { sid: number }) => Promise<IpcResult<true>>;
    addSubtitle: (input: { path: string }) => Promise<IpcResult<{ id: number; name: string }>>;
    seek: (input: { time: number }) => Promise<IpcResult<true>>;
    getStatus: () => Promise<IpcResult<{ currentTime: number; duration: number; buffered: number }>>;
    setFullScreen: (input: { fullscreen: boolean }) => Promise<IpcResult<{ fullscreen: boolean }>>;
  };
};

export interface CredentialsConfig {
  source: 'xtream' | 'm3u';
  server?: string;
  username?: string;
  password?: string;
  listName?: string;
  url?: string;
}

/**
 * Creates a typed API wrapper over window.luxAPI.
 * Should be called in the renderer process only.
 */
export function createLuxAPI(): TypedLuxAPI {
  const w = globalThis as { window?: { luxAPI?: unknown } };
  const raw = w.window?.luxAPI as TypedLuxAPI | undefined;

  if (!raw) {
    throw new Error('window.luxAPI is not available. Are you in the renderer process?');
  }

  return raw;
}
