# Delta for catalog-schema

## MODIFIED Requirements

### Requirement: Catalog Table Schema

Each of the 4 catalog tables (live_channels, movies, series, episodes) MUST include an `http_headers` column of type JSON with DEFAULT '{}' and a `media_format` column of type TEXT with DEFAULT 'unknown'. The `media_format` column MUST accept only the enum values: hls, mp4, dash, ts, unknown.

(Previously: 4 catalog tables had no `http_headers` or `media_format` columns.)

#### Scenario: New row inserted without explicit headers

- GIVEN a fresh migration has been applied
- WHEN a row is inserted into `movies` without specifying `http_headers`
- THEN the `http_headers` column MUST equal '{}' (empty JSON object)
- AND `media_format` MUST equal 'unknown'

#### Scenario: Row inserted with valid media_format

- GIVEN the migration is applied
- WHEN a row is inserted into `live_channels` with `media_format = 'hls'`
- THEN the stored value MUST be 'hls'

#### Scenario: Invalid media_format rejected

- GIVEN the migration is applied
- WHEN a row is inserted with `media_format = 'rtmp'`
- THEN the database MUST reject the insert (constraint violation or application-level validation)

### Requirement: CatalogItem DTO

The `CatalogItem` DTO MUST expose a `content_type` field (enum: live | movie | series | episode) and a `media_format` field (enum: hls | mp4 | dash | ts | unknown).

(Previously: `CatalogItem` had no `content_type` or `media_format` fields.)

#### Scenario: DTO populated from DB row

- GIVEN a `movies` row with `media_format = 'mp4'`
- WHEN mapped to `CatalogItem`
- THEN `content_type` MUST equal 'movie'
- AND `media_format` MUST equal 'mp4'

#### Scenario: DTO with default values

- GIVEN a `live_channels` row with `media_format = 'unknown'`
- WHEN mapped to `CatalogItem`
- THEN `content_type` MUST equal 'live'
- AND `media_format` MUST equal 'unknown'

### Requirement: Migration Transactional Safety

The migration script MUST be wrapped in a BEGIN/COMMIT transaction block. All defaults MUST be deterministic and documented. Rollback MUST be a manually authored down migration (DROP COLUMN).

(Previously: No migration existed for these columns.)

#### Scenario: Migration applies atomically

- GIVEN an existing database with data in all 4 tables
- WHEN the migration runs
- THEN either ALL 4 tables gain both columns, or NONE do (atomic rollback on failure)

#### Scenario: Defaults are deterministic

- GIVEN the migration has run
- WHEN any existing row is queried
- THEN `http_headers` MUST be '{}' and `media_format` MUST be 'unknown' — same value for every pre-existing row

#### Scenario: Down migration removes columns

- GIVEN the up migration has been applied
- WHEN the manually authored down migration runs
- THEN `http_headers` and `media_format` columns MUST be dropped from all 4 tables
### Requirement: Container Extension And Direct Source Columns

Each of the 4 catalog tables MUST include `container_extension` TEXT DEFAULT '' and `direct_source` TEXT DEFAULT ''. Persisting mkv MUST NOT set `media_format` to `mp4`.

#### Scenario: New columns default empty

- GIVEN the migration has been applied
- WHEN a row is inserted without those fields
- THEN `container_extension` and `direct_source` MUST be empty strings

#### Scenario: mkv is not stored as mp4

- GIVEN a movie with container extension `mkv`
- WHEN the row is persisted
- THEN `container_extension` MUST be `mkv` and `media_format` MUST NOT be `mp4`

### Requirement: CatalogItem Honest Source Fields

`CatalogItem` MUST expose `container_extension` and `direct_source`.

#### Scenario: DTO maps new fields

- GIVEN a movie row with `container_extension=mkv` and a non-empty `direct_source`
- WHEN mapped to `CatalogItem`
- THEN both fields MUST match the row

### Requirement: Honest Source Columns Migration

A transactional migration MUST add `container_extension` and `direct_source` to all 4 catalog tables. Down MUST drop only those two columns.

#### Scenario: Up adds columns atomically

- GIVEN existing catalog data
- WHEN the migration runs
- THEN all 4 tables MUST gain both columns or none

#### Scenario: Down drops new columns only

- GIVEN the up migration has been applied
- WHEN down runs
- THEN those two columns MUST be dropped and `http_headers`/`media_format` MUST remain
