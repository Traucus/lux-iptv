# Delta for renderer-quality

## MODIFIED Requirements

### Requirement: HashRouter for Electron

The React application MUST use `HashRouter` instead of `BrowserRouter`. This ensures routing works on `file://` protocol in production Electron builds.

(Previously: BrowserRouter was used, which fails on `file://`.)

#### Scenario: Direct navigation to deep route

- GIVEN the app is running in production (file:// protocol)
- WHEN the user navigates to `/watch/movie/123`
- THEN the URL MUST be `file://...#/watch/movie/123` and the route MUST render correctly

#### Scenario: Page refresh preserves route

- GIVEN the user is on `#/watch/movie/123`
- WHEN the page is refreshed
- THEN the same route MUST render (not a 404)

### Requirement: CSP media-src

The Content-Security-Policy MUST include `media-src 'self' blob:` to allow local and blob URL media playback.

(Previously: CSP did not include media-src directive.)

#### Scenario: Video plays from blob URL

- GIVEN a video element with `src="blob:..."`
- WHEN the video attempts to load
- THEN the browser MUST NOT block it (CSP allows blob: for media-src)

#### Scenario: Video plays from self origin

- GIVEN a video element with `src` pointing to the local proxy
- WHEN the video attempts to load
- THEN the browser MUST NOT block it

### Requirement: CSP connect-src

The CSP MUST include `connect-src 'self'` to allow API connections to the local backend/proxy.

(Previously: connect-src was missing or too restrictive.)

#### Scenario: Fetch to local proxy succeeds

- GIVEN the renderer makes a fetch to the stream proxy URL
- WHEN the request is sent
- THEN CSP MUST allow it (connect-src 'self')

### Requirement: CSP worker-src

The CSP MUST include `worker-src 'self' blob:` to allow Web Workers and service workers.

(Previously: worker-src was missing, blocking ingestion workers.)

#### Scenario: Ingestion worker loads

- GIVEN the ingestion pipeline creates a Web Worker from a blob URL
- WHEN the worker initializes
- THEN CSP MUST allow it (worker-src 'self' blob:)

### Requirement: Dead Sidebar Buttons Hidden

Sidebar navigation buttons for features not yet implemented (Settings, Parental Control, EPG) MUST be hidden or removed from the sidebar until their respective slices.

(Previously: Dead buttons were visible but non-functional, confusing users.)

#### Scenario: Settings button not visible

- GIVEN the app is running with foundation features only
- WHEN the sidebar renders
- THEN the Settings button MUST NOT be visible

#### Scenario: Implemented buttons remain visible

- GIVEN Live TV, Movies, Series are implemented
- WHEN the sidebar renders
- THEN those navigation items MUST be visible and functional

### Requirement: Player Placeholder Route

`/watch/:type/:id` MUST always mount `PlayerPage` (D-1). It MUST NOT render `PlayerPlaceholder`.

(Previously: type/id placeholder.)

#### Scenario: App mounts PlayerPage

- GIVEN the app is rendered
- WHEN location is `/watch/movie/42`
- THEN `PlayerPage` MUST render and `PlayerPlaceholder` MUST NOT

#### Scenario: Invalid type parameter

- GIVEN the /watch route exists
- WHEN location is `/watch/invalid/42`
- THEN it MUST 404 or redirect
