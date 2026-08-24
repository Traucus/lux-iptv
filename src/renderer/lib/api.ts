import type { LuxAPI, IpcResult, IngestStartInput, IngestCancelInput, IngestProgressInput, IngestProgress, CatalogListInput, CatalogListOutput, CatalogGetByIdInput, CatalogItem, SeriesDetail, EnrichmentStatus, TmdbKeyInput, TmdbKeyOutput } from '../../shared/types/ipc';

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
  const raw = w.window?.luxAPI as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

  if (!raw) {
    throw new Error('window.luxAPI is not available. Are you in the renderer process?');
  }

  return {
    ingest: {
      start: raw.ingest.start as TypedLuxAPI['ingest']['start'],
      cancel: raw.ingest.cancel as TypedLuxAPI['ingest']['cancel'],
      getProgress: raw.ingest.getProgress as TypedLuxAPI['ingest']['getProgress'],
      onProgress: raw.ingest.onProgress as TypedLuxAPI['ingest']['onProgress'],
    },
    catalog: {
      list: raw.catalog.list as TypedLuxAPI['catalog']['list'],
      getById: raw.catalog.getById as TypedLuxAPI['catalog']['getById'],
    },
    enrichment: {
      getStatus: raw.enrichment.getStatus as TypedLuxAPI['enrichment']['getStatus'],
    },
    tmdb: {
      setKey: raw.tmdb.setKey as TypedLuxAPI['tmdb']['setKey'],
      hasKey: raw.tmdb.hasKey as TypedLuxAPI['tmdb']['hasKey'],
      clearKey: raw.tmdb.clearKey as TypedLuxAPI['tmdb']['clearKey'],
    },
  };
}
