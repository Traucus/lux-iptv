# Delta for desktop-shell

## MODIFIED Requirements

### Requirement: Preload Script Path

The Electron main process MUST load the preload script from `src/preload/index.ts` (compiled to `dist/preload/index.js`). The preload MUST be registered via `webPreferences.preload` in BrowserWindow creation.

(Previously: Preload path was misconfigured or missing.)

#### Scenario: Window created with correct preload

- GIVEN the app starts in production mode
- WHEN BrowserWindow is created
- THEN `webPreferences.preload` MUST resolve to the compiled preload at `dist/preload/index.js`

#### Scenario: Preload exposes window.luxAPI

- GIVEN the renderer page loads
- WHEN `window.luxAPI` is accessed
- THEN it MUST be a defined object with IPC channel methods

### Requirement: Renderer Loading

In development mode, the renderer MUST load from `http://localhost:5173`. In production, it MUST load from `dist/renderer/index.html` via `file://` protocol.

(Previously: Renderer load path was inconsistent between dev and prod.)

#### Scenario: Dev mode loads Vite dev server

- GIVEN `NODE_ENV=development`
- WHEN the window loads
- THEN the URL MUST be `http://localhost:5173`

#### Scenario: Prod mode loads local file

- GIVEN `NODE_ENV=production`
- WHEN the window loads
- THEN the URL MUST be `file://{path}/dist/renderer/index.html`

### Requirement: IPC Handler Registration

All IPC handlers MUST be registered at startup: ingest (m3u, xtream), tmdb (search, detail), enrichment (auto-enrich), and player (getSource, reportError, reportProgress, getNextEpisode).

(Previously: IPC handlers were fragmented or missing player channels.)

#### Scenario: All IPC channels respond

- GIVEN the app has started
- WHEN `ingest:m3u`, `tmdb:search`, `enrichment:auto`, `player:getSource` are invoked
- THEN each MUST return a response (not throw "no handler" error)

#### Scenario: Missing handler throws

- GIVEN the app has started
- WHEN an unregistered channel like `player:nonExistent` is invoked
- THEN it MUST throw or return an error indicating the channel is not registered

### Requirement: Hardware Acceleration Configuration

Hardware acceleration MUST be configurable. On Linux, it MUST be disabled by default. On Windows/macOS, it MUST be enabled by default. The setting MUST be overridable via environment variable or config.

(Previously: HW acceleration was not configurable per-platform.)

#### Scenario: Linux disables HW accel by default

- GIVEN the app runs on Linux with no override
- WHEN the app starts
- THEN `app.disableHardwareAcceleration()` MUST be called before `app.ready`

#### Scenario: Override enables HW accel on Linux

- GIVEN `LUX_HW_ACCEL=true` environment variable on Linux
- WHEN the app starts
- THEN hardware acceleration MUST remain enabled

### Requirement: Player IPC Channels

The preload MUST expose player IPC channels: `player:getSource`, `player:reportError`, `player:reportProgress`. Each MUST be callable from the renderer via `window.luxAPI`.

(Previously: Player IPC channels did not exist.)

#### Scenario: getSource returns stream URL

- GIVEN a valid catalog item ID
- WHEN `window.luxAPI.player.getSource(id)` is called
- THEN it MUST return the proxied stream URL

#### Scenario: reportError logs error

- GIVEN the player encounters an error
- WHEN `window.luxAPI.player.reportError({code, message})` is called
- THEN the main process MUST receive and log the error

### Requirement: getNextEpisode IPC Handler

The system MUST register a `player:getNextEpisode` IPC handler that, given a current episode ID, returns the next episode's metadata (or null if none exists).

(Previously: No next-episode IPC handler existed.)

#### Scenario: Next episode exists

- GIVEN series with episodes S01E01, S01E02
- WHEN `getNextEpisode(S01E01)` is called
- THEN it MUST return S01E02 metadata

#### Scenario: No next episode

- GIVEN the last episode in a series
- WHEN `getNextEpisode(lastEpisode)` is called
- THEN it MUST return null
