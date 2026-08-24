# Spec: UI — Dashboard (Screen 3)

## Purpose

Implement Screen 3 from the Stitch prototypes (`iptv-ui-prototypes.md`): the home dashboard displaying ingested content in a Netflix-style layout with sidebar navigation, hero banner, and content carousels. The user-facing outcome is a visually rich, navigable catalog where users can browse live channels, movies, and series.

## Requirements

### REQ-UI-DASH-1: Sidebar Navigation

The system SHALL render a collapsible sidebar with navigation items for Search, Home, Live TV, Movies, Series, Favorites, and Settings.

#### Scenario: Sidebar renders with icons and labels

- GIVEN the user navigates to the dashboard after ingestion
- WHEN the dashboard renders
- THEN a left sidebar with 7 navigation items is visible
- AND each item has an icon and a text label
- AND the "Home" item is highlighted as the active section

#### Scenario: Sidebar focus state (10-Foot UI)

- GIVEN the user navigates with D-Pad / keyboard
- WHEN focus moves to a sidebar item
- THEN the item shows a translucent blue background with a 4px left border indicator
- AND the sidebar expands from 80px to 260px width

### REQ-UI-DASH-2: Hero Banner

The system SHALL display a hero banner at the top of the content area featuring a highlighted movie or series with fanart background, metadata, and action buttons.

#### Scenario: Hero banner with enriched content

- GIVEN at least one enriched movie exists in the catalog
- WHEN the dashboard renders
- THEN the hero section (top 45% of screen) shows a fanart background with gradient overlay
- AND the movie title, year, genre, and a short synopsis are displayed
- AND "Play" and "More Info" buttons are visible

#### Scenario: Hero banner without enriched content (degraded mode)

- GIVEN no TMDB enrichment is available
- WHEN the dashboard renders
- THEN the hero shows a fallback gradient background
- AND the content name (from M3U) is displayed
- AND "More Info" button is still functional

#### Scenario: Navigate to detail view

- GIVEN the user focuses on the "More Info" button in the hero
- WHEN they press Enter / click
- THEN the detail view (Screen 4) opens for the featured content

### REQ-UI-DASH-3: Content Carousels

The system SHALL render horizontal carousels of content organized by category: Continue Watching, Live Channels, Recent Movies, and Recent Series.

#### Scenario: Recent Movies carousel

- GIVEN enriched movies exist in the catalog
- WHEN the dashboard renders
- THEN a "Recent Movies" row displays vertical poster cards
- AND each card shows the poster image, title, and year
- AND focused cards scale to 1.05x with a glowing blue border

#### Scenario: Live Channels carousel

- GIVEN live channels exist in the catalog
- WHEN the dashboard renders
- THEN a "Live Channels" row displays cards with channel logos and names
- AND if EPG data is available, the current program name is shown
- AND cards are navigable with D-Pad left/right

#### Scenario: Empty carousel

- GIVEN no content of a particular type exists
- WHEN the dashboard renders
- THEN the empty carousel row is hidden (not shown with empty state)
- AND no errors are logged to the console

### REQ-UI-DASH-4: Virtualization and Performance

The system SHALL virtualize carousel rendering so that only visible cards are in the DOM, maintaining ≥ 55 FPS regardless of catalog size.

#### Scenario: Large catalog rendering

- GIVEN the catalog contains 10,000 movies
- WHEN the dashboard renders the "Recent Movies" carousel
- THEN only ~10 cards are in the DOM at any time
- AND horizontal scrolling loads cards lazily
- AND the frame rate stays ≥ 55 FPS

## Out of Scope

- EPG timeline overlay (slice 3)
- Video player overlay (slice 2)
- Favorites functionality (future slice)
- Search UI (Screen 7 — future slice)
