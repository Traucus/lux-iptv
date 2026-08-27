# Design: Lux IPTV — Foundation + Player

## 1. Architecture Overview

**Data flow (ingest → schema → proxy → player):**

```
M3U/Xtream API ──► Parser (capture http) ──► Drizzle INSERT
                                                     │
                                                     ▼
                          SQLite (http_headers + media_format)
                                                     │
                            player:getProxiedUrl    │
                                                     ▼
Electron main: net.request() ──► inject http_headers ──► origin
       │
       └──► http://127.0.0.1:{port}/proxy/{type}/{id} ──► renderer
                                                                │
                                                                ▼
                                     hls.js (renderer) ──► <video> ──► OSD
```

**Dependency graph (groups):**

| Group | Depends on | Provides |
|-------|-----------|----------|
| **G1** Schema | — | `http_headers`, `media_format` columns + transactional migration |
| **G2** Capture | G1 | `M3UEntry.http`, `Xtream.httpHeaders`, `media_format` detection |
| **G3** Shell | — | Working Electron app (preload, renderer load, IPC wiring, HW-accel) |
| **G4** Renderer Quality | — | HashRouter, CSP, dead-button removal, `/watch/:type/:id` placeholder |
| **G5** Stream Proxy | G1, G2 | Header-injecting `net` proxy + `player:getProxiedUrl` |
| **G6** Player Core | G1, G2, G3, G4, G5, G7 | hls.js engine, VideoPlayer, OSD, resume, next-episode |
| **G7** Test Harness | — | HTMLMediaElement + hls.js + MediaSource mocks; Playwright m3u8 fixture |

Wave order: **G1 ∥ G7 ∥ G3 ∥ G4** (parallel) → **G2** → **G5** → **G6**.

---

## 2. G1 — Schema & Migration Core

### Drizzle schema (`src/main/db/schema.ts`)

Add to `liveChannels`, `vodMovies`, `series`, `episodes` (Drizzle uses `text('http_headers', { mode: 'json' })` so it auto-serializes):

```ts
httpHeaders: text('http_headers', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
mediaFormat: text('media_format', { enum: ['hls','mp4','dash','ts','unknown'] }).notNull().default('unknown'),
```

### Migration SQL (`src/main/db/migrations/0001_*.sql`)

Wrapped in **one** transaction (SQLite supports DDL inside `BEGIN`):

```sql
BEGIN;
ALTER TABLE live_channels  ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE live_channels  ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE vod_movies    ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE vod_movies    ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE series        ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE series        ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE episodes      ADD COLUMN http_headers TEXT NOT NULL DEFAULT '{}';
ALTER TABLE episodes      ADD COLUMN media_format  TEXT NOT NULL DEFAULT 'unknown';
COMMIT;
```

### Migration runner (`src/main/db/migrate.ts`)

`migrate()` currently calls `db.exec()` once per file. Wrap the whole body in `db.transaction(() => { ... })()` so any failure rolls back the whole migration atomically (req: Migration Transactional Safety).

### Down migration (manual, sibling file `0001_*_down.sql`)

```sql
BEGIN;
ALTER TABLE live_channels DROP COLUMN http_headers;
ALTER TABLE live_channels DROP COLUMN media_format;
-- … repeat for vod_movies, series, episodes
COMMIT;
```

Add a `down:` CLI flag to `migrate.ts` reading `*_down.sql` by suffix. Default to up; require explicit `--down`.

### Tests

`tests/integration/migration-integration.test.ts`: extend with row-count assertions before/after migration; insert row pre-migration, query post-migration, assert `http_headers == '{}'` and `media_format == 'unknown'`. New `tests/integration/schema-columns.test.ts` for the 4-table PRAGMA check on each new column.

---

## 3. G2 — Header & Format Capture

### `M3UEntry` interface (`src/main/services/m3u-client.ts`)

```ts
export interface M3UEntry {
  name: string;
  url: string;
  groupTitle: string | null;
  tvgId: string | null;
  tvgLogo: string | null;
  http: { userAgent?: string; referer?: string; cookie?: string; headers?: Record<string,string> } | null;
  mediaFormat: 'hls'|'mp4'|'dash'|'ts'|'unknown';
}
```

The `iptv-m3u-playlist-parser` library exposes `Entry.http` already (since v0.3); we only need to **forward** it. In `parseM3UText`:

```ts
entries.push({
  ...existingFields,
  http: item.http ?? null,
  mediaFormat: detectMediaFormat(item.url),
});
```

### `detectMediaFormat(url: string): MediaFormat`

```ts
function detectMediaFormat(url: string): MediaFormat {
  const ext = new URL(url, 'http://x').pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
  switch (ext) {
    case '.m3u8': return 'hls';
    case '.mp4':  return 'mp4';
    case '.mpd':  return 'dash';
    case '.ts':   return 'ts';
    default:      return 'unknown';
  }
}
```

### Xtream client (`src/main/services/xtream-client.ts`)

Xtream responses carry `tmdb`/`http` fields. Update mapping to read `http_headers` (or fall back to `{}`) and `media_format = detectMediaFormat(stream.url)` per stream. The repo writes both into the row via the new columns.

### `CatalogItem` DTO (`src/shared/types/ipc.ts`)

Extend:
```ts
content_type: 'live' | 'movie' | 'series' | 'episode';
media_format: MediaFormat;
http_headers: Record<string, string>;
```
Enum kept in `src/shared/types/player.ts` (new file): `export type MediaFormat = 'hls'|'mp4'|'dash'|'ts'|'unknown';`.

### Tests

`tests/unit/m3u-client.test.ts`: add EXTVLCOPT fixture asserting `entry.http.userAgent`. New `tests/unit/detect-media-format.test.ts` covers the 4 extensions + query-string + unknown cases. Integration test in `tests/integration/repo.test.ts` asserting `bulkInsertVodMovies` writes the new columns.

---

## 4. G3 — App Shell Wiring

### `src/main/index.ts`

Replace the TODO comments with:

```ts
function configureHwAccel(): void {
  const override = process.env.LUX_HW_ACCEL?.toLowerCase();
  if (process.platform === 'linux' && override !== 'true') {
    app.disableHardwareAcceleration();
  }
}
configureHwAccel(); // BEFORE app.whenReady()

// inside createWindow():
webPreferences: {
  preload: path.join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
}

const isDev = process.env.NODE_ENV === 'development';
if (isDev) mainWindow.loadURL('http://localhost:5173');
else      mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
```

### IPC consolidation (`src/main/ipc/index.ts`)

Replace `notImplemented()` stubs with calls into `registerIngestHandlers`, `registerTmdbHandlers`, `registerEnrichmentHandlers`, plus new `registerPlayerHandlers`. Each receives `ctx` + its dependency (`IngestOrchestrator`, `TmdbKeyVault`, `StreamProxyService`). Pattern mirrors `handlers/tmdb.ts`.

### New IPC channels

| Channel | Direction | Purpose | REQ |
|---|---|---|---|
| `player:getSource` | R→M | `{ type, id }` → `{ proxiedUrl, originalUrl }` | desktop-shell §Player IPC |
| `player:reportError` | R→M | `{ code, message, ctx }` (logging only, no persistence in this slice) | desktop-shell §Player IPC |
| `player:reportProgress` | R→M | `{ type, id, position, duration }` — used by resume sync | player-core §VOD Resume |
| `player:getNextEpisode` | R→M | `{ episodeId }` → `Episode \| null` | desktop-shell §getNextEpisode |
| `player:getProxiedUrl` | R→M | `{ type, id }` → proxied URL | stream-proxy §player:getProxiedUrl |

### Preload (`src/preload/index.ts`)

Add a `player` group mirroring existing groups (typed via shared `LuxAPI` interface). Use zod schemas in `shared/schemas/player.ts` for each input.

### Tests

`tests/integration/ipc-handlers.test.ts`: extend expected-channels list to include the 5 player channels. Add a `tests/integration/shell-config.test.ts` asserting HW-accel flag flips with `LUX_HW_ACCEL` (mock `app.disableHardwareAcceleration`).

---

## 5. G4 — Renderer Quality

### HashRouter (`src/renderer/App.tsx`)

Single-line swap: `BrowserRouter` → `HashRouter`. Side-effect: deep links resolve from `file:///…/index.html#/watch/movie/42` — works under packaged Electron.

### CSP (`src/renderer/index.html`)

Replace meta with:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
               media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:;" />
```

### Dead buttons (`src/renderer/components/organisms/Sidebar.tsx`)

Trim `NAV_ENTRIES` to: `home`, `live`, `movies`, `series`. Keep `favorites` only if its IPC handler exists; otherwise hide. Settings/EPG removed entirely.

### Player route (`src/renderer/App.tsx`)

```tsx
<Route path="/watch/:type/:id" element={<PlayerPage />} />
```

PlayerPage reads `:type/:id` via `useParams`, validates `type ∈ {live|movie|series|episode}`, shows the real VideoPlayer (G6) on match, or `Navigate to="/"` on mismatch (handles the invalid-type case from renderer-quality §Player Placeholder Route).

### Detail wiring

`MovieDetail.onPlay` → `navigate('/watch/movie/' + item.id)`. `SeriesDetail.onPlay` → `navigate('/watch/series/' + item.seriesId)` (S01E01 default). `EpisodeGrid` exposes `onSelectEpisode(ep)`; pass from `SeriesDetailView` → navigate to `/watch/episode/${ep.id}`. `DashboardPage` live carousel wires `ChannelCard.onSelect(ch) → navigate('/watch/live/' + ch.id)`.

### Tests

`tests/e2e/routing.spec.ts` (new): navigate to `#/watch/movie/42`, assert placeholder renders with `type=movie, id=42`. CSP unit test via `tests/unit/csp-policy.test.ts` that imports the meta tag content and asserts directives.

---

## 6. G5 — Stream Proxy

### Architecture

Local HTTP server bound to `127.0.0.1` on an **ephemeral port** inside the Electron main process. Uses `net.createServer()` (Node) — not the Electron `net` module's `ClientRequest`, which is for outbound. The Electron `net` module is used for the **outbound fetch** (header injection, follows redirects up to 5 hops, 10s timeout).

### File layout

`src/main/services/stream-proxy.ts` — class `StreamProxyService`:
- `start(db): Promise<{ port: number }>` — binds, returns port.
- `stop()` — closes server.
- Header lookup: `lookupHeaders(type, id)` reads `http_headers` + `url` from SQLite via `createDb()`.
- Manifest cache: `Map<string, { body: Buffer; contentType: string; expiresAt: number }>` with 30s default TTL. Only `Content-Type` starting with `application/vnd.apple.mpegurl` or `application/x-mpegurl` is cached.

### Routes

| Path | Method | Behavior |
|---|---|---|
| `/proxy/:type/:id` | GET | Resolve row → fetch origin with injected headers → stream body |
| `/proxy/health` | GET | 200 `{ok:true}` for smoke tests |

### Pseudocode (request handling)

```ts
async function handleProxy(req, res, { type, id }) {
  const row = lookupHeaders(type, id);     // NOT_FOUND if missing
  const proxied = injectHeaders(row.url, row.http_headers, {
    followRedirects: 5, timeoutMs: 10000,
  });
  if (isManifest(proxied.contentType)) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return stream(res, cached);
  }
  proxied.pipe(res);
  if (isManifest(proxied.contentType)) cache.set(cacheKey, snapshot(proxied));
}
```

Concurrent segments: each request is an independent `net.request()`; no queue (Electron `net` is event-loop friendly).

### Error handling

- 5xx/timeout → 502 + `player:reportError` IPC with `{ code:'STREAM_TIMEOUT', message }`.
- Network unreachable → 503 + `player:reportError` `{ code:'NETWORK' }`.
- Manifest cache misses/expired handled silently (origin re-fetch).

### IPC interface

`player:getProxiedUrl` resolves `{type,id}` → row, returns `http://127.0.0.1:${port}/proxy/${type}/${id}`. Player renders `<video src={proxiedUrl}>`; hls.js fetches manifests/segments through the proxy transparently.

### Tests

- `tests/unit/stream-proxy.test.ts`: start service on ephemeral port, mock outbound `net.request`, assert header injection (UA/referer/cookie), cache hit/miss, TTL expiry, redirect-follow, timeout, error IPC.
- `tests/integration/proxy-e2e.test.ts`: spin up service, hit with `http.get`, validate response body matches mocked origin.

---

## 7. G6 — Player Core

### 7.1 hls.js integration (`src/renderer/services/hls-client.ts`)

Thin wrapper around `Hls` (dynamic import inside renderer). Constructor takes `{ src, videoEl, headers? }`. Exposes:

```ts
class HlsClient {
  load(): Promise<void>;                      // resolves on MANIFEST_PARSED
  destroy(): void;
  on(event, cb): () => void;
  audioTracks, subtitleTracks, levels;        // reactive mirrors
}
```

Wire `xhrSetup` to add `http_headers` from `CatalogItem` when calling origin **without** proxy (degraded path; proxy is the default).

### 7.2 `MediaEngine` class (`src/renderer/services/media-engine.ts`)

```ts
type EngineKind = 'hls' | 'native';
class MediaEngine {
  private kind: EngineKind;
  private hls?: HlsClient;
  constructor(video: HTMLVideoElement, source: PlaybackSource);
  load(): Promise<void>;
  destroy(): void;
  // event emitter: 'progress' | 'buffered' | 'error' | 'ended'
}
```

**Engine selection:** `mediaFormat === 'hls' || 'dash' || 'ts' || 'unknown' → hls.js`; `mediaFormat === 'mp4' → native <video>`. (DASH/TS over hls.js only works when packaged as HLS-fMP4; raw DASH deferred to Slice 3.)

**Resilience loop (player-core §hls.js Engine with Resilience):**

```
on ERROR:
  if error.fatal && NetworkError: backoff(1s, 2s, 4s), retry up to 3 times
  elif error.fatal && MediaError:  hls.recoverMediaError() (single attempt)
  else:                            fatal → emit 'fatal' → VideoPlayer shows error UI
```

Internal state machine tracks `attempt`, `nextDelay`, `destroyed`. Spinner overlay rendered via React `<Spinner>` (atom already exists) driven by `state === 'recovering'`.

### 7.3 `VideoPlayer` organism (`src/renderer/components/organisms/VideoPlayer.tsx`)

Props: `{ source: PlaybackSource; onEnded?; onError?; onTimeUpdate? }`.

Internal:
- `useRef<HTMLVideoElement>` — the element hls.js attaches to.
- `useRef<MediaEngine>` — engine instance; `useEffect` creates on mount, calls `engine.destroy()` on unmount.
- Renders `<video>` (full-bleed, `w-screen h-screen object-contain bg-black`), mounts OSD overlay.
- Focus root: wraps in `<Focusable>` parent or uses `tabIndex` for keyboard; D-Pad handled by react-tv-space-navigation inside OSD controls.
- Auto-hide timer: `useIdleOSD(4000)` hook.

### 7.4 `SeekBar` (`src/renderer/components/molecules/osd/SeekBar.tsx`)

- Pointer: `onPointerDown` captures pointer, computes `(e.clientX - rect.left) / rect.width * duration`, calls `video.currentTime = t`. Drag updates continuously; release commits.
- D-Pad: when focused, Left/Right → ±10s (configurable). `onKeyDown` handler.
- Buffer: derive `buffered` range covering `currentTime` (TimeRanges); render via `<div style={{width: bufferedEnd/duration*100%}}>`.
- Accessibility: `role="slider"`, `aria-valuenow`, `aria-valuemin/max`.

### 7.5 OSD (`src/renderer/components/molecules/osd/`)

Components:
- `OsdTopBar` — back arrow, title, resolution/audio-track badge.
- `OsdControls` — rewind-10, play/pause, fwd-10, audio, subtitle, aspect, **no parental lock** (req: Parental Lock Button Deferred).
- `TrackSelectorModal` — dual list (audio + subtitles).
- `AspectRatioSelector` — cycles `16:9 → 4:3 → Zoom → Fit` via `data-aspect` attribute on `<video>` wrapper; CSS swaps `object-fit` + transform.
- `NextEpisodeCard` — only mounted for `kind === 'episode'`; 10s countdown; triggers navigate on expiry or Watch Now; dismissed via ESC/Back.

**Auto-hide:** `useIdleOSD(ms)` listens for `mousemove`, `keydown`, `pointerdown`, `wheel` on `document`; resets a `setTimeout`; returns `{ visible: boolean }`. CSS transitions opacity 0→1 in 200ms.

### 7.6 Next-episode resolver (`src/renderer/features/player/next-episode.ts`)

Pure function: `resolveNextEpisode(current: Episode, seasons: Season[]): Episode | null`. Sort seasons by `seasonNumber`; build flat ordered list of episodes; find `current.id` index; return next or null. Used both in renderer (for the overlay) and exposed via IPC handler that runs the same logic against DB.

### 7.7 Resume store (`src/renderer/db/playback-resume.ts`)

Minimal IndexedDB store using `idb` (already a dep):

```ts
// Database: lux-playback; Store: positions (keyPath: 'id' = `${type}:${id}`)
interface StoredPosition { id: string; position: number; duration: number; updatedAt: number; }
```

API: `getPosition(type, id)`, `setPosition(type, id, pos, dur)`, `clearPosition(type, id)`. Write throttled to every 5s during playback + on pause/unmount. PlayerPage calls `getPosition` on mount; if exists, shows `ResumeDialog` ("Resume from MM:SS?"). On confirm → `video.currentTime = pos`.

### 7.8 Live vs VOD branching (`src/renderer/features/player/PlayerPage.tsx`)

`kind: 'live' | 'movie' | 'episode'`:
- **live**: hide `SeekBar`, no resume lookup, no `NextEpisodeCard`. Show red `LIVE` badge top-right.
- **movie/episode**: full OSD, resume, next-episode (episode only).

### 7.9 MP4 / MKV native fallback

`MediaEngine` for `mp4`: skip hls.js, set `video.src = proxiedUrl` directly. Same `usePlayerState` hook, same OSD. MKV: try native first; if `error.code === MEDIA_ERR_SRC_NOT_SUPPORTED`, fall back to hls.js demuxer (browser permitting) or surface error.

### 7.10 `PlayerPage` routing & data flow

```
URL: /watch/:type/:id
  → useParams → { type, id }
  → queryCatalogItem(type, id)           // reuse useContentById
  → resolveSource(item) → PlaybackSource
  → <VideoPlayer source=... />
```

`useQuery(['playback-source', type, id])` for caching; clears on unmount.

### 7.11 FPS monitor (`src/renderer/lib/fps-monitor.ts`)

`requestAnimationFrame` loop; rolling 60-frame average; if avg < 55 for 2s → `console.warn('[perf] FPS drop: ', avg)`. Mounted only during playback (controlled by prop on `VideoPlayer`).

### Tests

- `tests/unit/hls-client.test.ts` — uses mock hls.js; asserts resilience loop counts retries, applies 1s/2s/4s backoff, emits `fatal` after 3.
- `tests/unit/next-episode.test.ts` — same-season, cross-season, last-episode null.
- `tests/unit/resume.test.ts` — IndexedDB via `fake-indexeddb` (already a dep).
- `tests/unit/seek-bar.test.ts` — RTL pointer events on the bar.
- `tests/unit/osd-auto-hide.test.ts` — fake timers; assert visibility flips after 4s of inactivity and resets on event.
- `tests/e2e/player-playback.spec.ts` — Playwright fixture serves local `.m3u8` + segments; assert `<video>` events fire.

---

## 8. G7 — Media Test Harness

### `tests/helpers/media-mock.ts`

`createMediaElementMock()` returns a class extending a partial `HTMLMediaElement` shape:

```ts
class MockMediaElement {
  currentTime = 0;
  duration = 0;
  paused = true;
  buffered = makeTimeRanges([[0, 0]]);  // helper class with length/start/end
  play()  { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  seek(t) { this.currentTime = t; }
  load()  { /* dispatch 'loadedmetadata' */ }
  // event emitter: addEventListener/removeEventListener/dispatchEvent stub
}
```

`createHlsJsMock()` mirrors the real API: `loadSource` records URL + emits `MANIFEST_PARSED`; `attachMedia` stores videoEl; `on/off/destroy` work; exposes `levels/audioTracks/subtitleTracks` getters.

`createMediaSourceMock()` + `createSourceBufferMock()`: `MediaSource` tracks readyState, fires `sourceopen`; `SourceBuffer` accepts `appendBuffer(ArrayBuffer)`, tracks `buffered`.

### `tests/helpers/m3u8-fixture-server.ts`

Spin up an `http.createServer` listening on ephemeral port; routes:
- `GET /test.m3u8` → static master playlist text (3 variants).
- `GET /media.m3u8` → variant playlist.
- `GET /segment{n}.ts` → 188-byte PAT-PMT null packets (or `Buffer.alloc(188*N)`).
- Returns `{ url, close }` for test teardown.

Exposed as a Playwright fixture via `tests/fixtures/playwright-fixtures.ts` using `test.extend({ m3u8Server: async ({}, use) => { ... } })`.

### `vitest.config.ts` — per-file env

Already supports `environmentMatchGlobs` for pattern overrides. Add:

```ts
environmentMatchGlobs: [
  ['tests/unit/player/**', 'happy-dom'],
  ['src/renderer/features/player/**', 'happy-dom'],
],
```

Individual files can also opt-in via `// @vitest-environment happy-dom` docblock (verified by media-harness §Vitest Per-File Environment Override).

### Tests for harness itself

`tests/helpers/media-mock.test.ts` validates each mock matches the scenarios in media-harness spec (play resolves, seek updates, buffered shape, hls on/off/destroy, MediaSource.addSourceBuffer).

---

## 9. Key Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| **DASH/TS engines** | Deferred (Slice 3) | shaka-player, dash.js, mpegts.js | Content in scope is HLS-first; ADR-0001 documents deferral; raw DASH/TS in real IPTV is rare vs HLS-packaged. |
| **Router** | `HashRouter` | `BrowserRouter` (current), MemoryRouter | HashRouter works under `file://` packaged builds without server rewrites. |
| **Proxy architecture** | `net.createServer` + `net.request` | Custom `app://` protocol, `protocol.handle` | `net` is mature, easy to test, no protocol registration ceremony, headers easily injected. |
| **Resume storage** | IndexedDB (`idb`) | localStorage, SQLite-side column | Renderer-only path; keeps main process DB unchanged; supports multi-profile in Slice 5. |
| **Engine selection** | hls.js for HLS/DASH/TS/unknown; native for MP4 | shaka for everything | hls.js + native covers 95% of content; shaka bloat (500KB+) deferred. |
| **Header injection point** | Stream proxy (`net`) | hls.js `xhrSetup` only | Proxy works for native `<video>` too and centralizes CORS bypass. |
| **CSP** | Per-directive allowlist | `unsafe-inline`/`unsafe-eval` everywhere | Tighter security; hls.js doesn't need unsafe-eval. |
| **JSON columns** | Drizzle `mode: 'json'` | Raw TEXT | Auto-serialize + type-safe; `$type<Record<string,string>>()` for IDE help. |
| **Migration safety** | `BEGIN/COMMIT` per file | Drizzle-kit auto-generated | SQLite has limited DDL-in-transaction support; explicit, auditable. |

---

## 10. Performance

- **Proxy latency**: cache manifests at 30s TTL (covers zapping burst). Pipe `proxied.body` without buffering (`net.request().on('response', ...)` + `.pipe(res)`).
- **hls.js tuning**: `lowLatencyMode: true` + `backBufferLength: 30` (per DOC-5 from exploration). `maxBufferLength: 60`, `maxMaxBufferLength: 600`.
- **OSD render**: throttle `timeupdate` to 4Hz (`requestAnimationFrame`-debounced) to avoid React re-render storms; OSD uses CSS `opacity` transitions (GPU-composited) not `display:none`.
- **FPS target ≥55**: monitor via `fps-monitor.ts`; 2s consecutive drop → console.warn only (Slice 5+ could surface UI). Stress test: 1080p HLS, 5s window avg.
- **Manifest cache**: in-process `Map` keyed by `URL hash`; bounded to 50 entries (LRU eviction) to prevent memory growth on zapping.

---

## 11. Security

- **Header injection safety**: `http_headers` is a JSON object stored in our DB; not user-supplied at proxy request time. Whitelist keys in proxy: `userAgent → User-Agent`, `referer → Referer`, `cookie → Cookie`, plus passthrough for `headers.{name}` keys matched against `^[A-Za-z0-9-]+$`. Reject anything else.
- **CSP**: `default-src 'self'`; hls.js loaded from `self` (bundled); worker-src allows `blob:` for ingest worker (REQ-DEGRADED cross-cutting). No `'unsafe-eval'`.
- **Proxy access control**: bound to `127.0.0.1` only, not `0.0.0.0`. No external network reachability. Each request validates the URL exists in catalog DB before proxying.
- **CORS**: proxy is same-origin with renderer; no CORS dance needed for proxied streams.
- **Sandbox**: keep `webPreferences.sandbox: true`; IPC + preload bridge is the only render→main path.
- **Idempotent IPC**: `safeParse` + zod schemas (existing pattern) on every channel.

---

## 12. Migration Safety

- **Additive-only**: 2 new columns × 4 tables. No renames, no drops, no type changes. SQLite `ALTER TABLE ADD COLUMN` is metadata-only — fast even on 100k-row tables.
- **Defaults**: `http_headers DEFAULT '{}'`, `media_format DEFAULT 'unknown'`. Existing rows auto-populate; no data migration needed.
- **Atomic**: All 8 ALTER TABLE statements inside one `BEGIN/COMMIT` — if any fails, none take effect.
- **Backward compat**: schema v1 readers see the new columns but ignore them. Renderer code that doesn't reference `http_headers`/`media_format` keeps working.
- **Rollback**: manual down migration (`0001_*_down.sql`) drops columns. No data loss in the up direction; down direction is destructive (documented in proposal §Rollback Plan).
- **Versioning**: existing `loadMigrations` reads files sorted; new file becomes version 2. The `schema_version` row auto-records. Idempotency verified by integration test in `tests/integration/migration-integration.test.ts` (existing).

---

## Estimated LoC per Group

| Group | New | Modified | Test LoC | Total |
|---|---|---|---|---|
| G1 Schema | ~25 (SQL + Drizzle types) | 2 (schema.ts, migrate.ts) | ~150 | ~180 |
| G2 Capture | ~40 (detect + types) | 4 (m3u-client, xtream-client, repo, CatalogItem) | ~200 | ~290 |
| G3 Shell | ~120 (player handlers + types) | 3 (index.ts, ipc/index.ts, preload) | ~120 | ~270 |
| G4 Renderer | ~50 (PlayerPage placeholder, Sidebar trim) | 2 (App.tsx, index.html) | ~80 | ~150 |
| G5 Proxy | ~250 (stream-proxy.ts + manifest cache) | 1 (db access) | ~300 | ~570 |
| G6 Player | ~800 (hls-client, MediaEngine, VideoPlayer, OSD×6, SeekBar, resume, PlayerPage, next-episode, fps) | 2 (DashboardPage, DetailPage) | ~900 | ~1,820 |
| G7 Harness | ~350 (3 mocks + fixture server) | 1 (vitest.config) | ~150 | ~510 |
| **Total** | **~1,635** | **15 files** | **~1,900** | **~3,790** |

G6 is the largest; expect 5–7 days for a single senior dev TDD per the exploration estimate (~11–15 days for the whole slice including prerequisite-gap closure). All G6 work is renderer-side and unblocks on G1/G2/G3/G4/G5 landing as types.
