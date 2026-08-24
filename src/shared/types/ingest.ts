// ─── Ingest Types ─────────────────────────────────────────────────────────────

export type IngestSource = 'xtream' | 'm3u';

export interface IngestJob {
  jobId: string;
  source: IngestSource;
  listName: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  startedAt: number;
}

export interface IngestProgressMessage {
  type: 'PROGRESS';
  jobId: string;
  phase: string;
  live: number;
  movies: number;
  series: number;
  radio: number;
  total: number;
}

export interface IngestDoneMessage {
  type: 'DONE';
  jobId: string;
  counts: {
    live: number;
    movies: number;
    series: number;
    radio: number;
    total: number;
    aborted?: boolean;
  };
  durationMs: number;
}

export interface IngestErrorMessage {
  type: 'ERROR';
  jobId: string;
  code: 'AUTH_FAILED' | 'CONNECTION_ERROR' | 'PARSE_ERROR' | 'DB_ERROR';
  message: string;
  retryable: boolean;
}

export type IngestWorkerMessage = IngestProgressMessage | IngestDoneMessage | IngestErrorMessage;
