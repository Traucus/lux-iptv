import type { IpcResult, IngestStartInput, IngestStartOutput, IngestCancelInput, IngestProgressInput, IngestProgress, CatalogListInput, CatalogListOutput, CatalogGetByIdInput, CatalogItem, CatalogType, CatalogGroupedInput, CatalogGroupedOutput, SeriesDetail, EnrichmentStatus, TmdbKeyInput, TmdbKeyOutput, HasSource, SourceSummary } from '../../shared/types/ipc';

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
    clearKey: () => Promise<IpcResult<void>>;
  };
  config: {
    saveCredentials: (input: CredentialsConfig) => Promise<IpcResult<{ ok: boolean }>>;
    loadCredentials: () => Promise<IpcResult<CredentialsConfig | null>>;
    hasSource: () => Promise<IpcResult<HasSource>>;
    sourceSummary: () => Promise<IpcResult<SourceSummary>>;
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
