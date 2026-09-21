import type { IpcMain } from 'electron';
import type { CatalogListInputParsed, CatalogGetByIdInputParsed } from '../../../shared/schemas/catalog.js';
import type { CatalogListOutput, SeriesDetail } from '../../../shared/types/ipc.js';
import { CatalogListInputSchema, CatalogGetByIdInputSchema, CatalogGroupedInputSchema } from '../../../shared/schemas/catalog.js';
import { invalidInput, notFound } from './catalog/errors.js';
import { mapEpisodeRow, mapRowForType, mapSeriesRow, tableForType } from './catalog/mappers.js';
import { hydrateSeriesEpisodes, loadSeriesEpisodes, uniqueSeriesRows } from './catalog/series.js';
import type { CatalogHandlerDeps } from './catalog/types.js';

/**
 * Catalog IPC handler — exposes paginated reads against the SQLite catalog DB
 * (live_channels / vod_movies / series / episodes).
 *
 * The handler is intentionally DB-bound (no caching layer): the catalog is
 * small enough to scan with a primary-key or indexed lookup, and the cost
 * of an extra cache layer is not justified at this scale.
 */

export type { CatalogHandlerDeps } from './catalog/types.js';

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
    const groupTitle = parsed.groupTitle?.trim();

    // Build WHERE clauses dynamically
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search && search.length > 0) {
      const like = `%${search.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      conditions.push(`name LIKE ? ESCAPE '\\'`);
      params.push(like);
    }

    if (groupTitle && groupTitle.length > 0) {
      conditions.push(`group_title = ?`);
      params.push(groupTitle);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = deps.db
      .prepare(`SELECT COUNT(*) as c FROM ${table} ${whereClause}`)
      .get(...params) as { c: number };
    const total = countRow.c;

    const itemsStmt = deps.db.prepare(
      `SELECT * FROM ${table} ${whereClause} ORDER BY name LIMIT ? OFFSET ?`,
    );
    const rows = itemsStmt.all(...params, limit, offset) as Array<Record<string, unknown>>;
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
    if (parsed.type === 'episode') {
      const episodeRow = deps.db
        .prepare(`SELECT * FROM episodes WHERE id = ?`)
        .get(parsed.id) as Record<string, unknown> | undefined;
      if (!episodeRow) {
        return notFound(`episode id ${parsed.id} not found`);
      }
      return { data: mapEpisodeRow(episodeRow) };
    }
    const table = tableForType(parsed.type);

    const row = deps.db
      .prepare(`SELECT * FROM ${table} WHERE id = ?`)
      .get(parsed.id) as Record<string, unknown> | undefined;

    if (!row) {
      return notFound(`${parsed.type} id ${parsed.id} not found`);
    }

    if (parsed.type === 'series') {
      let xtreamInfo = null;
      let episodes = loadSeriesEpisodes(deps.db, parsed.id);

      if (episodes.length === 0) {
        xtreamInfo = await hydrateSeriesEpisodes(deps, parsed.id, row);
        if (xtreamInfo) {
          episodes = loadSeriesEpisodes(deps.db, parsed.id);
        }
      }

      const seasons = new Map<number, Array<(typeof episodes)[number]>>();
      for (const ep of episodes) {
        const arr = seasons.get(ep.season) ?? [];
        arr.push(ep);
        seasons.set(ep.season, arr);
      }

      const genreList = xtreamInfo?.genre
        ? xtreamInfo.genre.split(/[,/|]/).map((g) => g.trim()).filter(Boolean)
        : undefined;

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
        plot: xtreamInfo?.plot ?? null,
        backdropUrl: xtreamInfo?.backdropUrl ?? null,
        genres: genreList,
      };
      return { data: detail };
    }

    return { data: mapRowForType(parsed.type, row) };
  });

  ipcMain.handle('catalog:groups', async (_event, input: unknown) => {
    const result = CatalogListInputSchema.pick({ type: true }).safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const table = tableForType(result.data.type);
    const rows = deps.db
      .prepare(`SELECT DISTINCT group_title FROM ${table} WHERE group_title IS NOT NULL AND group_title != '' ORDER BY group_title`)
      .all() as Array<{ group_title: string }>;
    return { data: rows.map((r) => r.group_title) };
  });

  ipcMain.handle('catalog:grouped', async (_event, input: unknown) => {
    const result = CatalogGroupedInputSchema.safeParse(input);
    if (!result.success) {
      return invalidInput(result.error.issues);
    }
    const { type, limit } = result.data;
    const table = tableForType(type);

    // Include NULL/empty group_title as Ungrouped. Series ingest often stores
    // rows without a category; excluding them made Series look empty.
    const groups = deps.db
      .prepare(
        `SELECT CASE WHEN group_title IS NULL OR group_title = '' THEN '' ELSE group_title END AS group_title,
                COUNT(*) as count
         FROM ${table}
         GROUP BY CASE WHEN group_title IS NULL OR group_title = '' THEN '' ELSE group_title END
         ORDER BY group_title`,
      )
      .all() as Array<{ group_title: string; count: number }>;

    const groupedItems = groups.map((g) => {
      const rows = (
        g.group_title === ''
          ? deps.db
              .prepare(
                `SELECT * FROM ${table}
                 WHERE group_title IS NULL OR group_title = ''
                 ORDER BY name`,
              )
              .all()
          : deps.db
              .prepare(
                `SELECT * FROM ${table}
                 WHERE group_title = ? ORDER BY name`,
              )
              .all(g.group_title)
      ) as Array<Record<string, unknown>>;
      const uniqueRows = type === 'series' ? uniqueSeriesRows(rows) : rows;
      return {
        title: g.group_title === '' ? 'Ungrouped' : g.group_title,
        count: type === 'series' ? uniqueRows.length : g.count,
        items: uniqueRows.slice(0, limit).map((r) => mapRowForType(type, r)),
      };
    });

    return { data: { groups: groupedItems } };
  });
}
