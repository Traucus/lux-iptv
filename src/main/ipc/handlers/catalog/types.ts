import type { SqlJsCompatDb } from '../../../db/sqljs-adapter.js';
import {
  fetchXtreamSeriesInfo,
  type XtreamCredentials,
} from '../../../services/xtream-client.js';

export interface CatalogHandlerDeps {
  db: SqlJsCompatDb;
  loadXtreamCredentials?: () => XtreamCredentials | null;
  fetchSeriesInfo?: typeof fetchXtreamSeriesInfo;
}

export type EpisodeRow = {
  id: number;
  series_id: number;
  name: string;
  url: string;
  season: number;
  episode: number;
  cover: string | null;
  added_at: number;
};
