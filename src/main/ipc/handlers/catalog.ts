import type { IpcMain } from 'electron';
import type { SqlJsCompatDb } from '../../db/sqljs-adapter.js';
import type { CatalogListInputParsed, CatalogGetByIdInputParsed } from '../../../shared/schemas/catalog.js';
import type {
  CatalogItem,
  CatalogListOutput,
  SeriesDetail,
  CatalogType,
} from '../../../shared/types/ipc.js';
import { CatalogListInputSchema, CatalogGetByIdInputSchema } from '../../../shared/schemas/catalog.js';

/**
 * Catalog IPC handler — exposes paginated reads against the SQLite catalog DB
 * (live_channels / vod_movies / series / episodes).
 *
 * The handler is intentionally DB-bound (no caching layer): the catalog is
 * small enough to scan with a primary-key or indexed lookup, and the cost
 * of an extra cache layer is not justified at this scale.
 */
export interface CatalogHandlerDeps {
  db: SqlJsCompatDb;
}

function invalidInput(details: unknown) {
  return { error: { code: 'INVALID_INPUT' as const, message: 'Invalid input', details } };
}

function notFound(message: string) {
  return { error: { code: 'NOT_FOUND' as const, message } };
}

function mapLiveRow(row: Record<string, unknown>): CatalogItem {
  return {
    id: row.id as number,
    name: row.name as string,
    url: row.url as string,
    groupTitle: (row.group_title as string | null) ?? null,
    cover: (row.stream_icon as string | null) ?? (row.tvg_logo as string | null) ?? null,
    year: null,
    contentType: (row.stream_type as 'live' | 'movie' | 'series' | 'episode') ?? 'live',
    mediaFormat: ((row.media_format as string) ?? 'unknown') as CatalogItem['mediaFormat'],
    httpHeaders: parseHttpHeaders(row.http_headers),
  };
}

function mapMovieRow(row: Record<string, unknown>): CatalogItem {
  return {
    id: row.id as number,
    name: row.name as string,
    url: row.url as string,
    groupTitle: (row.group_title as string | null) ?? null,
    cover: (row.cover as string | null) ?? null,
    year: (row.year as number | null) ?? null,
    contentType: 'movie',
    mediaFormat: ((row.media_format as string) ?? 'unknown') as CatalogItem['mediaFormat'],
    httpHeaders: parseHttpHeaders(row.http_headers),
  };
}

function mapSeriesRow(row: Record<string, unknown>): CatalogItem {
  return {
    id: row.id as number,
    name: row.name as string,
    url: (row.url as string | null) ?? '',
    groupTitle: (row.group_title as string | null) ?? null,
    cover: (row.cover as string | null) ?? null,
    year: (row.year as number | null) ?? null,
    contentType: 'series',
    mediaFormat: ((row.media_format as string) ?? 'unknown') as CatalogItem['mediaFormat'],
    httpHeaders: parseHttpHeaders(row.http_headers),
  };
}

/**
 * Defensive JSON parser for the http_headers column. SQLite stores it as TEXT
 * (Drizzle's `mode: 'json'`). Falls back to `{}` on any parse error so a single
 * bad row never breaks the whole list endpoint.
 */
function parseHttpHeaders(raw: unknown): Record<string, string> {
  if (!raw) return {};
  if (typeof raw !== 'string') {
    if (typeof raw === 'object') return raw as Record<string, string>;
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
    return {};
  } catch {
    return {};
  }
}

function tableForType(type: CatalogType): string {
  switch (type) {
    case 'live':
      return 'live_channels';
    case 'movie':
      return 'vod_movies';
    case 'series':
      return 'series';
    case 'episode':
      // Episodes are not a top-level catalog table; they live under series
      throw new Error('Episode type not supported for direct catalog queries');
  }
}

function mapRowForType(type: CatalogType, row: Record<string, unknown>): CatalogItem {
  switch (type) {
    case 'live':
      return mapLiveRow(row);
    case 'movie':
      return mapMovieRow(row);
    case 'series':
      return mapSeriesRow(row);
    case 'episode':
      throw new Error('Episode type not supported for direct catalog queries');
  }
}

export function registerCatalogHandlers(ipcMain: IpcMain, deps: CatalogHandlerDeps): void {
  ipcMain.handle('catalog:list', async (_event, input: unknown) => {
    const result = CatalogListInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const parsed: CatalogListInputParsed = result.data;
    const table = tableForType(parsed.type);

    const limit = parsed.limit;
    const offset = parsed.offset;
    const search = parsed.search?.trim();

    let total = 0;
    let itemsStmt;
    if (search && search.length > 0) {
      const like = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      total = (
        deps.db
          .prepare(`SELECT COUNT(*) as c FROM ${table} WHERE name LIKE ? ESCAPE '\\'`)
          .get(like) as { c: number }
      ).c;
      itemsStmt = deps.db.prepare(
        `SELECT * FROM ${table} WHERE name LIKE ? ESCAPE '\\' ORDER BY name LIMIT ? OFFSET ?`,
      );
      const rows = itemsStmt.all(like, limit, offset) as Array<Record<string, unknown>>;
      return {
        data: {
          items: rows.map((r) => mapRowForType(parsed.type, r)),
          total,
        } satisfies CatalogListOutput,
      };
    }

    total = (deps.db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
    itemsStmt = deps.db.prepare(`SELECT * FROM ${table} ORDER BY name LIMIT ? OFFSET ?`);
    const rows = itemsStmt.all(limit, offset) as Array<Record<string, unknown>>;
    return {
      data: {
        items: rows.map((r) => mapRowForType(parsed.type, r)),
        total,
      } satisfies CatalogListOutput,
    };
  });

  ipcMain.handle('catalog:getById', async (_event, input: unknown) => {
    const result = CatalogGetByIdInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const parsed: CatalogGetByIdInputParsed = result.data;
    const table = tableForType(parsed.type);

    const row = deps.db
      .prepare(`SELECT * FROM ${table} WHERE id = ?`)
      .get(parsed.id) as Record<string, unknown> | undefined;

    if (!row) {
      return notFound(`${parsed.type} id ${parsed.id} not found`);
    }

    if (parsed.type === 'series') {
      // For series, return the parent + its seasons/episodes. Episodes live in
      // a separate table joined by series_id; ordering is (season, episode).
      const episodes = deps.db
        .prepare(
          `SELECT id, series_id, name, url, season, episode, cover, added_at
           FROM episodes
           WHERE series_id = ?
           ORDER BY season, episode`,
        )
        .all(parsed.id) as Array<{
          id: number;
          series_id: number;
          name: string;
          url: string;
          season: number;
          episode: number;
          cover: string | null;
          added_at: number;
        }>;

      const seasons = new Map<number, Array<typeof episodes[number]>>();
      for (const ep of episodes) {
        const arr = seasons.get(ep.season) ?? [];
        arr.push(ep);
        seasons.set(ep.season, arr);
      }

      const detail: SeriesDetail = {
        series: mapSeriesRow(row),
        seasons: Array.from(seasons.entries())
          .sort(([a], [b]) => a - b)
          .map(([seasonNumber, eps]) => ({
            seasonNumber,
            episodes: eps.map((e) => ({
              id: e.id,
              seriesId: e.series_id,
              name: e.name,
              url: e.url,
              season: e.season,
              episode: e.episode,
              cover: e.cover,
              addedAt: e.added_at,
            })),
          })),
      };
      return { data: detail };
    }

    return { data: mapRowForType(parsed.type, row) };
  });
}