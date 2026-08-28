import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerIngestHandlers } from '../../src/main/ipc/handlers/ingest';
import type { IngestOrchestrator } from '../../src/main/services/ingest-orchestrator';
import type { ConfigService } from '../../src/main/services/config-service';

describe('ingest IPC handlers', () => {
  let mockOrchestrator: IngestOrchestrator;
  let mockConfigService: ConfigService;
  let handlers: Record<string, (event: unknown, input?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    mockOrchestrator = {
      start: vi.fn(),
      cancel: vi.fn(),
      getProgress: vi.fn(),
    } as unknown as IngestOrchestrator;

    mockConfigService = {
      loadCredentials: vi.fn().mockReturnValue(null),
    } as unknown as ConfigService;

    handlers = {};
    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: unknown) => {
        handlers[channel] = handler as (event: unknown, input?: unknown) => Promise<unknown>;
      }),
    };
    registerIngestHandlers(
      mockIpcMain as unknown as Electron.IpcMain,
      mockOrchestrator,
      mockConfigService,
    );
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

  describe('ingest:refresh', () => {
    it('returns NOT_FOUND "No saved source" and does not start ingest', async () => {
      const result = await handlers['ingest:refresh']({});
      expect(result).toEqual({
        error: { code: 'NOT_FOUND', message: 'No saved source' },
      });
      expect(mockOrchestrator.start).not.toHaveBeenCalled();
    });

    it('starts ingest from stored Xtream credentials with no renderer input', async () => {
      vi.mocked(mockConfigService.loadCredentials).mockReturnValue({
        source: 'xtream',
        server: 'http://vault.example:8080',
        username: 'vault-user',
        password: 'vault-pass',
        listName: 'Home IPTV',
      });
      vi.mocked(mockOrchestrator.start).mockReturnValue({ jobId: 'refresh-xtream' });

      const result = await handlers['ingest:refresh']({});

      expect(mockOrchestrator.start).toHaveBeenCalledWith({
        source: 'xtream',
        listName: 'Home IPTV',
        credentials: {
          server: 'http://vault.example:8080',
          username: 'vault-user',
          password: 'vault-pass',
        },
      });
      expect(result).toEqual({ data: { jobId: 'refresh-xtream' } });
    });

    it('starts ingest from stored M3U url with no renderer input', async () => {
      vi.mocked(mockConfigService.loadCredentials).mockReturnValue({
        source: 'm3u',
        url: 'https://vault.example/playlist.m3u',
        listName: 'M3U List',
      });
      vi.mocked(mockOrchestrator.start).mockReturnValue({ jobId: 'refresh-m3u' });

      const result = await handlers['ingest:refresh']({});

      expect(mockOrchestrator.start).toHaveBeenCalledWith({
        source: 'm3u',
        listName: 'M3U List',
        url: 'https://vault.example/playlist.m3u',
      });
      expect(result).toEqual({ data: { jobId: 'refresh-m3u' } });
    });
  });
});
