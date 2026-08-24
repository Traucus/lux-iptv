import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import type { BrowserWindow } from 'electron';
import * as path from 'path';
import type { IngestStartInput } from '../../shared/types/ipc';
import type { IngestWorkerMessage } from '../../shared/types/ingest';

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

export class IngestOrchestrator {
  private currentJob: JobState | null = null;
  private readonly mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
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
    const workerPath = path.resolve(__dirname, '../workers/ingest-worker.js');

    // In test/dev mode, the worker file might not be compiled yet
    // We'll use a mock worker for now
    const worker = this.createWorker(jobId, input);

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

  private createWorker(jobId: string, input: IngestStartInput): Worker {
    // For now, create a mock worker that simulates the ingestion
    // In production, this would load the actual worker file
    const worker = new Worker(
      `
      const { parentPort } = require('worker_threads');
      parentPort.on('message', (msg) => {
        if (msg.type === 'CANCEL') {
          parentPort.postMessage({ type: 'DONE', jobId: '${jobId}', counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0, aborted: true }, durationMs: 0 });
        }
        if (msg.type === 'START') {
          // Simulate some work
          setTimeout(() => {
            parentPort.postMessage({ type: 'DONE', jobId: '${jobId}', counts: { live: 0, movies: 0, series: 0, radio: 0, total: 0 }, durationMs: 100 });
          }, 10);
        }
      });
      `,
      { eval: true, workerData: { jobId, input } },
    );

    // Send START message
    worker.postMessage({ type: 'START', payload: { source: input.source, entries: [] } });

    return worker;
  }
}
