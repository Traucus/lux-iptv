export const DEFAULT_TIMEOUT_MS = 15000;

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

export type XtreamSeriesEpisode = {
  season: number;
  episode: number;
  streamId: number;
  name: string;
  cover: string | null;
  extension: string;
};

export type XtreamSeriesInfo = {
  plot: string | null;
  genre: string | null;
  backdropUrl: string | null;
  cover: string | null;
  episodes: XtreamSeriesEpisode[];
};

export interface XtreamCategory {
  category_id: string;
  category_name: string;
}

export interface XtreamLiveStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  epg_channel_id: string | null;
  added: string;
  category_id: string;
  category_ids: number[];
  custom_sid: string;
  tv_archive: number;
  direct_source: string;
  tv_archive_duration: number;
  user_agent?: unknown;
  referer?: unknown;
}

export interface XtreamVodStream {
  num: number;
  name: string;
  stream_type: string;
  stream_id: number;
  stream_icon: string;
  rating: string;
  rating_5based: number;
  added: string;
  is_adult: string;
  category_id: string;
  category_ids: number[];
  container_extension: string;
  custom_sid: string;
  direct_source: string;
  user_agent?: unknown;
  referer?: unknown;
}

export interface XtreamSeries {
  num: number;
  name: string;
  series_id: number;
  cover: string;
  plot: string;
  cast: string;
  director: string;
  genre: string;
  releaseDate: string;
  rating: string;
  rating_5based: number;
  backdrop_path: string[];
  youtube_trailer: string;
  episode_run_time: string;
  category_id: string;
  category_ids: number[];
}

export type HonestStreamUrlInput = {
  server: string;
  type: 'live' | 'movie' | 'series';
  username: string;
  password: string;
  streamId: number;
  containerExtension?: string | null;
  directSource?: string | null;
};
