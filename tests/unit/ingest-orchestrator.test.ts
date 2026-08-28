import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { IngestOrchestrator } from '../../src/main/services/ingest-orchestrator';

/**
 * The orchestrator spawns a real worker_threads Worker when `start()` runs.
 * To exercise the orchestrator's logic in unit tests we replace
 * worker_threads.Worker with a fake that captures event handlers without
 * actually loading a file. The fake matches the public API the orchestrator
 * uses (`on`, `postMessage`, `terminate`).
 */
class FakeWorker extends EventEmitter {
  postMessage = vi.fn();
  terminate = vi.fn();
}

// vi.hoisted runs BEFORE the vi.mock factory so the Worker mock implementation
// can close over the workers array even though the test factory itself is
// hoisted above all imports.
const workers = vi.hoisted(() => ({ current: [] as FakeWorker[] }));

vi.mock('worker_threads', async () => {
  const actual = await vi.importActual<typeof import('worker_threads')>('worker_threads');
  return {
    ...actual,
    Worker: vi.fn().mockImplementation(() => {
      const w = new FakeWorker();
      workers.current.push(w);
      return w;
    }),
  };
});

describe('ingest-orchestrator', () => {
  let orchestrator: IngestOrchestrator;
  let mockMainWindow: { webContents: { send: ReturnType<typeof vi.fn> } };
  let workerInstances: FakeWorker[];

  beforeEach(async () => {
    workerInstances = [];
    workers.current = workerInstances;
    mockMainWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    orchestrator = new IngestOrchestrator(mockMainWindow as unknown as Electron.BrowserWindow);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('start', () => {
    it('returns a jobId on start', () => {
      const result = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test List',
      });
      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe('string');
    });

    it('throws INGEST_IN_PROGRESS if a job is already running', () => {
      orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test List',
      });

      expect(() => {
        orchestrator.start({
          source: 'm3u',
          url: 'https://example.com/playlist2.m3u',
          listName: 'Test List 2',
        });
      }).toThrow(/INGEST_IN_PROGRESS/);
    });

    it('validates xtream source requires credentials', () => {
      expect(() => {
        orchestrator.start({
          source: 'xtream',
          listName: 'Test',
        });
      }).toThrow(/credentials/i);
    });

    it('validates m3u source requires url', () => {
      expect(() => {
        orchestrator.start({
          source: 'm3u',
          listName: 'Test',
        });
      }).toThrow(/url/i);
    });

    it('spawns the real ingest-worker file via worker_threads.Worker', async () => {
      const wt = await import('worker_threads');
      orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test List',
      });

      expect(wt.Worker).toHaveBeenCalledTimes(1);
      const call = vi.mocked(wt.Worker).mock.calls[0];
      expect(call?.[0]).toMatch(/ingest-worker\.(ts|js)$/);
    });

    it('passes jobId, source, url, and dbPath via workerData', async () => {
      const wt = await import('worker_threads');
      orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test List',
      });

      const workerData = vi.mocked(wt.Worker).mock.calls[0]?.[1]?.workerData as
        | { jobId: string; source: string; url: string; dbPath: string }
        | undefined;
      expect(workerData).toBeDefined();
      expect(workerData?.source).toBe('m3u');
      expect(workerData?.url).toBe('https://example.com/playlist.m3u');
      expect(workerData?.jobId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(workerData?.dbPath).toBeDefined();
    });

    it('posts a START message to the worker after spawn', () => {
      orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      const w = workerInstances[0];
      if (!w) throw new Error('expected a worker instance');
      expect(w.postMessage).toHaveBeenCalledWith({ type: 'START' });
    });

    it('forwards PROGRESS messages from the worker to the renderer', () => {
      const { jobId } = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      const w = workerInstances[0];
      if (!w) throw new Error('expected a worker instance');

      w.emit('message', {
        type: 'PROGRESS',
        jobId,
        phase: 'PERSIST',
        live: 5,
        movies: 3,
        series: 2,
        radio: 1,
        total: 11,
      });
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('ingest:progress', {
        jobId,
        phase: 'PERSIST',
        live: 5,
        movies: 3,
        series: 2,
        radio: 1,
        total: 11,
      });
    });

    it('forwards DONE messages and signals catalog:ingestion-complete', () => {
      const { jobId } = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      const w = workerInstances[0];
      if (!w) throw new Error('expected a worker instance');

      w.emit('message', {
        type: 'DONE',
        jobId,
        counts: { live: 5, movies: 3, series: 2, radio: 1, total: 11 },
        durationMs: 250,
      });

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('ingest:done', {
        jobId,
        counts: { live: 5, movies: 3, series: 2, radio: 1, total: 11 },
        durationMs: 250,
      });
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
        'catalog:ingestion-complete',
        { live: 5, movies: 3, series: 2, radio: 1, total: 11 },
      );
    });

    it('forwards ERROR messages from the worker', () => {
      const { jobId } = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      const w = workerInstances[0];
      if (!w) throw new Error('expected a worker instance');

      w.emit('message', {
        type: 'ERROR',
        jobId,
        code: 'CONNECTION_ERROR',
        message: 'Failed to fetch',
        retryable: true,
      });

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('ingest:error', {
        jobId,
        code: 'CONNECTION_ERROR',
        message: 'Failed to fetch',
        retryable: true,
      });
    });
  });

  describe('cancel', () => {
    it('sends cancel message to worker', () => {
      const { jobId } = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });

      const w = workerInstances[0];
      if (!w) throw new Error('expected a worker instance');

      // Should not throw
      orchestrator.cancel(jobId);
      expect(w.postMessage).toHaveBeenCalledWith({ type: 'CANCEL' });
    });

    it('throws if jobId does not match current job', () => {
      orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });

      expect(() => {
        orchestrator.cancel('wrong-job-id');
      }).toThrow(/not found/i);
    });
  });

  describe('getProgress', () => {
    it('returns current progress for active job', () => {
      const { jobId } = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });

      const progress = orchestrator.getProgress(jobId);
      expect(progress).toBeDefined();
      expect(progress?.jobId).toBe(jobId);
    });

    it('returns null for unknown jobId', () => {
      const progress = orchestrator.getProgress('unknown');
      expect(progress).toBeNull();
    });
  });
});
