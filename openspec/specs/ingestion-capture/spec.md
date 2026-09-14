# Delta for ingestion-capture

## MODIFIED Requirements

### Requirement: M3U Parser Header Capture

The M3U parser MUST capture `Entry.http` fields (userAgent, referer, cookie, headers) from each playlist entry and include them in the parsed output.

(Previously: M3U parser ignored `Entry.http` fields entirely.)

#### Scenario: Entry with userAgent and referer

- GIVEN an M3U playlist entry with `#EXTVLCOPT:http-user-agent=CustomAgent` and `#EXTVLCOPT:http-referer=https://example.com`
- WHEN the M3U parser processes the entry
- THEN `Entry.http.userAgent` MUST equal 'CustomAgent'
- AND `Entry.http.referer` MUST equal 'https://example.com'

#### Scenario: Entry without http attributes

- GIVEN an M3U playlist entry with no `#EXTVLCOPT` http directives
- WHEN the M3U parser processes the entry
- THEN `Entry.http` MUST be undefined or empty

### Requirement: Xtream Client Header Capture

The Xtream client MUST capture stream headers returned by the Xtream API (user-agent, referer, cookies) and attach them to each stream item.

(Previously: Xtream client did not capture or forward stream headers.)

#### Scenario: API returns stream with headers

- GIVEN the Xtream API response includes `user_agent` and `referer` for a VOD stream
- WHEN the Xtream client processes the response
- THEN each stream item MUST include `http_headers` with those values

#### Scenario: API returns stream without headers

- GIVEN the Xtream API response omits header fields for a stream
- WHEN the Xtream client processes the response
- THEN `http_headers` MUST default to '{}'

### Requirement: HTTP Headers Persisted as JSON

During ingestion, `http_headers` MUST be serialized as JSON and persisted in the `http_headers` column of the corresponding catalog table.

(Previously: No header persistence existed.)

#### Scenario: Headers stored after M3U ingest

- GIVEN an M3U playlist with headers `{userAgent: "Agent1", referer: "https://x.com"}`
- WHEN ingestion completes
- THEN the catalog row's `http_headers` column MUST contain `{"userAgent":"Agent1","referer":"https://x.com"}`

#### Scenario: Empty headers stored as empty JSON

- GIVEN a stream entry with no headers
- WHEN ingestion completes
- THEN `http_headers` MUST be '{}'

### Requirement: Media Format Auto-Detection

The system MUST auto-detect `media_format` from the stream URL extension. Supported mappings: `.m3u8` → hls, `.mp4` → mp4, `.mpd` → dash, `.ts` → ts. Unrecognized extensions MUST default to 'unknown'.

(Previously: No format detection existed.)

#### Scenario: URL ends in .m3u8

- GIVEN a stream URL `https://cdn.example.com/live/ch1.m3u8`
- WHEN format detection runs
- THEN `media_format` MUST be 'hls'

#### Scenario: URL with query parameters

- GIVEN a stream URL `https://cdn.example.com/vod/movie.mp4?token=abc`
- WHEN format detection runs
- THEN `media_format` MUST be 'mp4'

#### Scenario: URL with no recognized extension

- GIVEN a stream URL `https://cdn.example.com/stream/12345`
- WHEN format detection runs
- THEN `media_format` MUST be 'unknown'

### Requirement: CatalogItem Exposes content_type and media_format

The `CatalogItem` DTO MUST expose `content_type` (live | movie | series | episode) derived from the source table, and `media_format` from the stored column.

(Previously: CatalogItem lacked these fields.)

#### Scenario: Movie item from ingestion

- GIVEN an ingested movie with URL `movie.mp4`
- WHEN mapped to CatalogItem
- THEN `content_type` MUST be 'movie' and `media_format` MUST be 'mp4'
### Requirement: Honest Stream URL Construction

Stream URLs MUST use `direct_source` when it is non-empty and usable; otherwise the real container extension. The system MUST NOT invent `.mp4`. Missing extension MUST stay extensionless. Live MUST keep `.m3u8` unless the panel or `direct_source` says otherwise.

#### Scenario: mkv URL ends with mkv

- GIVEN a movie or episode with `container_extension=mkv` and empty `direct_source`
- WHEN the play URL is built
- THEN the URL MUST end with `.mkv`

#### Scenario: direct_source wins

- GIVEN a non-empty usable `direct_source`
- WHEN the play URL is built
- THEN the URL MUST equal `direct_source`

#### Scenario: missing extension is not mp4

- GIVEN a VOD item with no container extension and no `direct_source`
- WHEN the play URL is built
- THEN the URL MUST NOT end with `.mp4`

### Requirement: No Fake Container Coercion

Ingestion MUST persist the real container extension. `media_format` MUST stay `unknown` for containers outside `hls|mp4|dash|ts`. mkv MUST NOT be stored as `mp4`.

#### Scenario: mkv stays unknown

- GIVEN an Xtream VOD with `container_extension=mkv`
- WHEN ingestion completes
- THEN `media_format` MUST be `unknown` and `container_extension` MUST be `mkv`
