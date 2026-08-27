import type { IpcMain } from 'electron';
import { IngestStartInputSchema, IngestCancelInputSchema, IngestProgressInputSchema } from '../../../shared/schemas/ingest.js';
import type { IpcResult } from '../../../shared/types/ipc.js';
import type { IngestOrchestrator } from '../../services/ingest-orchestrator.js';

function invalidInput(details: unknown): IpcResult<never> {
  return { error: { code: 'INVALID_INPUT', message: 'Invalid input', details } };
}

function notFound(message: string): IpcResult<never> {
  return { error: { code: 'NOT_FOUND', message } };
}

function ingestInProgress(message: string): IpcResult<never> {
  return { error: { code: 'INGEST_IN_PROGRESS', message } };
}

export function registerIngestHandlers(ipcMain: IpcMain, orchestrator: IngestOrchestrator): void {
  ipcMain.handle('ingest:start', async (_event, input: unknown) => {
    const result = IngestStartInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error);
    }

    try {
      const res = orchestrator.start(result.data);
      return { data: res };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.includes('INGEST_IN_PROGRESS')) {
        return ingestInProgress(message);
      }
      return { error: { code: 'INTERNAL', message } };
    }
  });

  ipcMain.handle('ingest:cancel', async (_event, input: unknown) => {
    const result = IngestCancelInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error);
    }

    try {
      orchestrator.cancel(result.data.jobId);
      return { data: undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return notFound(message);
    }
  });

  ipcMain.handle('ingest:getProgress', async (_event, input: unknown) => {
    const result = IngestProgressInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error);
    }

    const progress = orchestrator.getProgress(result.data.jobId);
    if (!progress) {
      return notFound(`Job ${result.data.jobId} not found`);
    }

    // Calculate percent
    const total = progress.total || 1;
    const processed = progress.live + progress.movies + progress.series + progress.radio;
    const percent = Math.min(100, Math.round((processed / total) * 100));

    return {
      data: {
        jobId: progress.jobId,
        phase: progress.phase,
        percent,
        counts: {
          live: progress.live,
          movies: progress.movies,
          series: progress.series,
          radio: progress.radio,
          total: progress.total,
        },
      },
    };
  });
}
