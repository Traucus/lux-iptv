import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { createSqlJsDb, initSqlJsModule, type SqlJsCompatDb } from '../../src/main/db/sqljs-adapter.js';
import type { IpcMain } from 'electron';
import { registerEpgHandlers } from '../../src/main/ipc/handlers/epg';

function captureIpcMain() {
  const captured: Array<{ channel: string; fn: (event: unknown, input: unknown) => Promise<unknown> }> = [];
  const ipc = {
    handle: (channel: string, fn: (event: unknown, input: unknown) => Promise<unknown>) => {
      captured.push({ channel, fn });
    },
  } as unknown as IpcMain;
  return { ipc, captured };
}

describe('epg handlers', () => {
  let db: SqlJsCompatDb;

  beforeAll(async () => {
    await initSqlJsModule();
  });

  beforeEach(() => {
    db = createSqlJsDb(':memory:');
    db.exec(`
      CREATE TABLE live_channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        xtream_id INTEGER,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE epg_programmes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_at INTEGER NOT NULL,
        end_at INTEGER NOT NULL,
        UNIQUE(channel_id, start_at)
      );
    `);
    db.prepare(`INSERT INTO live_channels (xtream_id, name, url, added_at) VALUES (?, ?, ?, ?)`).run(
      77,
      'CNN',
      'https://x/cnn',
      1,
    );
  });

  afterEach(() => {
    db.close();
  });

  it('fetches short EPG, stores it, and returns now/next', async () => {
    const now = Date.now();
    const fetchShortEpg = vi.fn().mockResolvedValue({
      epg_listings: [
        {
          title: Buffer.from('News').toString('base64'),
          start_timestamp: Math.floor((now - 60_000) / 1000),
          stop_timestamp: Math.floor((now + 1_800_000) / 1000),
        },
      ],
    });
    const { ipc, captured } = captureIpcMain();
    registerEpgHandlers(ipc, {
      db,
      loadXtreamCredentials: () => ({ server: 'http://x', username: 'u', password: 'p' }),
      fetchShortEpg,
    });
    const nowNext = captured.find((c) => c.channel === 'epg:nowNext')!.fn;
    const result = await nowNext({}, { channelIds: [1] });
    const data = (result as { data: { items: Array<{ now: { title: string } | null }> } }).data;
    expect(fetchShortEpg).toHaveBeenCalledWith({ server: 'http://x', username: 'u', password: 'p' }, 77);
    expect(data.items[0]?.now?.title).toBe('News');
  });
});
