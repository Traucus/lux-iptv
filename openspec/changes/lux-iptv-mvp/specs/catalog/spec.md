# Spec: Catalog

## Purpose

Persist the ingested content catalog using `better-sqlite3` in the Electron main process, providing structured tables for `live_channels`, `vod_movies`, `series`, and `episodes`. The user-facing outcome is that all content survives application restarts and can be queried efficiently by the renderer through IPC.

## Requirements

### REQ-CATALOG-1: SQLite Schema

The system SHALL create and maintain four SQLite tables in the main process with the following minimum schema:

| Table | Key Columns |
|-------|-------------|
| `live_channels` | `id` (PK), `name`, `url`, `group_title`, `tvg_id`, `tvg_logo`, `stream_type`, `created_at` |
| `vod_movies` | `id` (PK), `name`, `url`, `group_title`, `cover`, `stream_type`, `year`, `created_at` |
| `series` | `id` (PK), `name`, `group_title`, `cover`, `stream_type`, `year`, `created_at` |
| `episodes` | `id` (PK), `series_id` (FK), `name`, `url`, `season`, `episode`, `cover`, `created_at` |

#### Scenario: First-run database initialization

- GIVEN the application starts with no existing database file
- WHEN the main process boots
- THEN it creates the SQLite database at the app data directory
- AND all four tables are created with the required columns and indexes
- AND the database version is recorded as `1`

#### Scenario: Schema migration on restart

- GIVEN an existing database from a previous version
- WHEN the application starts
- THEN it reads the stored version and applies any pending migrations
- AND no data is lost during migration

### REQ-CATALOG-2: Batch Insertion

The system SHALL insert ingested items into SQLite using batched transactions (batches of 1,000 records) to avoid blocking the main event loop for more than 50 ms per batch.

#### Scenario: Bulk insert of live channels

- GIVEN 8,000 parsed live channel entries from the ingest worker
- WHEN the main process receives the batched data
- THEN it inserts records in transactions of 1,000
- AND each transaction completes in under 50 ms
- AND all 8,000 records are persisted

#### Scenario: Mixed-type bulk insert

- GIVEN ingested items of types `live`, `movie`, and `series`
- WHEN the main process distributes them to respective tables
- THEN each table receives only its matching type
- AND foreign key relationships (series → episodes) are maintained

### REQ-CATALOG-3: Query API

The system SHALL expose query methods for the renderer to retrieve content by type, category, search term, and ID through IPC.

#### Scenario: Retrieve all movies

- GIVEN 500 movies exist in the `vod_movies` table
- WHEN the renderer requests `GET /catalog/movies`
- THEN it receives all 500 records with pagination (limit 50, offset 0)
- AND the response includes `id`, `name`, `cover`, `year`, and `enrichment_status`

#### Scenario: Search across all content types

- GIVEN content exists across all four tables
- WHEN the renderer searches for `"Avatar"`
- THEN results are returned from `live_channels`, `vod_movies`, and `series` that match
- AND results are sorted by relevance (exact match first, then prefix, then contains)

#### Scenario: Get series with episodes

- GIVEN a series with 3 seasons and 24 episodes
- WHEN the renderer requests `GET /catalog/series/:id`
- THEN it receives the series metadata plus all episodes grouped by season
- AND the response is structured as `{ series, seasons: [{ season_number, episodes: [...] }] }`

### REQ-CATALOG-4: Persistence Survival

The system SHALL persist all catalog data such that it survives application restarts without re-ingestion.

#### Scenario: Restart with existing catalog

- GIVEN 3,000 live channels and 2,000 movies have been ingested
- WHEN the user closes and reopens the application
- THEN the dashboard loads content from the SQLite database immediately
- AND no re-ingestion is triggered automatically

#### Scenario: Incremental update

- GIVEN an existing catalog and a new ingestion session with overlapping items
- WHEN the new ingestion completes
- THEN new items are inserted and existing items are updated (upsert by unique URL or Xtream stream ID)
- AND items no longer present in the source are NOT automatically deleted

## Out of Scope

- FTS5 full-text search (future optimization)
- Profile-scoped queries (slice 4 — parental control)
- EPG data tables (slice 3)
- Playback history and resume positions (slice 2)
