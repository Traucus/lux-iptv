import type { IpcMain } from 'electron';
import { EpgNowNextInputSchema } from '../../../shared/schemas/epg.js';
import type { IpcResult } from '../../../shared/types/ipc.js';
import type { SqlJsCompatDb } from '../../db/sqljs-adapter.js';
import type { XtreamCredentials } from '../../services/xtream-client.js';
import { fetchXtreamShortEpg } from '../../services/xtream-client.js';
import { parseXtreamShortEpg, pickNowNext, type EpgProgramme } from '../../services/epg.js';

export type EpgNowNextItem = {
  channelId: number;
  now: { title: string; endAt: number } | null;
  next: { title: string; startAt: number } | null;
};

export type EpgHandlerDeps = {
  db: SqlJsCompatDb;
  loadXtreamCredentials?: () => XtreamCredentials | null;
  fetchShortEpg?: typeof fetchXtreamShortEpg;
};

function invalidInput(details: unknown): IpcResult<never> {
  return { error: { code: 'INVALID_INPUT', message: 'Invalid input', details } };
}

function readStoredProgrammes(db: SqlJsCompatDb, channelId: number): EpgProgramme[] {
  return db
    .prepare(
      `SELECT title, description, start_at, end_at
       FROM epg_programmes
       WHERE channel_id = ?
       ORDER BY start_at`,
    )
    .all(channelId)
    .map((row) => ({
      title: String(row.title ?? ''),
      description: typeof row.description === 'string' ? row.description : null,
      startAt: Number(row.start_at),
      endAt: Number(row.end_at),
    }));
}

function upsertProgrammes(db: SqlJsCompatDb, channelId: number, programmes: EpgProgramme[]): void {
  const insert = db.prepare(
    `INSERT INTO epg_programmes (channel_id, title, description, start_at, end_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(channel_id, start_at) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       end_at = excluded.end_at`,
  );
  for (const programme of programmes) {
    insert.run(channelId, programme.title, programme.description, programme.startAt, programme.endAt);
  }
}

function toWire(nowNext: ReturnType<typeof pickNowNext>): Omit<EpgNowNextItem, 'channelId'> {
  return {
    now: nowNext.now ? { title: nowNext.now.title, endAt: nowNext.now.endAt } : null,
    next: nowNext.next ? { title: nowNext.next.title, startAt: nowNext.next.startAt } : null,
  };
}

export async function loadNowNextForChannels(
  deps: EpgHandlerDeps,
  channelIds: number[],
  now = Date.now(),
): Promise<EpgNowNextItem[]> {
  const creds = deps.loadXtreamCredentials?.() ?? null;
  const fetchEpg = deps.fetchShortEpg ?? fetchXtreamShortEpg;
  const items: EpgNowNextItem[] = [];

  for (const channelId of channelIds) {
    let programmes = readStoredProgrammes(deps.db, channelId);
    let picked = pickNowNext(programmes, now);
    if (!picked.now && creds) {
      const channel = deps.db
        .prepare(`SELECT xtream_id FROM live_channels WHERE id = ?`)
        .get(channelId) as { xtream_id: number | null } | undefined;
      const streamId = Number(channel?.xtream_id);
      if (Number.isFinite(streamId) && streamId > 0) {
        try {
          const raw = await fetchEpg(creds, streamId);
          programmes = parseXtreamShortEpg(raw);
          upsertProgrammes(deps.db, channelId, programmes);
          picked = pickNowNext(programmes, now);
        } catch {
          // Keep stored/empty now-next. Play must not depend on EPG.
        }
      }
    }
    items.push({ channelId, ...toWire(picked) });
  }

  return items;
}

export function registerEpgHandlers(ipcMain: IpcMain, deps: EpgHandlerDeps): void {
  ipcMain.handle('epg:nowNext', async (_event, input: unknown) => {
    const parsed = EpgNowNextInputSchema.safeParse(input);
    if (!parsed.success) {
      return invalidInput(parsed.error.issues);
    }
    const items = await loadNowNextForChannels(deps, parsed.data.channelIds);
    return { data: { items } };
  });
}
