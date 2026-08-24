# Spec: UI — Ingestion Screen (Screen 2)

## Purpose

Implement Screen 2 from the Stitch prototypes (`iptv-ui-prototypes.md`): a credentials setup screen where users enter Xtream Codes API credentials or an M3U URL, and a non-blocking progress overlay shows ingestion status. The user-facing outcome is a clear, professional onboarding flow where the user knows exactly what's happening during catalog ingestion.

## Requirements

### REQ-UI-INGEST-1: Credential Input Form

The system SHALL render a form accepting either Xtream Codes credentials (server URL, username, password, list name) or an M3U playlist URL/local file.

#### Scenario: Switch between Xtream and M3U tabs

- GIVEN the user is on the ingestion screen
- WHEN they click the "Xtream Codes API" tab
- THEN four input fields are displayed: Server URL, Username, Password, List Name
- WHEN they click the "M3U Playlist URL" tab
- THEN two options are displayed: URL input field and "Load Local File" button

#### Scenario: Input validation

- GIVEN the user enters an Xtream server URL without a protocol
- WHEN they click "Start Ingestion"
- THEN the form shows an inline validation error: "URL must start with http:// or https://"
- AND the ingestion does NOT start

#### Scenario: Password field masking

- GIVEN the user is on the Xtream credentials tab
- WHEN they type in the password field
- THEN the input type is `password` (masked characters)
- AND a toggle icon allows showing/hiding the password

### REQ-UI-INGEST-2: Ingestion Progress Overlay

The system SHALL display a non-blocking progress overlay during ingestion with real-time counts per content type per DOC-1 CU-02.

#### Scenario: Progress overlay appears

- GIVEN the user clicks "Start Ingestion" with valid credentials
- WHEN the ingest worker starts processing
- THEN a centered glassmorphic overlay appears with `backdrop-blur-lg`
- AND it shows: "Processing IPTV Playlist..." title
- AND a progress bar with percentage and step-by-step metrics

#### Scenario: Real-time count updates

- GIVEN the overlay is visible during ingestion
- WHEN the worker reports progress `{ live: 2500, movies: 4500, series: 800, total: 12000 }`
- THEN the overlay updates to show:
  - "Indexing Live TV: 2,500 / 8,000"
  - "Indexing Movies: 4,500 / 12,000"
  - "Indexing Series: 800 / 3,000"
- AND the progress bar animates to the correct percentage

#### Scenario: UI remains responsive during ingestion

- GIVEN the ingestion is processing 20,000 items
- WHEN the user tries to interact with the UI (e.g., switch tabs, scroll)
- THEN the UI responds within 50 ms (no main thread blocking)
- AND animations maintain ≥ 55 FPS

#### Scenario: Ingestion completion

- GIVEN the ingestion reaches 100%
- WHEN the worker emits the `complete` event
- THEN the overlay shows "Ingestion Complete!" for 2 seconds
- AND then transitions to the dashboard view (Screen 3)

#### Scenario: Ingestion error

- GIVEN the ingest worker encounters a fatal error
- WHEN it emits an `error` event
- THEN the overlay shows the error message in red
- AND a "Retry" button is displayed
- AND the user can return to the form to correct credentials

## Out of Scope

- Multi-source management (multiple playlists)
- Scheduled refresh / auto-sync UI
- Settings screen (Screen 8 — slice 5)
