import { parentPort, workerData } from 'worker_threads';
import type { IngestCounts } from './types.js';

export function emitError(
  code: 'AUTH_FAILED' | 'CONNECTION_ERROR' | 'PARSE_ERROR' | 'DB_ERROR',
  message: string,
  retryable: boolean,
): void {
  parentPort?.postMessage({
    type: 'ERROR',
    jobId: workerData?.jobId ?? 'unknown',
    code,
    message,
    retryable,
  });
}

export function emitLog(message: string): void {
  parentPort?.postMessage({
    type: 'LOG',
    jobId: workerData?.jobId ?? 'unknown',
    message,
  });
}

export function emitProgress(phase: string, counts: IngestCounts): void {
  parentPort?.postMessage({
    type: 'PROGRESS',
    jobId: workerData?.jobId ?? 'unknown',
    phase,
    live: counts.live,
    movies: counts.movies,
    series: counts.series,
    radio: counts.radio,
    total: counts.total,
  });
}

export function emitDone(counts: IngestCounts, durationMs: number): void {
  parentPort?.postMessage({
    type: 'DONE',
    jobId: workerData?.jobId ?? 'unknown',
    counts,
    durationMs,
  });
}
