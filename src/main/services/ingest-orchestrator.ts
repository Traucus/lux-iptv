import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import type { BrowserWindow } from 'electron';
import type { IngestStartInput } from '../../shared/types/ipc.js';
import type { IngestWorkerMessage } from '../../shared/types/ingest.js';
import type { SqlJsCompatDb } from '../db/sqljs-adapter.js';

interface JobState {
  jobId: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  startedAt: number;
  progress: {
    phase: string;
    live: number;
    movies: number;
    series: number;
    radio: number;
    total: number;
  };
  worker: Worker;
}

interface WorkerInput {
  jobId: string;
  source: 'xtream' | 'm3u';
  url?: string;
  credentials?: { server: string; username: string; password: string };
  dbPath: string;
}

/**
 * Resolves the path to the compiled ingest-worker file.
 * - Production: dist/main/workers/ingest-worker.js (this file at
 *   dist/main/services/ingest-orchestrator.js → ../workers/ingest-worker.js)
 * - Tests: tests run against the source tree (src/main/workers/ingest-worker.ts).
 *   Vitest can load .ts files, so the .ts path is also valid there.
 *
 * Tests can override the path via the static `setWorkerPath` method.
 */
function resolveDefaultWorkerPath(): string {
  // When running tests, vitest uses ts-node-style loading and we can point at
  // the source .ts file directly. When running in production the compiled
  // .js file is at ../workers/ingest-worker.js relative to this module.
  if (__dirname.includes('dist') || __dirname.includes('node_modules')) {
    return join(__dirname, '..', 'workers', 'ingest-worker.js');
  }
  return join(__dirname, '..', 'workers', 'ingest-worker.ts');
}

export class IngestOrchestrator {
  private static workerPath: string = resolveDefaultWorkerPath();
  private static dbPath: string | undefined = undefined;

  /**
   * Override the path used to spawn the ingest worker. Intended for tests;
   * production code uses the resolved default.
   */
  static setWorkerPath(path: string): void {
    IngestOrchestrator.workerPath = path;
  }

  /**
   * Override the SQLite DB path passed to the worker. When unset, the worker
   * is spawned without a dbPath and `runIngestion` reports DB_ERROR. Tests
   * can leave this unset since the unit tests don't exercise the worker.
   */
  static setDbPath(dbPath: string | undefined): void {
    IngestOrchestrator.dbPath = dbPath;
  }

  private currentJob: JobState | null = null;
  private readonly mainWindow: BrowserWindow;
  private db: SqlJsCompatDb | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  /**
   * Set the main process DB handle so the orchestrator can reload it
   * after the ingest worker completes. The worker writes to disk in a
   * separate thread; the main process's in-memory sql.js snapshot must
   * be refreshed to see the new data.
   */
  setDb(db: SqlJsCompatDb): void {
    this.db = db;
  }

  start(input: IngestStartInput): { jobId: string } {
    if (this.currentJob && this.currentJob.status === 'running') {
      throw new Error('INGEST_IN_PROGRESS: Another ingestion is already running');
    }

    // Validate source-specific requirements
    if (input.source === 'xtream' && !input.credentials) {
      throw new Error('INVALID_INPUT: Xtream source requires credentials');
    }
    if (input.source === 'm3u' && !input.url) {
      throw new Error('INVALID_INPUT: M3U source requires url');
    }

    const jobId = randomUUID();

    // Spawn the real ingest worker thread. The worker reads its configuration
    // (source, url, credentials, dbPath) from workerData and reports progress
    // / done / error via parentPort messages.
    const workerInput: WorkerInput = {
      jobId,
      source: input.source,
      url: input.url,
      credentials: input.credentials,
      dbPath: IngestOrchestrator.dbPath ?? '',
    };

    let worker: Worker;
    try {
      worker = new Worker(IngestOrchestrator.workerPath, { workerData: workerInput });
    } catch (err) {
      // If the worker file is missing or unspawnable (e.g. in unit tests
      // where the path points to a non-existent file), surface a friendly
      // error to the renderer instead of crashing the orchestrator.
      const message = err instanceof Error ? err.message : 'Failed to spawn ingest worker';
      this.mainWindow.webContents.send('ingest:error', {
        jobId,
        code: 'INTERNAL',
        message,
        retryable: false,
      });
      throw err;
    }

    this.currentJob = {
      jobId,
      status: 'running',
      startedAt: Date.now(),
      progress: { phase: 'INIT', live: 0, movies: 0, series: 0, radio: 0, total: 0 },
      worker,
    };

    worker.on('message', (msg: IngestWorkerMessage) => {
      if (!this.currentJob) return;

      switch (msg.type) {
        case 'LOG':
          console.log(`[ingest:${msg.jobId}] ${msg.message}`);
          break;
        case 'PROGRESS':
          this.currentJob.progress = {
            phase: msg.phase,
            live: msg.live,
            movies: msg.movies,
            series: msg.series,
            radio: msg.radio,
            total: msg.total,
          };
          this.mainWindow.webContents.send('ingest:progress', {
            jobId: msg.jobId,
            ...this.currentJob.progress,
          });
          break;
        case 'DONE':
          this.currentJob.status = msg.counts.aborted ? 'cancelled' : 'done';
          // Update progress phase so getProgress() returns phase='DONE'.
          // Without this, the renderer polls but never sees DONE and the
          // auto-transition to dashboard stalls at ~99%.
          this.currentJob.progress = {
            ...this.currentJob.progress,
            phase: 'DONE',
            live: msg.counts.live,
            movies: msg.counts.movies,
            series: msg.counts.series,
            radio: msg.counts.radio,
            total: msg.counts.total,
          };
          // Reload BEFORE notifying the renderer. sql.js is a snapshot;
          // if DONE is sent first, Series/Home queries hit the stale DB
          // (live/movies from the previous ingest, series still empty).
          this.db?.reload();
          this.mainWindow.webContents.send('ingest:progress', {
            jobId: msg.jobId,
            ...this.currentJob.progress,
          });
          this.mainWindow.webContents.send('ingest:done', {
            jobId: msg.jobId,
            counts: msg.counts,
            durationMs: msg.durationMs,
          });
          this.mainWindow.webContents.send('catalog:ingestion-complete', msg.counts);
          worker.terminate();
          break;
        case 'ERROR':
          this.currentJob.status = 'error';
          this.currentJob.progress = {
            ...this.currentJob.progress,
            phase: 'ERROR',
          };
          this.mainWindow.webContents.send('ingest:progress', {
            jobId: msg.jobId,
            ...this.currentJob.progress,
          });
          this.mainWindow.webContents.send('ingest:error', {
            jobId: msg.jobId,
            code: msg.code,
            message: msg.message,
            retryable: msg.retryable,
          });
          worker.terminate();
          break;
      }
    });

    worker.on('error', (err) => {
      if (this.currentJob) {
        this.currentJob.status = 'error';
        this.mainWindow.webContents.send('ingest:error', {
          jobId: this.currentJob.jobId,
          code: 'DB_ERROR',
          message: err.message,
          retryable: false,
        });
      }
    });

    // Kick off the worker. The worker auto-starts on START and reports
    // progress / done / error through the message handler above.
    worker.postMessage({ type: 'START' });

    return { jobId };
  }

  cancel(jobId: string): void {
    if (!this.currentJob || this.currentJob.jobId !== jobId) {
      throw new Error(`Job ${jobId} not found`);
    }
    this.currentJob.worker.postMessage({ type: 'CANCEL' });
  }

  getProgress(jobId: string): { jobId: string; phase: string; live: number; movies: number; series: number; radio: number; total: number } | null {
    if (!this.currentJob || this.currentJob.jobId !== jobId) {
      return null;
    }
    return {
      jobId: this.currentJob.jobId,
      ...this.currentJob.progress,
    };
  }
}
