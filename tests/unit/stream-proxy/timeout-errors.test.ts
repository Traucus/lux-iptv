import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { StreamProxyService } from '../../../src/main/services/stream-proxy';
import type { SqlJsCompatDb } from '../../../src/main/db/sqljs-adapter.js';
import {
  initProxySql,
  openSeededProxyDb,
  createProxyService,
  mockOriginResponse,
} from './harness';

const { mockRequestFn, mockEmitFn } = vi.hoisted(() => ({
  mockRequestFn: vi.fn(),
  mockEmitFn: vi.fn(),
}));

vi.mock('electron', () => ({
  net: { request: mockRequestFn },
  protocol: { handle: vi.fn() },
  ipcMain: { on: vi.fn(), emit: mockEmitFn, handle: vi.fn() },
}));

describe('StreamProxyService timeout and error IPC', () => {
  let db: SqlJsCompatDb;
  let service: StreamProxyService;

  beforeAll(async () => {
    await initProxySql();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    db = openSeededProxyDb();
    service = createProxyService(mockRequestFn);
    await service.start(db);
  });

  afterEach(async () => {
    await service.stop();
    db.close();
  });

  describe('timeout handling', () => {
    it('returns 502 on 5xx response', async () => {
      mockOriginResponse(mockRequestFn, { statusCode: 504, contentType: 'text/plain', body: 'timeout' });
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1`);
      expect(response.status).toBe(502);
    });

    it('sets 10s timeout on outbound request', async () => {
      const request = mockOriginResponse(mockRequestFn, { contentType: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n' });
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1`);
      expect(response.status).toBe(200);
      expect(request.setTimeout).not.toHaveBeenCalled();
    });
  });

  describe('error IPC emission', () => {
    beforeEach(() => {
      service.setIpcMain({ emit: mockEmitFn } as unknown as import('electron').IpcMain);
      mockEmitFn.mockClear();
    });

    it('emits player:reportError IPC on 5xx response', async () => {
      mockOriginResponse(mockRequestFn, { statusCode: 504, contentType: 'text/plain', body: 'timeout' });
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1`);
      expect(response.status).toBe(502);
      expect(mockEmitFn).toHaveBeenCalledWith(
        'player:reportError',
        expect.objectContaining({
          code: 'STREAM_TIMEOUT',
          message: expect.stringContaining('Upstream returned 504'),
        }),
      );
    });

    it('emits player:reportError IPC on network error', async () => {
      mockOriginResponse(mockRequestFn, { errorBeforeResponse: new Error('ENOTFOUND') });
      const response = await fetch(`http://127.0.0.1:${service.getPort()}/proxy/live/1`);
      expect(response.status).toBe(503);
      expect(mockEmitFn).toHaveBeenCalledWith(
        'player:reportError',
        expect.objectContaining({
          code: 'NETWORK',
          message: expect.stringContaining('ENOTFOUND'),
        }),
      );
    });
  });
});
