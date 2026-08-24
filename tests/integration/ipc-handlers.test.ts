import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerHandlers, type HandlerContext } from '../../src/main/ipc/index';

describe('ipc handlers', () => {
  let mockContext: HandlerContext;
  let handlers: Map<string, (input: unknown) => Promise<unknown>>;

  beforeEach(() => {
    mockContext = {
      mainWindow: { webContents: { send: vi.fn() } } as unknown as HandlerContext['mainWindow'],
    };
    handlers = new Map();

    // Mock ipcMain.handle to capture registered handlers
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
          handlers.set(channel, (input: unknown) => handler({}, input));
        },
      },
    }));
  });

  it('registers all expected channels', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc/index');
    register(mockContext);

    const expectedChannels = [
      'ingest:start',
      'ingest:cancel',
      'ingest:getProgress',
      'catalog:list',
      'catalog:getById',
      'enrichment:getStatus',
      'tmdb:setKey',
      'tmdb:hasKey',
      'tmdb:clearKey',
    ];

    for (const channel of expectedChannels) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  it('returns INVALID_INPUT for invalid ingest:start input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc/index');
    register(mockContext);

    const handler = handlers.get('ingest:start');
    expect(handler).toBeDefined();

    const result = await handler!({ source: 'invalid' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });

  it('returns INTERNAL error for valid ingest:start input (stub)', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc/index');
    register(mockContext);

    const handler = handlers.get('ingest:start');
    const result = await handler!({
      source: 'm3u',
      url: 'https://example.com/playlist.m3u',
      listName: 'Test',
    });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL' }),
      }),
    );
  });

  it('returns INVALID_INPUT for invalid catalog:list input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc/index');
    register(mockContext);

    const handler = handlers.get('catalog:list');
    const result = await handler!({ type: 'radio' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });

  it('returns INTERNAL error for valid catalog:list input (stub)', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc/index');
    register(mockContext);

    const handler = handlers.get('catalog:list');
    const result = await handler!({ type: 'movie' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL' }),
      }),
    );
  });

  it('returns INVALID_INPUT for invalid tmdb:setKey input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc/index');
    register(mockContext);

    const handler = handlers.get('tmdb:setKey');
    const result = await handler!({ key: 'short' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });
});
