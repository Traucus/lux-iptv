export interface IngestCounts {
  live: number;
  movies: number;
  series: number;
  radio: number;
  total: number;
  aborted?: boolean;
}

export interface IngestWorkerData {
  jobId: string;
  source: 'm3u' | 'xtream';
  url?: string;
  credentials?: { server: string; username: string; password: string };
  dbPath: string;
}

export type WorkerMessage =
  | { type: 'START' }
  | { type: 'CANCEL' };
