import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electron module
const mockInvoke = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((name: string, api: unknown) => {
      (globalThis as Record<string, unknown>)[name] = api;
    }),
  },
  ipcRenderer: {
    invoke: mockInvoke,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
}));

describe('preload', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInvoke.mockReset();
    mockOn.mockReset();
    mockRemoveListener.mockReset();
    delete (globalThis as Record<string, unknown>).luxAPI;
  });

  it('exposes luxAPI on window', async () => {
    await import('../../src/preload/index');
    expect((globalThis as Record<string, unknown>).luxAPI).toBeDefined();
  });

  it('exposes all ingest channels', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    expect(api.ingest).toBeDefined();
    const ingest = api.ingest as Record<string, unknown>;
    expect(typeof ingest.start).toBe('function');
    expect(typeof ingest.cancel).toBe('function');
    expect(typeof ingest.getProgress).toBe('function');
    expect(typeof ingest.onProgress).toBe('function');
  });

  it('exposes all catalog channels', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    expect(api.catalog).toBeDefined();
    const catalog = api.catalog as Record<string, unknown>;
    expect(typeof catalog.list).toBe('function');
    expect(typeof catalog.getById).toBe('function');
  });

  it('exposes all enrichment channels', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    expect(api.enrichment).toBeDefined();
    const enrichment = api.enrichment as Record<string, unknown>;
    expect(typeof enrichment.getStatus).toBe('function');
  });

  it('exposes all tmdb channels', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    expect(api.tmdb).toBeDefined();
    const tmdb = api.tmdb as Record<string, unknown>;
    expect(typeof tmdb.setKey).toBe('function');
    expect(typeof tmdb.hasKey).toBe('function');
    expect(typeof tmdb.clearKey).toBe('function');
  });

  it('exposes all player channels', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    expect(api.player).toBeDefined();
    const player = api.player as Record<string, unknown>;
    expect(typeof player.getSource).toBe('function');
    expect(typeof player.getProxiedUrl).toBe('function');
    expect(typeof player.reportError).toBe('function');
    expect(typeof player.reportProgress).toBe('function');
    expect(typeof player.getNextEpisode).toBe('function');
  });

  it('player.getSource forwards to player:getSource channel', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    const player = api.player as Record<string, (input: unknown) => Promise<unknown>>;
    mockInvoke.mockResolvedValue({ data: { url: 'https://x' } });

    await player.getSource({ type: 'live', id: 1 });
    expect(mockInvoke).toHaveBeenCalledWith('player:getSource', { type: 'live', id: 1 });
  });

  it('player.reportError forwards to player:reportError channel', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    const player = api.player as Record<string, (input: unknown) => Promise<unknown>>;
    mockInvoke.mockResolvedValue({ data: undefined });

    await player.reportError({ code: 'STALL', message: 'manifest stalled' });
    expect(mockInvoke).toHaveBeenCalledWith('player:reportError', {
      code: 'STALL',
      message: 'manifest stalled',
    });
  });

  it('ingest.start calls ipcRenderer.invoke with correct channel', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    const ingest = api.ingest as Record<string, (input: unknown) => Promise<unknown>>;
    mockInvoke.mockResolvedValue({ data: { jobId: '123' } });

    await ingest.start({ source: 'm3u', url: 'https://example.com/list.m3u', listName: 'Test' });
    expect(mockInvoke).toHaveBeenCalledWith('ingest:start', {
      source: 'm3u',
      url: 'https://example.com/list.m3u',
      listName: 'Test',
    });
  });

  it('ingest.onProgress registers and returns unsubscribe function', async () => {
    await import('../../src/preload/index');
    const api = (globalThis as Record<string, unknown>).luxAPI as Record<string, unknown>;
    const ingest = api.ingest as Record<string, unknown>;
    const onProgress = ingest.onProgress as (cb: (p: unknown) => void) => () => void;

    const cb = vi.fn();
    const unsubscribe = onProgress(cb);
    expect(typeof unsubscribe).toBe('function');
    expect(mockOn).toHaveBeenCalledWith('ingest:progress', expect.any(Function));
  });
});
