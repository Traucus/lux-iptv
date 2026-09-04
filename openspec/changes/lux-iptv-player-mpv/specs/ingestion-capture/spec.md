# Delta for ingestion-capture

## ADDED Requirements

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
