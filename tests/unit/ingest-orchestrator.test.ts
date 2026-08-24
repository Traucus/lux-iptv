import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestOrchestrator } from '../../src/main/services/ingest-orchestrator';

describe('ingest-orchestrator', () => {
  let orchestrator: IngestOrchestrator;
  let mockMainWindow: { webContents: { send: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockMainWindow = {
      webContents: {
        send: vi.fn(),
      },
    };
    orchestrator = new IngestOrchestrator(mockMainWindow as unknown as Electron.BrowserWindow);
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
  });

  describe('cancel', () => {
    it('sends cancel message to worker', () => {
      const { jobId } = orchestrator.start({
        source: 'm3u',
        url: 'https://example.com/playlist.m3u',
        listName: 'Test',
      });

      // Should not throw
      orchestrator.cancel(jobId);
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
