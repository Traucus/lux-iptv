# Spec: UI — Detail View (Screen 4)

## Purpose

Implement Screen 4 from the Stitch prototypes (`iptv-ui-prototypes.md`): a content detail view showing full metadata for a selected movie or series, including poster, synopsis, action buttons, and episode selector for series. The user-facing outcome is an immersive, information-rich detail screen comparable to Netflix/Apple TV detail views.

## Requirements

### REQ-UI-DETAIL-1: Movie Detail Layout

The system SHALL render a movie detail view with a two-panel layout: left panel with poster, right panel with metadata and action buttons.

#### Scenario: Movie detail with enriched data

- GIVEN the user navigates to a movie's detail view
- WHEN the page renders
- THEN the left panel shows a large vertical poster (`rounded-2xl`)
- AND the right panel shows: title (48px bold), year, genre, duration, synopsis (22px)
- AND action buttons "Play" and "Add to Favorites" are visible

#### Scenario: Movie detail without enriched data

- GIVEN the user navigates to a movie with no TMDB enrichment
- WHEN the page renders
- THEN the poster area shows a placeholder image
- AND the right panel shows the raw M3U name as title
- AND a subtle indicator "No enriched metadata available" is shown
- AND the "Play" button is still functional

### REQ-UI-DETAIL-2: Series Detail Layout

The system SHALL render a series detail view with episode selector organized by seasons.

#### Scenario: Series with multiple seasons

- GIVEN the user navigates to a series with 3 seasons and 24 episodes
- WHEN the page renders
- THEN the left panel shows the series poster
- AND the right panel shows series title, year, genre, and synopsis
- AND below the info, season tabs "Season 1", "Season 2", "Season 3" are visible
- AND selecting a season tab shows that season's episodes in a grid

#### Scenario: Episode card

- GIVEN a season's episodes are displayed
- WHEN an episode card renders
- THEN it shows: episode thumbnail, "Ep. N — Title" label
- AND if the episode has been watched, a checkmark icon is shown
- AND focused episodes scale to 1.05x with a blue border

### REQ-UI-DETAIL-3: Background Fanart

The system SHALL use the content's backdrop image as a blurred, dimmed full-screen background per the Screen 4 prototype.

#### Scenario: Fanart background with enriched content

- GIVEN the content has a `backdrop_path` from TMDB
- WHEN the detail view renders
- THEN the background is the backdrop image with `backdrop-blur-xl` and `bg-black/80` overlay
- AND the foreground panels are legible over the background

#### Scenario: Fallback background without fanart

- GIVEN the content has no backdrop image
- WHEN the detail view renders
- THEN a dark gradient background is used instead
- AND no broken image or loading error is visible

## Out of Scope

- Video playback (slice 2)
- Playback resume position display (slice 2)
- Parental control / category lock button (slice 4)
- "Next Episode" auto-play (slice 2)
