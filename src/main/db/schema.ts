import { sqliteTable, integer, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── live_channels ────────────────────────────────────────────────────────────
export const liveChannels = sqliteTable(
  'live_channels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    xtreamId: integer('xtream_id'),
    name: text('name').notNull(),
    url: text('url').notNull().unique(),
    groupTitle: text('group_title'),
    tvgId: text('tvg_id'),
    tvgLogo: text('tvg_logo'),
    streamType: text('stream_type').notNull().default('live'),
    addedAt: integer('added_at').notNull(),
  },
  (t) => ({
    byXtreamId: uniqueIndex('live_xtream_id_uq')
      .on(t.xtreamId)
      .where(sql`${t.xtreamId} IS NOT NULL`),
    byName: index('live_name_idx').on(t.name),
    byGroup: index('live_group_idx').on(t.groupTitle),
  }),
);

// ─── vod_movies ───────────────────────────────────────────────────────────────
export const vodMovies = sqliteTable(
  'vod_movies',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    xtreamId: integer('xtream_id'),
    name: text('name').notNull(),
    url: text('url').notNull().unique(),
    groupTitle: text('group_title'),
    cover: text('cover'),
    streamType: text('stream_type').notNull().default('movie'),
    year: integer('year'),
    addedAt: integer('added_at').notNull(),
  },
  (t) => ({
    byXtreamId: uniqueIndex('vod_xtream_id_uq')
      .on(t.xtreamId)
      .where(sql`${t.xtreamId} IS NOT NULL`),
    byName: index('vod_name_idx').on(t.name),
    byGroup: index('vod_group_idx').on(t.groupTitle),
  }),
);

// ─── series ───────────────────────────────────────────────────────────────────
export const series = sqliteTable(
  'series',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    xtreamId: integer('xtream_id'),
    name: text('name').notNull(),
    groupTitle: text('group_title'),
    cover: text('cover'),
    streamType: text('stream_type').notNull().default('series'),
    year: integer('year'),
    addedAt: integer('added_at').notNull(),
  },
  (t) => ({
    byXtreamId: uniqueIndex('series_xtream_id_uq')
      .on(t.xtreamId)
      .where(sql`${t.xtreamId} IS NOT NULL`),
    byName: index('series_name_idx').on(t.name),
    byGroup: index('series_group_idx').on(t.groupTitle),
  }),
);

// ─── episodes ─────────────────────────────────────────────────────────────────
export const episodes = sqliteTable(
  'episodes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    seriesId: integer('series_id')
      .notNull()
      .references(() => series.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull().unique(),
    season: integer('season').notNull(),
    episode: integer('episode').notNull(),
    cover: text('cover'),
    addedAt: integer('added_at').notNull(),
  },
  (t) => ({
    bySeries: index('episodes_series_idx').on(t.seriesId),
    bySeasonEpisode: index('episodes_season_episode_idx').on(t.seriesId, t.season, t.episode),
  }),
);

// ─── schema_version ───────────────────────────────────────────────────────────
export const schemaVersion = sqliteTable('schema_version', {
  version: integer('version').primaryKey(),
  appliedAt: integer('applied_at').notNull(),
});
