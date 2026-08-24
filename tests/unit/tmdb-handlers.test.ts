import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTmdbHandlers } from '../../src/main/ipc/handlers/tmdb';
import type { TmdbKeyVault } from '../../src/main/services/tmdb-key';

describe('tmdb IPC handlers', () => {
  let mockVault: TmdbKeyVault;
  let handlers: Record<string, (event: unknown, input?: unknown) => Promise<unknown>>;

  beforeEach(() => {
    mockVault = {
      setTmdbKey: vi.fn(),
      hasTmdbKey: vi.fn(),
      getTmdbKeyPlain: vi.fn(),
      clearTmdbKey: vi.fn(),
    };
    handlers = {};
    // Capture registered handlers
    const mockIpcMain = {
      handle: vi.fn((channel: string, handler: unknown) => {
        handlers[channel] = handler as (event: unknown, input?: unknown) => Promise<unknown>;
      }),
    };
    registerTmdbHandlers(mockIpcMain as unknown as Electron.IpcMain, mockVault);
  });

  describe('tmdb:setKey', () => {
    it('returns INVALID_INPUT for missing key', async () => {
      const result = await handlers['tmdb:setKey']({}, {});
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('returns INVALID_INPUT for empty key', async () => {
      const result = await handlers['tmdb:setKey']({}, { key: '' });
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INVALID_INPUT' }),
        }),
      );
    });

    it('calls vault.setTmdbKey with valid input', async () => {
      vi.mocked(mockVault.setTmdbKey).mockResolvedValue({ valid: true });
      const result = await handlers['tmdb:setKey']({}, { key: 'abcdef1234567890' });
      expect(mockVault.setTmdbKey).toHaveBeenCalledWith('abcdef1234567890');
      expect(result).toEqual({ data: { valid: true } });
    });

    it('returns { valid: false } for invalid key', async () => {
      vi.mocked(mockVault.setTmdbKey).mockResolvedValue({ valid: false });
      const result = await handlers['tmdb:setKey']({}, { key: 'abcdef1234567890' });
      expect(result).toEqual({ data: { valid: false } });
    });
  });

  describe('tmdb:hasKey', () => {
    it('returns true when key exists', async () => {
      vi.mocked(mockVault.hasTmdbKey).mockReturnValue(true);
      const result = await handlers['tmdb:hasKey']({});
      expect(result).toEqual({ data: true });
    });

    it('returns false when key does not exist', async () => {
      vi.mocked(mockVault.hasTmdbKey).mockReturnValue(false);
      const result = await handlers['tmdb:hasKey']({});
      expect(result).toEqual({ data: false });
    });
  });

  describe('tmdb:clearKey', () => {
    it('calls vault.clearTmdbKey', async () => {
      const result = await handlers['tmdb:clearKey']({});
      expect(mockVault.clearTmdbKey).toHaveBeenCalled();
      expect(result).toEqual({ data: undefined });
    });
  });
});
