import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerIngestHandlers } from '../../src/main/ipc/handlers/ingest';
import type { IngestOrchestrator } from '../../src/main/services/ingest-orchestrator';

describe('ingest IPC handlers', () => {
  let mockOrchestrator: IngestOrchestrator;
  let handlers: Record<string, (event: unknown, input?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    mockOrchestrator = {
      start: vi.fn(),
      cancel: vi.fn(),
      getProgress: vi.fn(),
    } as unknown as IngestOrchestrator;

    handlers = {};
    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: unknown) => {
        handlers[channel] = handler as (event: unknown, input?: unknown) => Promise<unknown>;
      }),
    };
    registerIngestHandlers(mockIpcMain as unknown as Electron.IpcMain, mockOrchestrator);
  });

  describe('ingest:start', () => {
    it('returns INVALID_INPUT for missing source', async () => {
      const result = await handlers['ingest:start']({}, {});
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('returns INVALID_INPUT for xtream without credentials', async () => {
      const result = await handlers['ingest:start']({}, { source: 'xtream', listName: 'Test' });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('calls orchestrator.start with valid m3u input', async () => {
      vi.mocked(mockOrchestrator.start).mockReturnValue({ jobId: 'test-job-123' });
      const result = await handlers['ingest:start']({}, {
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      expect(mockOrchestrator.start).toHaveBeenCalledWith({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      expect(result).toEqual({ data: { jobId: 'test-job-123' } });
    });

    it('returns INGEST_IN_PROGRESS error when orchestrator throws', async () => {
      vi.mocked(mockOrchestrator.start).mockImplementation(() => {
        throw new Error('INGEST_IN_PROGRESS: Another ingestion is already running');
      });
      const result = await handlers['ingest:start']({}, {
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INGEST_IN_PROGRESS' }),
        }),
      );
    });
  });

  describe('ingest:cancel', () => {
    it('returns INVALID_INPUT for missing jobId', async () => {
      const result = await handlers['ingest:cancel']({}, {});
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('calls orchestrator.cancel with valid jobId', async () => {
      const result = await handlers['ingest:cancel']({}, { jobId: 'test-job-123' });
      expect(mockOrchestrator.cancel).toHaveBeenCalledWith('test-job-123');
      expect(result).toEqual({ data: undefined });
    });
  });

  describe('ingest:getProgress', () => {
    it('returns INVALID_INPUT for missing jobId', async () => {
      const result = await handlers['ingest:getProgress']({}, {});
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('returns progress from orchestrator', async () => {
      vi.mocked(mockOrchestrator.getProgress).mockReturnValue({
        jobId: 'test-job-123',
        phase: 'CLASSIFY',
        live: 10,
        movies: 5,
        series: 3,
        radio: 1,
        total: 19,
      });
      const result = await handlers['ingest:getProgress']({}, { jobId: 'test-job-123' });
      expect(result).toEqual({
        data: {
          jobId: 'test-job-123',
          phase: 'CLASSIFY',
          percent: expect.any(Number),
          counts: { live: 10, movies: 5, series: 3, radio: 1, total: 19 },
        },
      });
    });

    it('returns NOT_FOUND for unknown jobId', async () => {
      vi.mocked(mockOrchestrator.getProgress).mockReturnValue(null);
      const result = await handlers['ingest:getProgress']({}, { jobId: 'unknown' });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        }),
      );
    });
  });
});
