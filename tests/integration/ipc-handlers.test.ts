import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { HandlerDeps } from '../../src/main/ipc';

describe('ipc handlers', () => {
  let handlers: Map<string, (input: unknown) => Promise<unknown>>;
  let capturedChannels: string[];

  beforeEach(() => {
    handlers = new Map();
    capturedChannels = [];

    // Mock ipcMain.handle + ipcMain.on to capture every registered channel
    // and its handler. We don't invoke the renderer side here; the catalog
    // and player handlers expect a real DB so we hand them the test's
    // in-memory SQLite handle.
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: (channel: string, handler: (event: unknown, input: unknown) => Promise<unknown>) => {
          capturedChannels.push(channel);
          handlers.set(channel, (input: unknown) => handler({}, input));
        },
        on: (channel: string, _handler: (...args: unknown[]) => void) => {
          capturedChannels.push(channel);
        },
      },
    }));
  });

  function buildDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps {
    return {
      mainWindow: { webContents: { send: vi.fn() } } as unknown as HandlerDeps['mainWindow'],
      db: {} as HandlerDeps['db'],
      ingestOrchestrator: {
        start: vi.fn(),
        cancel: vi.fn(),
        getProgress: vi.fn(),
      } as unknown as HandlerDeps['ingestOrchestrator'],
      tmdbVault: {
        setTmdbKey: vi.fn(),
        hasTmdbKey: vi.fn(),
        getTmdbKeyPlain: vi.fn(),
        clearTmdbKey: vi.fn(),
      } as unknown as HandlerDeps['tmdbVault'],
      ...overrides,
    };
  }

  it('registers all expected channels', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc');
    register(buildDeps());

    const expectedChannels = [
      // Ingest
      'ingest:start',
      'ingest:cancel',
      'ingest:getProgress',
      // Catalog
      'catalog:list',
      'catalog:getById',
      // Enrichment
      'enrichment:getStatus',
      // TMDB
      'tmdb:setKey',
      'tmdb:hasKey',
      'tmdb:clearKey',
      // Player
      'player:getSource',
      'player:getProxiedUrl',
      'player:reportError',
      'player:reportProgress',
      'player:getNextEpisode',
    ];

    for (const channel of expectedChannels) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  it('returns INVALID_INPUT for invalid ingest:start input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc');
    register(buildDeps());

    const handler = handlers.get('ingest:start');
    expect(handler).toBeDefined();

    const result = await handler!({ source: 'invalid' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });

  it('returns INVALID_INPUT for invalid catalog:list input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc');
    register(buildDeps());

    const handler = handlers.get('catalog:list');
    const result = await handler!({ type: 'radio' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });

  it('returns INVALID_INPUT for invalid tmdb:setKey input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc');
    register(buildDeps());

    const handler = handlers.get('tmdb:setKey');
    const result = await handler!({ key: 'short' });
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });

  it('returns INVALID_INPUT for invalid player:getSource input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc');
    register(buildDeps());

    const handler = handlers.get('player:getSource');
    const result = await handler!({ type: 'live' }); // missing id
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });

  it('returns INVALID_INPUT for invalid player:reportError input', async () => {
    const { registerHandlers: register } = await import('../../src/main/ipc');
    register(buildDeps());

    const handler = handlers.get('player:reportError');
    const result = await handler!({ code: 'X' }); // missing message
    expect(result).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INVALID_INPUT' }),
      }),
    );
  });
});
