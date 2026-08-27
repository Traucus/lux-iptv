# Exploration: Slice 2 — Video Player / OSD

Change: `lux-iptv-player`
Scope: hls.js engine + VideoPlayer organism + On-Screen Display (OSD) + network resilience.
Source-of-truth references: `Documentos/input_user/iptv-ai-dev-spec.md` (DOC-1 CU-04, DOC-4, DOC-5, DOC-7 TEST-02/04) and `iptv-ui-prototypes.md` (PANTALLA 5 OSD, PANTALLA 6 EPG).

---

## 1. Spec requirements for the video player

### DOC-5 — Playback engine & resilience (core)
- Engine: `hls.js` (stable/production). Must handle **HLS**, **MPEG-DASH**, and **HTTP TS**.
- hls config: `lowLatencyMode: true`, `backBufferLength: 30` (fast live zapping).
- Force GPU hardware decoding in the Electron **main process**.
- **Anti-freezing resilience loop**:
  - Monitor `Hls.Events.ERROR`; classify `NetworkErrors` vs `MediaErrors`.
  - Recoverable → `hls.recoverMediaError()`.
  - Fatal → up to **3 silent retries** with exponential backoff (**1s, 2s, 4s**).
  - During recovery show a discreet `Spinner` overlay; keep controls/navigation live.
  - After 3 failures → destroy instance, free resources, clean notify (verify connection / try another channel).

### DOC-1 CU-04 — OTT Player + OSD overlay
- OSD overlays with smooth transparent animation.
- Must include:
  - **Interactive progress bar** (VOD).
  - **Audio + subtitle** track selection (HLS/TS).
  - **Aspect ratio selector**: `16:9`, `4:3`, `Zoom`, `Fit` (Ajustar a Pantalla).
  - **"Next Episode"** button that auto-activates at **95%** of the current episode (series).
- **Constraint:** OSD auto-hides after **4 seconds** of physical-key/pointer inactivity.

### DOC-4 — 10-foot UI & focus
- Min body text 22px; titles 28–48px; +20–30% line-height.
- **Safe areas**: ≥5% margin (≥27px top/bottom, ≥48px left/right) for all critical UI.
- D-Pad focus via `react-tv-space-navigation` (already present; `Focusable` atom exists). Focus must be recoverable/redirected when overlay elements unmount.

### DOC-7 test targets directly relevant to Slice 2
- **TEST-02 (Zapping):** channel switch audio+video live in < **2.0s**.
- **TEST-04 (Resilience):** simulated network drop → up to 3 sequential silent retries w/ exp. backoff before error.
- **TEST-05 (D-Pad):** 100% of visible active elements reachable by cruceta.

### UI Prototype PANTALLA 5 (OSD layout) — the design target
- Full-screen video; OSD gradient `from-black/90 via-black/40 to-black/80`, `p-12`.
- **Top bar:** back arrow, title, brief resolution/active-track metadata.
- **Bottom:** full-width progress timeline (thumb + buffered/loaded region + `currentTime / duration` markers).
- **Control row (below timeline):** Rewind 10s · Play/Pause (large center) · FWD 10s · Audio/Subtitles · Aspect Ratio · Parental Lock.
- **Audio/Subtitle modal:** dual-column vertical lists (Audio: ES/EN/PT; Subs: Off/ES/EN).
- **Next Episode:** floating bottom-right card w/ 10s countdown + focused "Watch Now" (triggers at 95%).
- **D-Pad nav:** L/R move between buttons or seek when timeline focused; U/D switch between timeline, controls, floating menu. Auto-hide via `opacity-0` after 4s.

---

## 2. Current codebase state relevant to video

### What exists (Slice 1, 342 tests)
- **Data model:** every content row carries a stream `url`:
  - `LiveChannel`, `VodMovie`, `Series`, `Episode` (src/shared/types/catalog.ts), mirrored by `CatalogItem` (ipc.ts).
  - DB schema (src/main/db/schema.ts) stores `stream_type`, `tvg_id`, `tvg_logo`, `cover`, `year` for live/movie/series; episodes store `season`, `episode`, `url`.
- **Catalog access:** `catalog:getById` returns `CatalogItem | SeriesDetail`. `url` is present — this is the player input.
- **Trigger point:** `MovieDetail` and `SeriesDetailView` wire `onPlay={() => undefined}` — a **no-op stub**. This is exactly where Slice 2 hooks in.
- **Focus infra:** `react-tv-space-navigation` (DOM shim for Vite/browser e2e in `tv-space-nav-shim.ts`) + `Focusable` atom wrapping `SpatialNavigationFocusableView`. Ready for OSD controls.
- **Atom/molecule/organism library:** `Button`, `IconButton`, `Spinner`, `Badge`, `Focusable`, `ProgressBar` (visual-only, non-interactive). `DetailHeader`, `EpisodeGrid`, `SeasonTab`, `ChannelCard`.
- **IPC pattern:** preload exposes `luxAPI`; main `registerHandlers` wraps handlers w/ zod + `IpcResult`. Tested in browser via `page.addInitScript` mocking `window.luxAPI` (see tests/e2e/ingest-to-dashboard.spec.ts).
- **Test stack:** Vitest + happy-dom + Testing Library + msw; Playwright e2e against Vite dev server (browser, not Electron).

### What does NOT exist / gaps
- **No video infrastructure at all:** no hls.js, no player components, no `<video>` usage, no stream engine.
- **`CatalogItem` does NOT expose `streamType`** — the player must know live vs VOD (VOD = seek/resume; live = no seek + "LIVE"). DetailPage currently infers type from an id-range heuristic (id ≥ 1_000_000_000 → series). The player needs a reliable `type`/`streamType`.
- **No stream request headers** stored/exposed. DOC-3 `Entry.http` (userAgent/referer/cookie/headers) is parsed but **not persisted** and **not in CatalogItem**. Many real IPTV streams refuse playback without a proper User-Agent/Referer — a hard blocker for real-world playback.
- **No resume/continue-watching/history model:** no `playback_history` table, no `resume_position`, no `profiles` table. CU-01 (per-profile resume) and Screen-3 ("Continuar Viendo") are unmet.
- **No next-episode resolution:** SeriesDetail has ordered episodes per season, but no helper to find "next episode after current" across seasons.
- **App shell is a stub:** `src/main/index.ts` does NOT register IPC handlers (registerHandlers exists but is never called), does NOT set the preload path, does NOT load the renderer (dev server or built files), and has no hardware-acceleration config. The real Electron app is not runnable end-to-end yet — only the service layer is unit-tested. The player can still be developed/tested in the browser (Vite dev server + mocked `luxAPI` + stubbed streams), but running it in real Electron requires shell wiring.

---

## 3. Data flow: catalog item → player URL → stream → OSD

1. User clicks **Play** on `DetailPage` (movie / episode / series "Play").
2. `onPlay` navigates to a new route, e.g. `/watch/:type/:id`, carrying the `{ title, url, type, poster/backdrop }`.
3. `PlayerPage` resolves the content (re-uses `catalog:getById` or router state) and builds a `PlaybackSource = { id, title, url, kind: 'live'|'movie'|'episode', seriesContext? }`.
4. `media-engine.ts` picks the engine: `.m3u8` → **hls.js**; otherwise native `<video>` (mp4) — DASH/raw-TS deferred.
5. `hls-client.ts` loads the stream, wires the resilience loop, exposes track lists + events.
6. `VideoPlayer` renders `<video>`, manages playback state through `usePlayerState`, and layers the OSD.
7. OSD reads `hls`/`video` for progress, buffered ranges, duration, audio/subtitle tracks; writes via `video.currentTime`, `video.play/pause`, track switches, and CSS `object-fit`/transform for aspect ratio.
8. **Resume (VOD):** on `loadedmetadata`, read saved `position` from IndexedDB (`playback_positions` store) and `seekTo(position)`.
9. **Next episode (series):** at 95% duration, resolve next episode from `seriesContext.seasons` and surface the `NextEpisodeCard`.

No IPC needed for the core player (hls.js runs in the renderer). Optional IPC (main process) only for: (a) stream proxy to inject headers / bypass CORS, and (b) hardware-acceleration/config flags.

---

## 4. Proposed module architecture

```
src/shared/types/player.ts                        # PlaybackSource, TrackInfo, AspectRatioMode, PlaybackPosition
src/renderer/features/player/
  PlayerPage.tsx                                  # route /watch/:type/:id; resolves content; hosts VideoPlayer
  usePlayerState.ts                               # play/pause, currentTime, buffered, volume, tracks, aspect
  usePlaybackSource.ts                            # resolve + choose engine, error/recovery state
  next-episode.ts                                 # resolve next ep across seasons/current
  resume.ts                                       # read/write playback_position (IndexedDB, minimal)
src/renderer/services/
  media-engine.ts                                 # choose native vs hls based on url/extension
  hls-client.ts                                   # thin wrapper: config, error classify, recoverMediaError, retry backoff
src/renderer/components/organisms/
  VideoPlayer.tsx                                 # <video> + engine + OSD + focus root + auto-hide timer
src/renderer/components/molecules/osd/
  OsdTopBar.tsx                                   # back arrow + title + resolution/track metadata
  OsdProgressBar.tsx                              # interactive seek (VOD) + buffered region + time markers
  OsdControls.tsx                                 # rewind10 / play-pause / fwd10 / audio / aspect / lock
  TrackSelectorModal.tsx                          # dual-column audio+subtitle
  AspectRatioSelector.tsx                         # 16:9 / 4:3 / Fit / Zoom
  NextEpisodeCard.tsx                             # 10s countdown + Watch Now (95% trigger)
src/main/ipc/handlers/player.ts (optional)        # stream proxy (headers/CORS) if needed
```

Notes:
- Personal data flow: renderer-only. No new renderer persistence schema beyond a minimal `playback_positions` store (if resume is in scope) — full multi-profile deferred.
- Aspect ratio implemented by toggling a data attribute that swaps `object-fit`/transform classes on the `<video>` container.
- Error state surfaced to the user only after the 3rd silent retry fails.

---

## 5. Dependencies to add

| Package | Why | Priority |
|---|---|---|
| `hls.js` (^1.x) | Required engine for HLS/TS (packaged) streams | **Blocking** |
| `dash.js` or `shaka-player` | MPEG-DASH support (DOC-5) | Defer (Slice 3) |
| `mpegts.js` | Raw MPEG-TS over HTTP (not HLS-packaged) | Defer (Slice 3, decide on content) |

No new state-management lib needed — `usePlayerState` as a custom hook (or `useReducer`) suffices. `react-tv-space-navigation`, `react-query`, `zod`, `msw`, `@testing-library/react` already present.

Testing caveat: `happy-dom` does not fully implement `HTMLMediaElement` (play/pause/currentTime/loadedmetadata); hls.js and `<video>` will need mocked/stubbed harnesses in Vitest. e2e should stub `.m3u8` + segments with msw or a local fixture server.

---

## 6. Risks & unknowns

1. **App shell is a stub** (no preload, no IPC registration, no renderer loading, no HW-accel config). Slice 2 can build/test in browser e2e, but a real Electron run needs the shell — must be sequenced (either a slice-1.5 "app-shell wiring" task or included here) or the player is untestable in the packaged app.
2. **Missing stream headers (user-agent/referer/cookie).** DOC-3 parses `Entry.http` but it is not persisted or exposed. Real streams commonly 403 without them; hls.js supports `xhrSetup`, but the data must come from the catalog. Extend schema/payload OR add a main-process `net` proxy + custom `app://` protocol. **This is the biggest real-world playback blocker.**
3. **CORS in the renderer** for outbound stream fetches. Electron renderer will enforce CORS depending on `webSecurity`; options are a custom protocol/proxy (preferred) or relaxing security (avoid).
4. **DASH + raw TS coverage.** hls.js = HLS only. Spec demands DASH + TS. Decide per real content; recommend HLS-first MVP and defer DASH/TS engines.
5. **Resume / Continue-Watching / profiles** requires schema + data model not yet present; full CU-01 per-profile resume should be deferred, but a minimal IndexedDB position store could land in Slice 2 for VOD resume.
6. **Zapping <2s + "don't kill previous stream until new loads"** (CU-05/TEST-02) needs preloading/prebuffering of the next channel — a dedicated optimization; the Slice-2 baseline player may only partially satisfy TEST-02.
7. **Hardware acceleration** config lives in main process; currently unset. Low risk but requires main-process work to certify GPU decode.

---

## 7. Suggested slice boundary

### Include in Slice 2 (MVP)
- `hls.js` engine + **resilience loop** (classify errors → `recoverMediaError` → 3 silent retries with 1s/2s/4s backoff → spinner during recovery → destroy + clean notify). **TEST-04**.
- `VideoPlayer` organism + `PlayerPage` route wired from existing `onPlay` stubs (movie, episode, live channel).
- **OSD core:** top bar (back + title + metadata), interactive **progress bar** (VOD: seek + buffered + time markers), **control row** (rewind10 / play-pause / fwd10 / audio-subtitles / aspect / lock), **auto-hide after 4s**, **D-Pad focus** via existing `Focusable`. **TEST-05** partial.
- **Aspect ratio selector** (16:9, 4:3, Fit, Zoom) via container CSS.
- **Audio + subtitle track selection** from hls.js tracks (dual-column modal).
- **Next Episode** at 95% (series; single-to-cross-season resolution).
- **VOD resume** (minimal IndexedDB position store; no profiles) — surfaces Screen-3 "Continuar Viendo" partially.
- **Live TV basic playback** (no seek, "LIVE" badge).
- Tests: unit (player state hook, hls-client recovery with mocked hls.js, next-episode resolver, OSD components) + e2e (play → OSD appears; auto-hide).

### Defer to later slices
- **EPG grid + zapping mini-player overlay** + multi-channel prebuffer (CU-05 / PANTALLA 6).
- **Multi-profile + per-profile resume/history** (CU-01) — Slice 3.
- **MPEG-DASH** engine (dash.js/shaka) — Slice 3.
- **Raw MPEG-TS** engine (mpegts.js) — Slice 3 / content-dependent.
- **Parental-lock PIN overlay** in the player (pairs with parental-control slice).
- EPG-style PiP/mini-player resizing for Screen 6.
- OPFS video cache (spec scopes OPFS to image/EPG caches, not video). 
- TMDB-driven next-episode thumbnails + auto-advance polish.

---

## 8. Estimate

Single senior engineer, TDD, matching the existing component/quality bar:

| Work item | Days |
|---|---|
| hls.js engine + resilience loop | 1.0–1.5 |
| VideoPlayer organism + PlayerPage wiring | 1.0–2.0 |
| OSD (top bar, progress, controls, auto-hide, focus) | 2.0–3.0 |
| Aspect ratio + track selection + next-episode | 1.0–2.0 |
| VOD resume (IndexedDB) | 0.5 |
| Live basic + engine selection | 0.5 |
| Tests + fixtures (msw stream mocks, hls/video harnesses) | 1.5–2.0 |

**Total: ~6–9 days.** Adds ~1–2 days if the app-shell wiring (preload/IPC/renderer-load/HW-accel) must land in the same slice; deferring DASH/TS saves ~1–2 days.

---

## 9. Prerequisite-gap analysis (adversarial review resolution)

The Slice 2 proposal received an adversarial review with **7 CRITICAL** and **7 WARNING** findings to be closed before building the player. The baseline exploration above assumed the shell would be wired and headers persisted "somewhere"; this section verifies what actually blocks the player and groups the fixes.

### Verification of the 14 gaps (reconstructed from the review + code read)

**CRITICAL (blockers — player is unusable without these):**
1. **App shell is a stub** — `src/main/index.ts` sets no `preload`, does not `loadURL`/`loadFile`, never calls `registerHandlers`, and has no HW-accel config. The orphaned `src/main/ipc/handlers/*.ts` (real impls) are NOT wired — `src/main/ipc/index.ts` re-implements every channel with `notImplemented()`. AC1 (app launches) fails; a real Electron run is impossible.
2. **HTTP stream headers not captured or persisted** — `m3u-client.ts` `parseM3UText` drops `Entry.http` (M3UEntry lacks an `http` field); schema has no `http_headers` column; `CatalogItem` carries none. AC9 (header-proxy prevents 403) is impossible; real streams 403.
3. **streamType confusion / unreliable content type** — `CatalogItem` (the player input from `catalog:getById`) does NOT expose `streamType`, while native DTOs (`LiveChannel`/`VodMovie`/`Series`) do. `DetailPage` infers type from an ID heuristic (`id >= 1e9 → series`). The player cannot reliably distinguish live vs VOD vs movie vs series → breaks seek/LIVE badge/next-episode/engine choice (AC2, AC4, AC7).
4. **Play is unreachable** — `MovieDetail`/`SeriesDetail`/`DetailPage` wire `onPlay={() => undefined}`; `EpisodeGrid` exposes `onSelectEpisode` but `SeriesDetail` never passes it; no `/watch/:type/:id` route exists. Nothing routes into a player.
5. **CSP blocks media** — `src/renderer/index.html` CSP is `default-src 'self'` with no `media-src`/`blob:`/`connect-src`. hls.js segment/blob fetches (and a CDN-loaded hls.js) are blocked in a packaged/DV build. Blocks AC2.
6. **No hls.js dependency** — engine absent (AC2, AC3, AC5, AC7, AC10 all impossible).
7. **happy-dom lacks `HTMLMediaElement`** — no media test harness/mocks, so the engine resilience loop (TEST-04) and player state are untestable in unit tier.

**WARNING (quality/robustness — fix, not hard blockers):**
1. **BrowserRouter → HashRouter** — `App.tsx` uses `BrowserRouter`, which breaks under Electron `file://` prod load and deep links.
2. **`ProgressBar` is non-interactive** — visual-only; OSD needs an interactive seek bar (extend or add `SeekBar`, keep existing usages intact).
3. **Dead / unwired buttons** — Dashboard routes to `/settings` which is not registered; `onAddToFavorites` is a no-op stub that still renders the Favorites button.
4. **No episode context for next-episode / multi-play** — series `onPlay` takes no argument; resolved episode (season/episode/seriesId) is never passed, so `next-episode.ts` has no current-episode identity.
5. **Live TV path missing** — dashboard live carousel uses `ChannelCard` with no selection handler; no live (no-seek, "LIVE" badge) route.
6. **Stream-proxy / engine-selection architecture unresolved** — `net` proxy vs custom `app://` protocol is undecided, and DASH/TS de-scope must be explicit so reviewers don't count it missing.
7. **Handler reproducibility** — `registerHandlers` (ipc/index.ts) returns `notImplemented()` for every channel; the real `handlers/*.ts` are neither imported nor registered, so "add a player handler" has no correct place to go until the shell is wired and the real handlers are hooked.

### Grouped work units

| Group | Closes | Files changed | New files | Deps |
|---|---|---|---|---|
| **A — App Shell** | CRIT 1, 7(W) | `src/main/index.ts`, `src/preload/index.ts`(extend), `src/main/ipc/index.ts` | `src/main/ipc/handlers/player.ts` (stream proxy) | needs B (headers type) |
| **B — Schema + Data** | CRIT 2, 3 | `schema.ts`, migration SQL, `repo.ts`, `m3u-client.ts`, `xtream-client.ts`, `CatalogItem`/`ipc.ts` | `src/shared/types/player.ts` (`PlaybackSource`, `TrackInfo`, `AspectRatioMode`, `PlaybackPosition`) | none — foundational |
| **C — Play Integration** | CRIT 4, W4, W5 | `App.tsx`(routes), `DetailPage.tsx`, `MovieDetail.tsx`, `SeriesDetail.tsx`, `EpisodeGrid.tsx`, `DashboardPage.tsx` | `PlayerPage.tsx` skeleton | needs B (types), D (route target) |
| **D — Player Primitives** | CRIT 6, CRIT 7(test), W2, W6 | add `hls.js` dep; `ProgressBar.tsx` (or new `SeekBar`) | `hls-client.ts`, `media-engine.ts`, `VideoPlayer.tsx`, `osd/*` components, `usePlayerState.ts`, `usePlaybackSource.ts`, `next-episode.ts`, `resume.ts` | needs B (types), hls.js |
| **E — Quality** | CRIT 5, W1, W3 | `index.html`(CSP), `App.tsx`(HashRouter), route/dead-button cleanup | test harness: `tests/**/*-media*`, msw m3u8 fixture | cross-cutting |

### Dependency graph

```
B (contracts + data) ──► A (shell + proxy) ──► C (routes + wiring) ─┐
                        │                       (and D route target) │
                        └──────────────► D (player primitives) ──────┘
                                          E (CSP/HashRouter/harness/dead-buttons) → cross-cutting, mostly parallel
```

- **B is the dependency root** — defines `PlaybackSource`/headers/streamType that A, C, and D all consume. Do first.
- **A and D are independent of each other** — A is main-process (real Electron run + proxy), D is renderer (can be built against Vite + mocked `luxAPI`). Parallelizable.
- **C depends on both B and D** — routes target the PlayerPage (D) and consume the type (B). Do after B, and after D's route target exists (or define the route shell first).
- **E is cross-cutting** — the media test harness (CRIT 7) should land early (TDD); CSP/HashRouter/dead-buttons land as D/C land. Mostly parallel.

### Estimated effort (single senior dev, TDD)

| Work item | Days |
|---|---|
| B — contracts + http_headers migration + clients + streamType/type resolution | 1.0–2.0 |
| A — shell wiring + preload + real handler registration + HW-accel + stream proxy | 1.0–2.0 |
| E — media test harness (video/hls mocks + msw fixture) | 1.0–1.5 |
| D — hls.js engine + resilience + VideoPlayer + OSD + SeekBar + tracks/aspect/next-ep/resume | 5.0–7.0 |
| C — routes + onPlay + episode select + live path + dead-button cleanup | 0.5–1.0 |
| E — CSP + HashRouter + dead buttons | 0.5–1.0 |

**Prerequisite-gap closure alone (B + A + E-harness + C-additions): ~3.5–5.5 days.** Add the full player build (D + remaining E): total **~11–15 days** for the whole slice with all 14 findings resolved. Note overlap: hls.js dep + harness + SeekBar are shared with the build, so the totals are not strictly additive; the baseline 6–9-day estimate grows to ~11–15 days once headers/schema/proxy/CSP/HashRouter are included.

### Suggested execution order

1. **B** — define shared player contracts + persist http headers + expose streamType/reliable type (unblocks everything, cheap).
2. **A** — wire the shell (preload, renderer load, real handlers, HW-accel) + CSP allowance, so the app actually launches and the proxy has a home.
3. **E-harness** — media test harness (video/hls mocks + msw stream fixture) early so TDD is viable.
4. **D** — the player primitives (largest chunk; parallel with C's route shell).
5. **C** — wire routes + onPlay + episode select + live path + cleanup once D's PlayerPage exists.
6. **E sweep** — HashRouter + dead buttons + final CSP/verify.

**Ready for Proposal: Yes.** The orchestrator should split Slice 2 into the five groups above, sequence B → A → D → C, and expand the proposal's non-goals to explicitly de-scope DASH/TS (and note the proxy architecture decision: `net` proxy, not custom protocol).
