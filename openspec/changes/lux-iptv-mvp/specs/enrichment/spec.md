# Spec: Enrichment

## Purpose

Implement a TMDB enrichment queue that hydrates ingested content with posters, backdrops, synopses, and metadata. The user-facing outcome is a visually rich catalog with Netflix-quality imagery and information, while respecting TMDB rate limits and handling failures gracefully per DOC-8 §8.4-8.5.

## Requirements

### REQ-ENRICH-1: Name Preprocessing

The system SHALL sanitize and extract structured data from raw M3U/Xtream content names before querying TMDB, following DOC-8 §8.3.

#### Scenario: Extract IMDb ID from noisy title

- GIVEN a raw name `"Avatar (2009) [1080p BluRay x264 YIFY tt0499549].mkv"`
- WHEN the preprocessing pipeline runs
- THEN `imdbId` is extracted as `"tt0499549"`
- AND `cleanTitle` is `"Avatar"`
- AND `year` is `2009`

#### Scenario: Extract season/episode pattern

- GIVEN a raw name `"Breaking.Bad.S03E07.720p.HDTV.x264"`
- WHEN the preprocessing pipeline runs
- THEN `seriesName` is `"Breaking Bad"`
- AND `season` is `3`, `episode` is `7`

#### Scenario: Strip noise tags

- GIVEN a raw name `"The.Matrix.1999.2160p.UHD.BluRay.x265.HEVC.DTS.5.1-RARBG"`
- WHEN the preprocessing pipeline runs
- THEN `cleanTitle` is `"The Matrix"` with all quality/codec/release tags removed
- AND `year` is `1999`

### REQ-ENRICH-2: TMDB Search Cascade

The system SHALL query TMDB using a cascading fallback strategy per DOC-8 §8.4: IMDb exact match → search with year → multi-search fallback.

#### Scenario: IMDb exact match (Priority 1)

- GIVEN a preprocessed item with `imdbId: "tt0499549"`
- WHEN the enrichment service queries TMDB
- THEN it calls `GET /find/tt0499549?external_source=imdb_id`
- AND returns the match with `matchConfidence: 1.0`

#### Scenario: Search with year (Priority 2)

- GIVEN a movie with `cleanTitle: "Inception"` and `year: 2010` but no IMDb ID
- WHEN the enrichment service queries TMDB
- THEN it calls `GET /search/movie?query=Inception&year=2010`
- AND returns the first result with `vote_count >= 5`

#### Scenario: Multi-search fallback (Priority 4)

- GIVEN a title with no IMDb ID and no year
- WHEN the enrichment service queries TMDB
- THEN it calls `GET /search/multi?query={title}`
- AND validates the top result's `matchConfidence` before persisting

### REQ-ENRICH-3: Hydration Queue

The system SHALL manage enrichment as a queued job system with concurrency limit of 5, exponential backoff, and negative caching per DOC-8 §8.5.

#### Scenario: Concurrent hydration

- GIVEN 100 items with `enrichment_status: 'pending'`
- WHEN the hydration queue starts
- THEN exactly 5 items are processed in parallel
- AND as each item completes, the next pending item is dequeued

#### Scenario: Exponential backoff on 429

- GIVEN the queue is processing items
- WHEN TMDB responds with `429 Too Many Requests`
- THEN the failed item is retried after 1000 ms, then 2000 ms, then 4000 ms
- AND after 3 failed attempts, the item is marked `enrichment_status: 'error'`

#### Scenario: Negative cache

- GIVEN an item that returns no TMDB matches
- WHEN the hydration completes
- THEN `enrichment_status` is set to `'not_found'`
- AND `ttl_expires_at` is set to 30 days from now
- AND the item is NOT re-queried within that TTL period

### REQ-ENRICH-4: Confidence Threshold

The system SHALL only auto-persist TMDB matches that meet a minimum confidence threshold of 0.85 and have `vote_count >= 5` per DOC-8 §8.4.

#### Scenario: Auto-persist high-confidence match

- GIVEN a TMDB result with `matchConfidence: 0.92` and `vote_count: 1500`
- WHEN the enrichment completes
- THEN the item is marked `enrichment_status: 'enriched'`
- AND `tmdb_id`, `poster_path`, `backdrop_path`, `overview`, `year` are persisted

#### Scenario: Reject low-confidence match

- GIVEN a TMDB result with `matchConfidence: 0.60`
- WHEN the enrichment completes
- THEN the item remains `enrichment_status: 'pending'` for manual review
- AND the partial result is NOT persisted

#### Scenario: Reject low vote count

- GIVEN a TMDB result with `matchConfidence: 0.95` but `vote_count: 2`
- WHEN the enrichment completes
- THEN the item remains `enrichment_status: 'pending'`
- AND the result is NOT auto-persisted

### REQ-ENRICH-5: IndexedDB ContentEnrichment Table

The system SHALL store enrichment results in a separate IndexedDB table `ContentEnrichment` per DOC-8 §8.6, independent of the SQLite catalog.

#### Scenario: Enrichment record creation

- GIVEN a TMDB match for content with `content_id: "movie-123"`
- WHEN enrichment succeeds
- THEN a record is created in IndexedDB `ContentEnrichment` with `content_id` as PK
- AND `tmdb_id`, `poster_path`, `backdrop_path`, `overview`, `vote_average`, `match_confidence`, `fetched_at` are stored

#### Scenario: Query pending enrichments

- GIVEN mixed records with statuses `pending`, `enriched`, `not_found`, `error`
- WHEN the hydration worker queries for work
- THEN it filters by `enrichment_status IN ('pending', 'error') AND ttl_expires_at < now`
- AND only those items enter the queue

## Out of Scope

- OPFS image caching (DOC-8 §8.9 — deferred to later slice)
- Manual match review UI (future slice)
- Favorite-based prioritization queue (future optimization)
