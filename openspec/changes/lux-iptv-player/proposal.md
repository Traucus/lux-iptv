# Proposal: Lux IPTV Slice 2 — Video Player + App Shell + OSD

## Why

The app ingests and enriches content (Slice 1, 342 tests passing) but **cannot play a single stream**. The video player is the core value proposition — without it, Lux IPTV is a catalog viewer. Slice 2 closes this gap: wire the Electron app shell so the app actually launches, integrate hls.js for HLS playback, build the OSD overlay per PANTALLA 5, and add VOD resume. References: DOC-1 CU-04, DOC-4, DOC-5, DOC-7 TEST-02/04/05.

## What Changes

| Deliverable | Description |
|---|---|
| **App shell wiring** | Main process: register IPC handlers, set preload path, load renderer (dev/prod), enable HW acceleration, configure BrowserWindow |
| **hls.js engine** | `hls-client.ts` wrapper: config (`lowLatencyMode`, `backBufferLength: 30`), error classification, `recoverMediaError`, 3 silent retries (1s/2s/4s backoff), spinner during recovery, destroy after 3 failures |
| **VideoPlayer organism** | `<video>` element + engine lifecycle + OSD layer + focus root + auto-hide timer |
| **OSD overlay** | Top bar (back + title + metadata), interactive progress bar (VOD seek + buffered + time markers), control row (rewind 10s / play-pause / fwd 10s / audio-subs / aspect / lock), auto-hide after 4s inactivity, D-Pad navigation via `Focusable` |
| **Track selection** | Audio + subtitle track lists from hls.js, dual-column modal (PANTALLA 5 layout) |
| **Aspect ratio** | Selector: 16:9, 4:3, Zoom, Fit — via CSS `object-fit`/transform on video container |
| **Next Episode** | Overlay at 95% completion (series only), 10s countdown + "Watch Now" button, cross-season resolution |
| **Stream proxy** | Main process proxy injecting user-agent/referer headers before passing stream to renderer (prevents 403) |
| **VOD resume** | IndexedDB `playback_positions` store: save on pause/exit, restore on load (no per-profile isolation yet) |
| **IPC bridge** | Preload `luxAPI` extensions for player commands (proxy control, HW-accel config) |

## Impact

| Area | Impact | Description |
|---|---|---|
| `src/main/index.ts` | Modified | Wire IPC registration, preload, renderer load, HW-accel |
| `src/main/preload.ts` | Modified | Extend `luxAPI` with player-related IPC methods |
| `src/main/ipc/handlers/` | New | `player.ts` — stream proxy handler |
| `src/renderer/features/player/` | New | `PlayerPage`, `usePlayerState`, `usePlaybackSource`, `next-episode.ts`, `resume.ts` |
| `src/renderer/services/` | New | `media-engine.ts`, `hls-client.ts` |
| `src/renderer/components/organisms/` | New | `VideoPlayer.tsx` |
| `src/renderer/components/molecules/osd/` | New | 6 OSD sub-components |
| `src/shared/types/player.ts` | New | `PlaybackSource`, `TrackInfo`, `AspectRatioMode`, `PlaybackPosition` |
| `src/shared/types/catalog.ts` | Modified | Expose `streamType` on `CatalogItem` |
| `src/main/db/schema.ts` | Modified | Persist `http_headers` from `Entry.http` (DOC-3) |

## Non-goals

- MPEG-DASH engine (dash.js/shaka) — Slice 3
- Raw MPEG-TS engine (mpegts.js) — Slice 3
- EPG grid + zapping mini-player — Slice 3
- Multi-profile + per-profile resume/history (CU-01) — Slice 3
- Parental-lock PIN overlay in player — Slice 4
- OPFS video cache — deferred indefinitely
- TMDB-driven next-episode thumbnails — polish pass later

## Acceptance Criteria

- [ ] **AC1:** App launches as Electron desktop app (window opens, renderer loads)
- [ ] **AC2:** HLS stream plays without blocking renderer
- [ ] **AC3:** OSD appears on play, auto-hides after 4s inactivity
- [ ] **AC4:** Progress bar is interactive for VOD (seek works)
- [ ] **AC5:** Audio/subtitle track selection works
- [ ] **AC6:** Aspect ratio selector (16:9, 4:3, Zoom, Fit) works
- [ ] **AC7:** Next Episode overlay appears at 95% with 10s countdown
- [ ] **AC8:** VOD resume from last saved position
- [ ] **AC9:** Stream headers proxy prevents 403 on protected streams
- [ ] **AC10:** Error recovery — reconnection on network failure (3 silent retries, then user notification)
- [ ] **AC11:** 55 FPS maintained during playback (HW-accel enabled)
- [ ] **AC12:** App works in degraded mode (no TMDB metadata, player still functions)

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stream headers not persisted in Slice 1 schema | High | Extend schema to store `Entry.http` fields; proxy in main process |
| `happy-dom` lacks `HTMLMediaElement` for unit tests | High | Mock/stub hls.js + `<video>` in Vitest; use Playwright for integration |
| CORS blocks renderer stream fetches | Medium | Main-process proxy via `net` module or custom `app://` protocol |
| hls.js resilience not covering all error types | Medium | Strict error classification (Network vs Media); fallback to destroy + notify |
| HW-accel config platform-dependent | Low | Test on Linux/Windows; document known GPU limitations |

## Dependencies

- **Slice 1 complete** — catalog DB, IPC bridge, UI atoms/molecules, focus infrastructure
- **`hls.js` ^1.x** — new dependency (blocking)
- **Existing:** `react-tv-space-navigation`, `Focusable`, `ProgressBar`, `Spinner`, `Button`, `IconButton`

## Open Questions

1. **Stream header persistence:** Should `Entry.http` fields (userAgent, referer, cookie, headers) be stored in the catalog DB schema, or fetched on-demand from the original playlist? → *Decision: persist in schema for reliability.*
2. **Proxy approach:** Use Electron `net` module proxy or custom `app://` protocol for header injection? → *Decision: `net` proxy (simpler, no protocol registration).*
3. **Resume scope:** Single global position per content ID, or prepare for per-profile from the start? → *Decision: global for now; per-profile deferred to Slice 3.*

## Rollback Plan

Slice 2 is additive — no existing functionality is removed. Rollback = revert the player feature branch. The app returns to Slice 1 state (catalog viewer, no playback). No data migration needed.

## Success Criteria

- All 12 acceptance criteria pass (AC1–AC12)
- Unit test coverage ≥ 80% for new player modules
- E2E tests cover: play → OSD appears → auto-hide → seek → track switch → next episode
- No regression in Slice 1 tests (342 tests still pass)
