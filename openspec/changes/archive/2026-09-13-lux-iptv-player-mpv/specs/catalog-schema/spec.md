# Delta for catalog-schema

## ADDED Requirements

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
