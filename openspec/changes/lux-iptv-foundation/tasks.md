# Tasks: Lux IPTV — Foundation + Player

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3,790 LOC total |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | 5 PRs (Wave 0 → Wave 1 → Wave 2 → Wave 3) |
| Delivery strategy | `ask-on-risk` |

Decision needed before apply: **Yes**
Chained PRs recommended: **Yes**
Chain strategy: **stacked-to-main**
400-line budget risk: **High**

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|---------------------|-----------------|-------------------|
| 1 | G1 Schema + G7 Harness | PR 1 | `vitest run --filter "migration\|media-mock"` | N/A (schema only) | DROP COLUMN via down migration |
| 2 | G2 Capture + G3 Shell | PR 2 | `vitest run --filter "m3u\|xtream\|ipc\|shell"` | N/A (main process) | Revert M3UEntry + IPC changes |
| 3 | G4 Renderer Quality | PR 3 | `vitest run --filter "routing\|csp"` | `npm run dev` for e2e | Revert HashRouter/CSP changes |
| 4 | G5 Stream Proxy | PR 4 | `vitest run --filter "stream-proxy\|proxy"` | `npm run dev` + real fetch | Delete stream-proxy.ts |
| 5 | G6 Player Core | PR 5 | `vitest run --filter "player\|hls\|seek\|osd"` | `npm run dev` + m3u8 fixture | Delete player feature dir |

---

## PR #1 — G1 Schema + G7 Harness (~560 LOC)

### Phase 1: G1 Schema & Migration

- [x] **TASK-001**: Add `httpHeaders` + `mediaFormat` columns to `liveChannels` Drizzle schema (`src/main/db/schema.ts`)
  - Type: `schema` | LOC: ~3 | Dependencies: —
  - Tests: None (schema only)

- [x] **TASK-002**: Add `httpHeaders` + `mediaFormat` columns to `vodMovies` Drizzle schema (`src/main/db/schema.ts`)
  - Type: `schema` | LOC: ~3 | Dependencies: TASK-001
  - Tests: None (schema only)

- [x] **TASK-003**: Add `httpHeaders` + `mediaFormat` columns to `series` Drizzle schema (`src/main/db/schema.ts`)
  - Type: `schema` | LOC: ~3 | Dependencies: TASK-002
  - Tests: None (schema only)

- [x] **TASK-004**: Add `httpHeaders` + `mediaFormat` columns to `episodes` Drizzle schema (`src/main/db/schema.ts`)
  - Type: `schema` | LOC: ~3 | Dependencies: TASK-003
  - Tests: None (schema only)

- [x] **TASK-005** *(RED → GREEN)*: Write `tests/integration/schema-columns.test.ts` asserting PRAGMA shows all 8 new columns across 4 tables
  - Type: `test` | LOC: ~40 | Dependencies: TASK-004
  - Tests: `vitest run tests/integration/schema-columns.test.ts`

- [x] **TASK-006**: Create `src/main/db/migrations/0001_add_http_headers_and_media_format.sql` with transactional up migration (BEGIN/COMMIT wrapping 8 ALTER TABLE ADD COLUMN statements)
  - Type: `setup` | LOC: ~30 | Dependencies: TASK-004
  - Tests: Covered by TASK-007 integration test

- [x] **TASK-007** *(RED → GREEN)*: Write `tests/integration/migration-atomicity.test.ts` — insert row pre-migration, assert `http_headers = '{}'` and `media_format = 'unknown'` post-migration
  - Type: `test` | LOC: ~60 | Dependencies: TASK-006
  - Tests: `vitest run tests/integration/migration-atomicity.test.ts`

- [x] **TASK-008**: Create `src/main/db/migrations/0001_add_http_headers_and_media_format_down.sql` with down migration (DROP COLUMN per table, wrapped in BEGIN/COMMIT)
  - Type: `setup` | LOC: ~30 | Dependencies: TASK-006
  - Tests: Manual only (destructive)

- [x] **TASK-009**: Update `src/main/db/migrate.ts` to wrap migration body in `db.transaction(() => { ... })()` and add `--down` CLI flag reading `*_down.sql`
  - Type: `logic` | LOC: ~25 | Dependencies: TASK-008
  - Tests: `vitest run tests/integration/migration-integration.test.ts`

- [x] **TASK-010**: Write `tests/integration/schema-version.test.ts` asserting `schema_version` increments correctly after new migration
  - Type: `test` | LOC: ~25 | Dependencies: TASK-009
  - Tests: `vitest run tests/integration/schema-version.test.ts`

- [x] **TASK-011** *(RED → GREEN)*: Write `tests/integration/down-migration.test.ts` — apply up, then `--down`, assert columns absent and row count unchanged
  - Type: `test` | LOC: ~50 | Dependencies: TASK-008
  - Tests: `vitest run tests/integration/down-migration.test.ts`

- [x] **TASK-012**: Document ADR-0001 (`docs/adr/ADR-0001-deferred-engines.md`) explaining DASH/TS engine deferral to Slice 3
  - Type: `docs` | LOC: ~50 | Dependencies: —
  - Tests: None (documentation)

### Phase 2: G7 Test Harness

- [x] **TASK-013**: Create `src/shared/types/player.ts` with `MediaFormat` enum (`'hls'|'mp4'|'dash'|'ts'|'unknown'`)
  - Type: `setup` | LOC: ~10 | Dependencies: —
  - Tests: None (type definition)

- [x] **TASK-014** *(RED → GREEN)*: Write `tests/helpers/media-mock.test.ts` validating `createMediaElementMock()`, `createHlsJsMock()`, `createMediaSourceMock()`
  - Type: `test` | LOC: ~80 | Dependencies: TASK-013
  - Tests: `vitest run tests/helpers/media-mock.test.ts`

- [x] **TASK-015**: Implement `tests/helpers/media-mock.ts` — `createMediaElementMock()`, `createHlsJsMock()`, `createMediaSourceMock()`, `createSourceBufferMock()`
  - Type: `component` | LOC: ~120 | Dependencies: TASK-014 (tests written first)
  - Tests: `vitest run tests/helpers/media-mock.test.ts`

- [x] **TASK-016** *(RED → GREEN)*: Write `tests/helpers/m3u8-fixture-server.test.ts` validating fixture server serves master + variant playlists + TS segments
  - Type: `test` | LOC: ~50 | Dependencies: TASK-015
  - Tests: `vitest run tests/helpers/m3u8-fixture-server.test.ts`

- [x] **TASK-017**: Implement `tests/helpers/m3u8-fixture-server.ts` — ephemeral HTTP server with `/test.m3u8`, `/media.m3u8`, `/segment{n}.ts` routes
  - Type: `component` | LOC: ~80 | Dependencies: TASK-016 (tests written first)
  - Tests: `vitest run tests/helpers/m3u8-fixture-server.test.ts`

- [x] **TASK-018** *(RED → GREEN)*: Write `tests/fixtures/playwright-fixtures.test.ts` validating `m3u8Server` fixture lifecycle (start/close)
  - Type: `test` | LOC: ~30 | Dependencies: TASK-017
  - Tests: `vitest run tests/fixtures/playwright-fixtures.test.ts`

- [x] **TASK-019**: Implement `tests/fixtures/playwright-fixtures.ts` — Playwright fixture extending `m3u8Server`
  - Type: `component` | LOC: ~25 | Dependencies: TASK-018 (tests written first)
  - Tests: `vitest run tests/fixtures/playwright-fixtures.test.ts`

- [x] **TASK-020**: Update `vitest.config.ts` with `environmentMatchGlobs` for `tests/unit/player/**` → `happy-dom`
  - Type: `setup` | LOC: ~15 | Dependencies: TASK-019
  - Tests: `vitest run tests/unit/seek-bar.test.ts` (later)

> **PR 1 actual LoC: ~1,699 (vs. 560 budget).** `size:exception` flagged — see `apply-progress.md` for the breakdown and rationale. The overrun is driven by strict-TDD test coverage (every behavior has multiple scenarios per the TDD module) and the migration runner rewrite (transactional wrapping + down-migration support).

---

## PR #2 — G2 Capture + G3 Shell (~560 LOC)

### Phase 3: G2 Header & Format Capture

- [x] **TASK-021**: Create `src/shared/schemas/player.ts` with Zod schemas for player IPC inputs (`PlayerGetSourceInput`, `PlayerReportErrorInput`, `PlayerReportProgressInput`, `PlayerGetNextEpisodeInput`, `PlayerGetProxiedUrlInput`)
  - Type: `setup` | LOC: ~40 | Dependencies: TASK-013 (from PR1)
  - Tests: None (schema only)

- [x] **TASK-022** *(RED → GREEN)*: Write `tests/unit/detect-media-format.test.ts` covering `.m3u8`→hls, `.mp4`→mp4, `.mpd`→dash, `.ts`→ts, unknown + query-string edge cases
  - Type: `test` | LOC: ~40 | Dependencies: TASK-021
  - Tests: `vitest run tests/unit/detect-media-format.test.ts`

- [x] **TASK-023**: Add `detectMediaFormat(url: string): MediaFormat` function to `src/main/services/m3u-client.ts`
  - Type: `logic` | LOC: ~15 | Dependencies: TASK-022 (tests written first)
  - Tests: `vitest run tests/unit/detect-media-format.test.ts`

- [x] **TASK-024** *(RED → GREEN)*: Write `tests/unit/m3u-entry-http.test.ts` with EXTVLCOPT fixture asserting `entry.http.userAgent/referer/cookie` forwarded from parser
  - Type: `test` | LOC: ~35 | Dependencies: TASK-023
  - Tests: `vitest run tests/unit/m3u-entry-http.test.ts`

- [x] **TASK-025**: Update `M3UEntry` interface in `src/main/services/m3u-client.ts` to add `http: {...}|null` and `mediaFormat: MediaFormat`
  - Type: `schema` | LOC: ~10 | Dependencies: TASK-024 (tests written first)
  - Tests: `vitest run tests/unit/m3u-entry-http.test.ts`

- [x] **TASK-026**: Update `parseM3UText()` in `src/main/services/m3u-client.ts` to forward `item.http` and call `detectMediaFormat(item.url)`
  - Type: `logic` | LOC: ~15 | Dependencies: TASK-025
  - Tests: `vitest run tests/unit/m3u-entry-http.test.ts`

- [x] **TASK-027**: Update `XtreamLiveStream`/`XtreamVodStream` interfaces + `getLiveStreams`/`getVODStreams` in `src/main/services/xtream-client.ts` to map `http_headers` (or `{}`) per stream
  - Type: `logic` | LOC: ~20 | Dependencies: TASK-026
  - Tests: `vitest run tests/unit/xtream-client.test.ts`

- [x] **TASK-028** *(RED → GREEN)*: Write `tests/integration/catalog-columns.test.ts` asserting `bulkInsertVodMovies` writes `http_headers` + `media_format` columns
  - Type: `test` | LOC: ~50 | Dependencies: TASK-027
  - Tests: `vitest run tests/integration/catalog-columns.test.ts`

- [x] **TASK-029**: Update `CatalogItem` type in `src/shared/types/ipc.ts` to add `content_type: 'live'|'movie'|'series'|'episode'`, `media_format: MediaFormat`, `http_headers: Record<string,string>`
  - Type: `schema` | LOC: ~10 | Dependencies: TASK-021
  - Tests: None (type only)

### Phase 4: G3 App Shell Wiring

- [x] **TASK-030**: Update `src/main/index.ts` — add `configureHwAccel()` (Linux: disable HW accel unless `LUX_HW_ACCEL=true`), configure preload path, add dev/prod renderer loading
  - Type: `wiring` | LOC: ~45 | Dependencies: —
  - Tests: TASK-031

- [x] **TASK-031** *(RED → GREEN)*: Write `tests/integration/shell-hw-accel.test.ts` asserting `app.disableHardwareAcceleration` is called on Linux when `LUX_HW_ACCEL` is not `true`
  - Type: `test` | LOC: ~40 | Dependencies: TASK-030 (test first)
  - Tests: `vitest run tests/integration/shell-hw-accel.test.ts`

- [x] **TASK-032**: Create `src/main/ipc/handlers/player.ts` — implement `player:getSource`, `player:reportError`, `player:reportProgress`, `player:getNextEpisode`, `player:getProxiedUrl` handlers (stubs returning notImplemented until G5/G6)
  - Type: `logic` | LOC: ~80 | Dependencies: TASK-021, TASK-029, TASK-030
  - Tests: TASK-033

- [x] **TASK-033** *(RED → GREEN)*: Write `tests/integration/ipc-player-channels.test.ts` asserting all 5 player IPC channels are registered
  - Type: `test` | LOC: ~35 | Dependencies: TASK-032 (test first)
  - Tests: `vitest run tests/integration/ipc-player-channels.test.ts`

- [x] **TASK-034**: Update `src/main/ipc/index.ts` — replace `notImplemented()` stubs, wire player handlers, consolidate handler registration
  - Type: `wiring` | LOC: ~30 | Dependencies: TASK-032, TASK-033
  - Tests: `vitest run tests/integration/ipc-handlers.test.ts`

- [x] **TASK-035**: Update `src/preload/index.ts` — add `player` group to `luxAPI` with all 5 channels, typed via shared schemas
  - Type: `wiring` | LOC: ~40 | Dependencies: TASK-021, TASK-032
  - Tests: `vitest run tests/integration/preload.test.ts`

---

## PR #3 — G4 Renderer Quality (~150 LOC)

### Phase 5: G4 Renderer Quality

- [ ] **TASK-036**: Update `src/renderer/App.tsx` — swap `BrowserRouter` → `HashRouter`, add `/watch/:type/:id` route with `PlayerPage` placeholder
  - Type: `wiring` | LOC: ~15 | Dependencies: TASK-034
  - Tests: TASK-037

- [ ] **TASK-037** *(RED → GREEN)*: Write `tests/e2e/routing.spec.ts` — navigate to `#/watch/movie/42`, assert placeholder renders with `type=movie, id=42`
  - Type: `e2e` | LOC: ~30 | Dependencies: TASK-036 (test first)
  - Tests: `npx playwright test tests/e2e/routing.spec.ts`

- [ ] **TASK-038**: Update `src/renderer/index.html` CSP — add `media-src 'self' blob:`, `connect-src 'self'`, `worker-src 'self' blob:`
  - Type: `component` | LOC: ~5 | Dependencies: —
  - Tests: TASK-039

- [ ] **TASK-039** *(RED → GREEN)*: Write `tests/unit/csp-policy.test.ts` — import CSP meta tag content, assert all required directives present
  - Type: `test` | LOC: ~30 | Dependencies: TASK-038 (test first)
  - Tests: `vitest run tests/unit/csp-policy.test.ts`

- [ ] **TASK-040**: Trim `NAV_ENTRIES` in `src/renderer/components/organisms/Sidebar.tsx` to: `home`, `live`, `movies`, `series`. Keep `favorites` only if IPC handler exists; remove `settings`, `search` buttons entirely
  - Type: `component` | LOC: ~15 | Dependencies: —
  - Tests: `vitest run tests/unit/sidebar.test.ts` (if exists) or manual

- [x] **TASK-041**: Wire `MovieDetail.onPlay` → `navigate('/watch/movie/' + item.id)`, `SeriesDetail.onPlay` → `navigate('/watch/series/' + item.seriesId)`, `EpisodeGrid.onSelectEpisode` → navigate to `/watch/episode/${ep.id}`, `ChannelCard.onSelect` → `navigate('/watch/live/' + ch.id)`
  - Type: `wiring` | LOC: ~40 | Dependencies: TASK-036
  - Tests: Covered by e2e routing test

---

## PR #4 — G5 Stream Proxy (~570 LOC)

### Phase 6: G5 Stream Proxy

- [x] **TASK-042** *(RED → GREEN)*: Write `tests/unit/stream-proxy.test.ts` — start service on ephemeral port, mock outbound `net.request`, assert header injection, cache hit/miss, TTL expiry, redirect-follow, timeout, error IPC
  - Type: `test` | LOC: ~180 | Dependencies: TASK-034, TASK-029
  - Tests: `vitest run tests/unit/stream-proxy.test.ts`

- [x] **TASK-043**: Implement `src/main/services/stream-proxy.ts` — `StreamProxyService` class with `start(db)`, `stop()`, `lookupHeaders()`, manifest cache (30s TTL, 50-entry LRU bound), `/proxy/:type/:id` and `/proxy/health` routes
  - Type: `logic` | LOC: ~200 | Dependencies: TASK-042 (tests written first)
  - Tests: `vitest run tests/unit/stream-proxy.test.ts`

- [x] **TASK-044** *(RED → GREEN)*: Write `tests/integration/proxy-e2e.test.ts` — spin up service, `http.get` to `/proxy/:type/:id`, validate response body matches mocked origin
  - Type: `e2e` | LOC: ~80 | Dependencies: TASK-043
  - Tests: `vitest run tests/integration/proxy-e2e.test.ts`

- [x] **TASK-045**: Wire `StreamProxyService` into main process startup in `src/main/index.ts` — start on app ready, stop on quit
  - Type: `wiring` | LOC: ~25 | Dependencies: TASK-043, TASK-044
  - Tests: Integration test covers it

- [x] **TASK-046** *(RED → GREEN)*: Write `tests/unit/proxy-header-whitelist.test.ts` asserting invalid header keys are rejected (security: header injection safety)
  - Type: `test` | LOC: ~40 | Dependencies: TASK-043
  - Tests: `vitest run tests/unit/proxy-header-whitelist.test.ts`

---

## PR #5 — G6 Player Core (~1,820 LOC)

### Phase 7: G6 Player Core — Infrastructure

- [x] **TASK-047**: Install `hls.js` npm package
  - Type: `setup` | LOC: ~1 | Dependencies: TASK-034
  - Tests: None

- [x] **TASK-048** *(RED → GREEN)*: Write `tests/unit/hls-client.test.ts` — mock hls.js, assert resilience loop: 1s/2s/4s backoff on NetworkError, 3 retries, `recoverMediaError()` on MediaError, emits `fatal` after exhausted retries
  - Type: `test` | LOC: ~120 | Dependencies: TASK-047
  - Tests: `vitest run tests/unit/hls-client.test.ts`

- [x] **TASK-049**: Implement `src/renderer/services/hls-client.ts` — `HlsClient` class wrapping hls.js, `load()`, `destroy()`, `on/off`, `audioTracks/subtitleTracks/levels` getters
  - Type: `component` | LOC: ~80 | Dependencies: TASK-048 (tests written first)
  - Tests: `vitest run tests/unit/hls-client.test.ts`

- [x] **TASK-050** *(RED → GREEN)*: Write `tests/unit/media-engine.test.ts` — engine selection: hls.js for HLS/DASH/TS/unknown, native for MP4; resilience loop test
  - Type: `test` | LOC: ~100 | Dependencies: TASK-049
  - Tests: `vitest run tests/unit/media-engine.test.ts`

- [x] **TASK-051**: Implement `src/renderer/services/media-engine.ts` — `MediaEngine` class with `EngineKind`, engine selection, resilience loop, event emitter
  - Type: `component` | LOC: ~100 | Dependencies: TASK-050 (tests written first)
  - Tests: `vitest run tests/unit/media-engine.test.ts`

- [x] **TASK-052** *(RED → GREEN)*: Write `tests/unit/next-episode.test.ts` — same-season next, cross-season next, last-episode returns null
  - Type: `test` | LOC: ~50 | Dependencies: TASK-029
  - Tests: `vitest run tests/unit/next-episode.test.ts`

- [x] **TASK-053**: Implement `src/renderer/features/player/next-episode.ts` — `resolveNextEpisode(current, seasons): Episode|null`
  - Type: `logic` | LOC: ~30 | Dependencies: TASK-052 (tests written first)
  - Tests: `vitest run tests/unit/next-episode.test.ts`

- [x] **TASK-054** *(RED → GREEN)*: Write `tests/unit/resume.test.ts` — IndexedDB via `fake-indexeddb`, getPosition/setPosition/clearPosition, throttled writes
  - Type: `test` | LOC: ~80 | Dependencies: TASK-013 (from PR1)
  - Tests: `vitest run tests/unit/resume.test.ts`

- [x] **TASK-055**: Implement `src/renderer/db/playback-resume.ts` — IndexedDB store using `idb`, `getPosition`, `setPosition`, `clearPosition`
  - Type: `component` | LOC: ~60 | Dependencies: TASK-054 (tests written first)
  - Tests: `vitest run tests/unit/resume.test.ts`

- [x] **TASK-056**: Implement `src/renderer/lib/fps-monitor.ts` — `requestAnimationFrame` loop, 60-frame rolling average, console.warn if avg < 55 for 2s
  - Type: `component` | LOC: ~30 | Dependencies: —
  - Tests: None (monitor only)

### Phase 8: G6 Player Core — UI Components

- [x] **TASK-057** *(RED → GREEN)*: Write `tests/unit/seek-bar.test.ts` — pointer drag on bar, RTL pointer events, D-Pad ±10s, accessibility `role="slider"`
  - Type: `test` | LOC: ~80 | Dependencies: TASK-015 (from PR1)
  - Tests: `vitest run tests/unit/seek-bar.test.ts`

- [x] **TASK-058**: Implement `src/renderer/components/molecules/osd/SeekBar.tsx` — pointer drag, D-Pad keys, buffer visualization, accessibility attributes
  - Type: `component` | LOC: ~90 | Dependencies: TASK-057 (tests written first)
  - Tests: `vitest run tests/unit/seek-bar.test.ts`

- [x] **TASK-059** *(RED → GREEN)*: Write `tests/unit/osd-auto-hide.test.ts` — fake timers, visibility flips after 4s inactivity, resets on mousemove/keydown/pointerdown/wheel
  - Type: `test` | LOC: ~50 | Dependencies: TASK-015 (from PR1)
  - Tests: `vitest run tests/unit/osd-auto-hide.test.ts`

- [x] **TASK-060**: Implement `src/renderer/hooks/useIdleOSD.ts` — `useIdleOSD(ms)` hook returning `{visible: boolean}`
  - Type: `component` | LOC: ~25 | Dependencies: TASK-059 (tests written first)
  - Tests: `vitest run tests/unit/osd-auto-hide.test.ts`

- [x] **TASK-061**: Implement `src/renderer/components/molecules/osd/OsdTopBar.tsx` — back arrow, title, resolution/audio badge
  - Type: `component` | LOC: ~40 | Dependencies: TASK-060
  - Tests: None (UI component)

- [x] **TASK-062**: Implement `src/renderer/components/molecules/osd/OsdControls.tsx` — rewind-10, play/pause, fwd-10, audio, subtitle, aspect buttons
  - Type: `component` | LOC: ~60 | Dependencies: TASK-061
  - Tests: None (UI component)

- [x] **TASK-063**: Implement `src/renderer/components/molecules/osd/TrackSelectorModal.tsx` — dual list (audio + subtitles)
  - Type: `component` | LOC: ~50 | Dependencies: TASK-062
  - Tests: None (UI component)

- [x] **TASK-064**: Implement `src/renderer/components/molecules/osd/AspectRatioSelector.tsx` — cycles `16:9 → 4:3 → Zoom → Fit` via `data-aspect`
  - Type: `component` | LOC: ~40 | Dependencies: TASK-062
  - Tests: None (UI component)

- [x] **TASK-065** *(RED → GREEN)*: Write `tests/unit/next-episode-card.test.ts` — 10s countdown, navigate on expiry, dismiss via ESC/Back
  - Type: `test` | LOC: ~50 | Dependencies: TASK-052, TASK-053
  - Tests: `vitest run tests/unit/next-episode-card.test.ts`

- [x] **TASK-066**: Implement `src/renderer/components/molecules/osd/NextEpisodeCard.tsx` — countdown, navigate on expiry, dismiss
  - Type: `component` | LOC: ~60 | Dependencies: TASK-065 (tests written first), TASK-053
  - Tests: `vitest run tests/unit/next-episode-card.test.ts`

- [x] **TASK-067** *(RED → GREEN)*: Write `tests/unit/video-player.test.ts` — mount, engine created/destroyed, spinner during recovering, error UI on fatal
  - Type: `test` | LOC: ~80 | Dependencies: TASK-051, TASK-060
  - Tests: `vitest run tests/unit/video-player.test.ts`

- [x] **TASK-068**: Implement `src/renderer/components/organisms/VideoPlayer.tsx` — full-bleed `<video>`, MediaEngine ref, OSD overlay, focus management, auto-hide timer
  - Type: `component` | LOC: ~120 | Dependencies: TASK-067 (tests written first), TASK-051, TASK-058, TASK-060, TASK-061, TASK-062, TASK-064, TASK-066
  - Tests: `vitest run tests/unit/video-player.test.ts`

- [x] **TASK-069** *(RED → GREEN)*: Write `tests/unit/player-page.test.ts` — kind='live' hides SeekBar + resume; kind='movie'/'episode' shows full OSD + resume; invalid type → Navigate to="/"
  - Type: `test` | LOC: ~70 | Dependencies: TASK-055, TASK-068
  - Tests: `vitest run tests/unit/player-page.test.ts`

- [x] **TASK-070**: Implement `src/renderer/features/player/PlayerPage.tsx` — URL params → catalog query → source resolution → VideoPlayer; live vs VOD branching; ResumeDialog
  - Type: `component` | LOC: ~100 | Dependencies: TASK-069 (tests written first), TASK-029, TASK-034, TASK-051, TASK-055, TASK-068
  - Tests: `vitest run tests/unit/player-page.test.ts`

- [x] **TASK-071** *(RED → GREEN)*: Write `tests/e2e/player-playback.spec.ts` — Playwright with m3u8Server fixture, assert `<video>` events fire
  - Type: `e2e` | LOC: ~60 | Dependencies: TASK-017 (from PR1), TASK-019 (from PR1), TASK-068, TASK-070
  - Tests: `npx playwright test tests/e2e/player-playback.spec.ts`

### Phase 9: G6 Player Core — IPC Wiring

- [x] **TASK-072**: Implement `player:getNextEpisode` IPC handler in `src/main/ipc/handlers/player.ts` — resolve from DB using `resolveNextEpisode` logic
  - Type: `logic` | LOC: ~40 | Dependencies: TASK-053, TASK-034
  - Tests: Covered by integration test

- [x] **TASK-073**: Implement `player:getProxiedUrl` IPC handler in `src/main/ipc/handlers/player.ts` — look up row, return `http://127.0.0.1:{port}/proxy/{type}/{id}`
  - Type: `logic` | LOC: ~30 | Dependencies: TASK-043, TASK-034
  - Tests: Covered by proxy integration test

- [x] **TASK-074**: Wire `player:reportProgress` + `player:reportError` in `src/main/ipc/handlers/player.ts` (logging only)
  - Type: `logic` | LOC: ~25 | Dependencies: TASK-034
  - Tests: None (logging only)

---

## Summary

| PR | Groups | Tasks | Est. LOC |
|----|--------|-------|----------|
| PR 1 | G1 + G7 | 20 | ~560 |
| PR 2 | G2 + G3 | 15 | ~560 |
| PR 3 | G4 | 6 | ~150 |
| PR 4 | G5 | 5 | ~570 |
| PR 5 | G6 | 28 | ~1,820 |
| **Total** | **G1–G7** | **74** | **~3,790** |

### Implementation Order
1. **PR 1 (G1 ∥ G7)**: Schema columns are the root dependency; harness enables TDD for all downstream player work
2. **PR 2 (G2 + G3)**: Types from G1 enable G2; G3 shell enables G4/G5 wiring
3. **PR 3 (G4)**: Independent of G2/G3 — can run parallel or immediately after
4. **PR 4 (G5)**: Depends on G1 schema + G2 types + G3 IPC; proxy port must be wired into main process
5. **PR 5 (G6)**: Terminal goal — depends on all above; hls.js engine + VideoPlayer + OSD require full stack

### Threat-Matrix RED Tests Summary

Every applicable threat-matrix case from the design has a corresponding RED test task:

| Case | RED Task | Expected Safe/Failure Behavior |
|------|----------|-------------------------------|
| Migration atomicity | TASK-007 | All 8 columns present after migration; rollback on any failure |
| Down migration | TASK-011 | Columns absent after --down; row count unchanged |
| M3U http forwarding | TASK-024 | entry.http.userAgent/referer/cookie captured from EXTVLCOPT |
| Media format detection | TASK-022 | .m3u8→hls, .mp4→mp4, .mpd→dash, .ts→ts, unknown→unknown |
| HW accel Linux | TASK-031 | disableHardwareAcceleration called unless LUX_HW_ACCEL=true |
| IPC player channels | TASK-033 | All 5 channels registered |
| CSP directives | TASK-039 | media-src/connect-src/worker-src present |
| Proxy header injection | TASK-042 | UA/referer/cookie forwarded; invalid keys rejected |
| Proxy cache TTL | TASK-042 | 30s TTL enforced; LRU eviction at 50 entries |
| Proxy timeout | TASK-042 | 10s timeout → 502; followRedirects up to 5 hops |
| hls.js resilience | TASK-048 | 1s/2s/4s backoff on NetworkError; 3 retries; fatal after exhausted |
| Resume persistence | TASK-054 | IndexedDB get/set/clear; throttled writes every 5s |
| SeekBar RTL | TASK-057 | pointer drag correct; D-Pad ±10s |
| OSD auto-hide | TASK-059 | 4s inactivity → hidden; any event → visible |
| Next-episode resolution | TASK-052 | same-season next, cross-season next, last→null |
| PlayerPage routing | TASK-069 | live hides SeekBar/resume; VOD shows full OSD; invalid→"/" |

### Key Learnings

1. SQLite `ALTER TABLE ADD COLUMN` is metadata-only — fast even on 100k-row tables, no data migration needed.
2. Drizzle `mode: 'json'` auto-serializes `http_headers` — use `$type<Record<string,string>>()` for IDE autocomplete.
3. hls.js `xhrSetup` degrades without proxy — proxy is the primary path; direct origin only for special cases.
4. Happy-dom unit tests sufficient for SeekBar/OSD logic; real Playwright e2e needed for actual video playback.
5. Stream proxy manifest cache TTL of 30s balances zapping performance against stale manifest risk.
