import { parentPort, workerData } from 'worker_threads';
import { setIngestAborted } from './ingest-worker/abort.js';
import { runIngestion } from './ingest-worker/pipeline.js';
import type { IngestWorkerData, WorkerMessage } from './ingest-worker/types.js';

export type { IngestCounts } from './ingest-worker/types.js';
export { processM3UEntries } from './ingest-worker/persist.js';
export { runIngestion } from './ingest-worker/pipeline.js';

// Worker entry point — runs when this file is loaded via new Worker(...)
if (parentPort) {
  const data = (workerData ?? {}) as IngestWorkerData;

  parentPort.on('message', (msg: WorkerMessage) => {
    if (msg.type === 'CANCEL') {
      setIngestAborted(true);
      parentPort!.postMessage({
        type: 'DONE',
        jobId: data.jobId ?? 'unknown',
        counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true },
        durationMs: 0,
      });
      return;
    }

    if (msg.type === 'START') {
      parentPort!.postMessage({ type: 'LOG', jobId: data.jobId ?? 'unknown', message: 'Worker received START' });
      runIngestion(data).catch((err) => {
        const message = err instanceof Error ? err.message : 'Unknown worker error';
        parentPort!.postMessage({ type: 'LOG', jobId: data.jobId ?? 'unknown', message: `Worker crashed: ${message}` });
        parentPort!.postMessage({
          type: 'ERROR',
          jobId: data.jobId ?? 'unknown',
          code: 'DB_ERROR',
          message,
          retryable: false,
        });
      });
    }
  });

  parentPort.postMessage({ type: 'LOG', jobId: data.jobId ?? 'unknown', message: 'Worker thread started' });
}
