# Spec: Ingest

## Purpose

Enable background ingestion of Xtream Codes API and M3U/M3U8 playlists without blocking the renderer thread, implementing DOC-2 §2.1 and DOC-3 §3.1-3.2. The user-facing outcome is a non-blocking setup experience where the UI remains fluid (≥ 55 FPS) while thousands of channels, movies, and series are parsed and classified.

## Requirements

### REQ-INGEST-1: Xtream Codes API Ingestion

The system SHALL ingest content from an Xtream Codes API given server URL, username, and password, and classify items into live channels, VOD movies, and series without blocking the main thread.

#### Scenario: Successful Xtream ingestion

- GIVEN a valid Xtream Codes server URL, username, and password
- WHEN the user submits the credentials via the ingest UI
- THEN a Web Worker starts fetching `getLiveCategories`, `getVODCategories`, `getSeriesCategories`, and their respective item lists
- AND the renderer thread maintains ≥ 55 FPS throughout the process
- AND progress events are emitted every 500 ms with counts per category

#### Scenario: Invalid Xtream credentials

- GIVEN an Xtream server URL with invalid username or password
- WHEN the Web Worker attempts authentication via `player_api.php`
- THEN the worker emits an `auth_failed` error event within 10 seconds
- AND the UI displays a credential error message without crashing

#### Scenario: Xtream server unreachable

- GIVEN an Xtream server URL that does not respond
- WHEN the Web Worker attempts to connect
- THEN the worker times out after 15 seconds and emits a `connection_error` event
- AND the UI offers a retry option

### REQ-INGEST-2: M3U/M3U8 Playlist Ingestion

The system SHALL ingest content from a remote M3U URL or a local `.m3u`/`.m3u8` file, parsing entries with `iptv-m3u-playlist-parser` inside a Web Worker.

#### Scenario: Remote M3U URL ingestion

- GIVEN a valid HTTP/HTTPS URL pointing to an M3U playlist
- WHEN the user submits the URL
- THEN the Web Worker downloads the playlist in chunks
- AND parses entries using `iptv-m3u-playlist-parser`
- AND classifies each entry per DOC-3 §3.2 (6-stage heuristic)

#### Scenario: Local M3U file ingestion

- GIVEN a local `.m3u` or `.m3u8` file selected by the user
- WHEN the user initiates ingestion
- THEN the Web Worker reads the file via Electron's `fs` module in the main process
- AND streams content to the worker for parsing
- AND classification proceeds identically to remote ingestion

#### Scenario: Malformed M3U playlist

- GIVEN an M3U file with missing `#EXTINF` tags or invalid entries
- WHEN the Web Worker parses the file
- THEN valid entries are processed normally
- AND malformed entries are skipped and logged
- AND the ingestion completes without crashing

### REQ-INGEST-3: Content Classification Pipeline

The system SHALL classify each parsed entry into one of four types (`live`, `movie`, `series`, `radio`) using the 6-stage heuristic defined in DOC-3 §3.2.

#### Scenario: Classification by URL path

- GIVEN an entry with URL containing `/movie/`
- WHEN the classification pipeline runs
- THEN the entry is classified as `movie`

#### Scenario: Classification by group-title

- GIVEN an entry with `group-title="Series"` or `group-title="Diziler"`
- WHEN the classification pipeline runs
- THEN the entry is classified as `series`

#### Scenario: Classification fallback

- GIVEN an entry with no distinguishing signals from stages 1-5
- WHEN the classification pipeline completes
- THEN the entry defaults to `live`

### REQ-INGEST-4: Progress Reporting

The system SHALL emit progress events from the Web Worker to the renderer with real-time counts per content type during ingestion.

#### Scenario: Progress during bulk ingestion

- GIVEN an ingestion of 12,000 items is in progress
- WHEN the worker processes each batch of 100 items
- THEN it posts a message with `{ type: 'progress', live: N, movies: N, series: N, total: N }`
- AND the UI updates the progress bar without re-rendering the full component tree

#### Scenario: Completion event

- GIVEN all items have been parsed and classified
- WHEN the worker finishes processing
- THEN it emits a `complete` event with final counts
- AND the UI transitions to the dashboard view

## Out of Scope

- Video playback (slice 2)
- EPG parsing and linking (slice 3)
- Profile isolation (future slice)
- Scheduled refresh / auto-sync (open question #4 in proposal)
