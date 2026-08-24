# Spec: Degraded Mode

## Purpose

Ensure the application functions fully without a configured TMDB API key, displaying raw M3U/Xtream metadata with graceful visual fallbacks. The user-facing outcome is a complete, usable catalog experience even when TMDB enrichment is unavailable — quality decreases visually, but functionality never breaks.

## Requirements

### REQ-DEGRADED-1: Full Functionality Without TMDB

The system SHALL operate all core features (ingestion, catalog display, navigation, detail view) without a TMDB API key configured, per DOC-8 §8.8.

#### Scenario: App starts without TMDB key

- GIVEN no TMDB API key has been configured
- WHEN the user completes ingestion and navigates to the dashboard
- THEN all content types (live, movies, series) are displayed
- AND no TMDB API calls are made
- AND no errors appear in the console

#### Scenario: Detail view without enrichment

- GIVEN the user opens a detail view for content with no TMDB data
- WHEN the view renders
- THEN the raw content name from M3U is shown as the title
- AND the `group-title` is displayed as a pseudo-genre
- AND poster/backdrop areas show styled placeholders
- AND a discrete indicator "No enriched metadata available" is visible

### REQ-DEGRADED-2: Enrichment Pipeline Skip

The system SHALL skip enrichment pipeline phases 4-6 (preprocessing, TMDB search, hydration) when no API key is configured, per DOC-8 §8.8 rules.

#### Scenario: Enrichment skipped during ingestion

- GIVEN no TMDB API key exists in storage
- WHEN the ingestion worker completes parsing and classification
- THEN phases 4-6 of the enrichment pipeline are skipped
- AND all items are marked `enrichment_status: 'pending'` (not attempted)
- AND the ingestion completes without delay

#### Scenario: Enrichment not triggered by UI

- GIVEN the user browses the dashboard
- WHEN no TMDB key is configured
- THEN no background enrichment requests are queued or executed
- AND the application does not attempt to reach the TMDB API

### REQ-DEGRADED-3: Visual Placeholders

The system SHALL render styled visual placeholders in place of missing posters, backdrops, and metadata fields.

#### Scenario: Poster placeholder

- GIVEN a movie has no poster image (neither M3U `tvg-logo` nor TMDB `poster_path`)
- WHEN the movie card renders in a carousel
- THEN a styled placeholder with the content's first letter and a dark gradient background is shown
- AND no broken image icon or 404 error is visible

#### Scenario: Backdrop placeholder

- GIVEN a detail view has no backdrop image
- WHEN the page renders
- THEN a dark gradient background (`zinc-950` to `zinc-900`) is used
- AND the text content remains fully legible

#### Scenario: Missing metadata fields

- GIVEN a movie has no year, genre, or synopsis from the source
- WHEN the detail view renders
- THEN missing fields are simply omitted (not shown as "N/A" or "Unknown")
- AND the layout adjusts gracefully without empty gaps

## Out of Scope

- TMDB key entry UI (belongs in Settings screen, slice 5)
- Manual match review for low-confidence results (future slice)
- OPFS image cache management (future slice)
