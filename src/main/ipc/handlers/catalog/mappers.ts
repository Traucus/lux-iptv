import type { CatalogItem, CatalogType } from '../../../../shared/types/ipc.js';

function honestSourceFields(row: Record<string, unknown>): {
  containerExtension: string;
  directSource: string;
} {
  return {
    containerExtension: typeof row.container_extension === 'string' ? row.container_extension : '',
    directSource: typeof row.direct_source === 'string' ? row.direct_source : '',
  };
}

/**
 * Defensive JSON parser for the http_headers column. SQLite stores it as TEXT
 * (Drizzle's `mode: 'json'`). Falls back to `{}` on any parse error so a single
 * bad row never breaks the whole list endpoint.
 */
export function parseHttpHeaders(raw: unknown): Record<string, string> {
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

export function mapLiveRow(row: Record<string, unknown>): CatalogItem {
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
    ...honestSourceFields(row),
  };
}

export function mapMovieRow(row: Record<string, unknown>): CatalogItem {
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
    ...honestSourceFields(row),
  };
}

export function mapEpisodeRow(row: Record<string, unknown>): CatalogItem {
  return {
    id: row.id as number,
    name: row.name as string,
    url: row.url as string,
    groupTitle: (row.group_title as string | null) ?? null,
    cover: (row.cover as string | null) ?? null,
    year: null,
    contentType: 'episode',
    mediaFormat: ((row.media_format as string) ?? 'unknown') as CatalogItem['mediaFormat'],
    httpHeaders: parseHttpHeaders(row.http_headers),
    ...honestSourceFields(row),
  };
}

export function mapSeriesRow(row: Record<string, unknown>): CatalogItem {
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
    ...honestSourceFields(row),
  };
}

export function tableForType(type: CatalogType): string {
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

export function mapRowForType(type: CatalogType, row: Record<string, unknown>): CatalogItem {
  switch (type) {
    case 'live':
      return mapLiveRow(row);
    case 'movie':
      return mapMovieRow(row);
    case 'series':
      return mapSeriesRow(row);
    case 'episode':
      return mapEpisodeRow(row);
  }
}
