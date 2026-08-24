// ─── Catalog DTOs ─────────────────────────────────────────────────────────────
// These match the Drizzle schema columns for each table.

export type EnrichmentStatusValue = 'pending' | 'enriched' | 'not_found' | 'error';

export interface LiveChannel {
  id: number;
  xtreamId: number | null;
  name: string;
  url: string;
  groupTitle: string | null;
  tvgId: string | null;
  tvgLogo: string | null;
  streamType: string;
  enrichmentStatus: EnrichmentStatusValue;
  addedAt: number;
}

export interface VodMovie {
  id: number;
  xtreamId: number | null;
  name: string;
  url: string;
  groupTitle: string | null;
  cover: string | null;
  streamType: string;
  year: number | null;
  enrichmentStatus: EnrichmentStatusValue;
  addedAt: number;
}

export interface Series {
  id: number;
  xtreamId: number | null;
  name: string;
  groupTitle: string | null;
  cover: string | null;
  streamType: string;
  year: number | null;
  enrichmentStatus: EnrichmentStatusValue;
  addedAt: number;
}

export interface Episode {
  id: number;
  seriesId: number;
  name: string;
  url: string;
  season: number;
  episode: number;
  cover: string | null;
  enrichmentStatus: EnrichmentStatusValue;
  addedAt: number;
}
