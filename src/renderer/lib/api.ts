import type { IpcResult, IngestStartInput, IngestCancelInput, IngestProgressInput, IngestProgress, CatalogListInput, CatalogListOutput, CatalogGetByIdInput, CatalogItem, CatalogType, SeriesDetail, EnrichmentStatus, TmdbKeyInput, TmdbKeyOutput } from '../../shared/types/ipc';

export type TypedLuxAPI = {
  ingest: {
    start: (input: IngestStartInput) => Promise<IpcResult<IngestStartOutput>>;
    cancel: (input: IngestCancelInput) => Promise<IpcResult<void>>;
    getProgress: (input: IngestProgressInput) => Promise<IpcResult<IngestProgress>>;
    onProgress: (cb: (progress: IngestProgress) => void) => () => void;
  };
  catalog: {
    list: (input: CatalogListInput) => Promise<IpcResult<CatalogListOutput>>;
    getById: (input: CatalogGetByIdInput) => Promise<IpcResult<CatalogItem | SeriesDetail>>;
    groups: (input: { type: CatalogType }) => Promise<IpcResult<string[]>>;
  };
  enrichment: {
    getStatus: () => Promise<IpcResult<EnrichmentStatus>>;
  };
  tmdb: {
    setKey: (input: TmdbKeyInput) => Promise<IpcResult<TmdbKeyOutput>>;
    hasKey: () => Promise<IpcResult<boolean>>;
    clearKey: () => Promise<IpcResult<void>>;
  };
};

type IngestStartOutput = { jobId: string };

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
