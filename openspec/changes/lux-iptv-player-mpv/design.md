# Design: F2 Windows in-process libmpv player

## Technical Approach

In-process libmpv in the existing Lux `BrowserWindow` is the only happy path. Main loads catalog origin URL + `http_headers`. Slice 1: honest URLs + mkv play. Slice 2: live/movie/episode. Slice 3: tracks/FS/OSD. Specs: `player-core`, `catalog-schema`, `ingestion-capture`, `desktop-shell`. Lessons #711/#710: preload stays CJS. No SPEC-HEALTH/`docs/planning` in product PRs. Chromium `hls.js` / mpegts / `<video>` are not fallbacks.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|---|---|---|---|
| Engine | N-API in main; spawn `mpv.exe`; Chromium `--wid` | Spawn/--wid rejected D-14; Electron 33 ABI | N-API `lux-libmpv.node` via `@electron/rebuild` (Electron `^33.4.11`) |
| ABI fallback | Rebuild; in-process FFI to `libmpv-2.dll`; spawn | Spawn is not product | Rebuild first; else same-process FFI. Never `spawn('mpv.exe')` |
| HWND | Lux child HWND; webContents `--wid` | `--wid` flaky on Electron 33 | `mpv_set_option("wid")` on child HWND parented to `getNativeWindowHandle()` |
| URL | Honest builder; fake `.mp4`; proxy `src` | Proxy is not happy path | Usable http(s) `direct_source` wins; else real ext; missing ext stays bare; live `.m3u8` |
| Play IPC | Main origin play; renderer `getProxiedUrl` | Keep channel for non-happy-path | `player:play` in main; `getSource` metadata only |
| Overlay | React OSD later; mpv OSD | Spec wants React chrome | Slice 1 diagnosis overlay. Slice 3 React OSD + `setFullScreen` |

## Data Flow

    PlayerPage ── luxAPI.player.play ──► preload CJS ──IPC──► player.ts
         │                                                    │
         │                                         catalog origin + headers
         ▼                                                    ▼
    VideoPlayer host ◄── events/diagnosis ── LibmpvEngine ── libmpv-2.dll
                         (one process, one window, child HWND)

Ingest: Xtream/M3U → honest `buildStreamUrl` → persist `container_extension` + `direct_source` → origin `url`. Live: `cache=yes`, `cache-secs=20`, reconnect, `hwdec=auto-safe`. VOD: origin quality. DLL: `LUX_LIBMPV_DIR` (dev); F7 bundles.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/main/db/migrations/0003_add_container_extension_and_direct_source.sql` | Create | ADD both TEXT DEFAULT '' on 4 tables |
| `src/main/db/migrations/0003_add_container_extension_and_direct_source_down.sql` | Create | DROP only those two columns |
| `src/main/player/libmpv-engine.ts` | Create | load/play/stop/diagnose |
| `src/main/player/libmpv-binding.ts` | Create | N-API or in-process FFI |
| `src/main/services/xtream-client.ts` | Modify | Honest builder; no `?? 'mp4'`; mkv → `unknown` |
| `src/main/ipc/handlers/catalog.ts` | Modify | `detectMediaFormat`; map new DTO fields |
| `src/main/db/schema.ts`, `repo.ts`, `workers/ingest-worker.ts` | Modify | Columns + writes |
| `src/main/services/m3u-client.ts` | Modify | ext / direct_source on `M3UEntry` |
| `src/shared/types/ipc.ts` | Modify | `CatalogItem.containerExtension`, `directSource` |
| `src/shared/schemas/player.ts` | Modify | play/stop schemas |
| `src/main/ipc/handlers/player.ts` | Modify | `player:play`/`stop`; origin; `mainWindow` |
| `src/main/ipc/index.ts` | Modify | Pass `HandlerDeps.mainWindow` into player |
| `src/preload/index.ts` | Modify | CJS `play`/`stop`; keep getSource/getProxiedUrl/report* |
| `src/renderer/lib/api.ts` | Modify | Typed play/stop |
| `src/renderer/features/player/PlayerPage.tsx` | Modify | Play IPC, not `getProxiedUrl` |
| `src/renderer/components/organisms/VideoPlayer.tsx` | Modify | Surface + diagnosis; no `createMediaEngine` |

Slice 2: live/movie/episode (`/watch/series/:id` → first episode). Slice 3: `track-list`, Off, `sub-add`, exclusive `setFullScreen`, OSD `title`, live −10s off. Leave `media-engine.ts` unused.

## Interfaces / Contracts

```ts
// player:play
{ type: 'live' | 'movie' | 'episode'; id: number }
→ { data: { engine: 'libmpv' } }
 | { error: { code: 'INTERNAL'; details: { kind: 'libmpv-load-failed' } } }
// getSource: format + live/VOD metadata only (no url)
// getProxiedUrl: MAY remain; MUST NOT be required
```

Diagnosis is libmpv load failure, not missing `mpv.exe`. `tsconfig.preload.json` stays `"module": "CommonJS"`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Honest URLs; mkv not mp4; missing ext; direct_source | Vitest xtream-client, detect-media-format, hydrate |
| Unit | No spawn; load-fail shape | Fake binding |
| Integration | Migration up/down; origin play; preload CJS play | migrate, ipc-player-channels, preload |
| E2E | Slice 1 mkv in Lux window | Windows with libmpv; skip CI without DLL |

## Threat Matrix

Process integration applies. Skill VCS/docs rows:

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A: no executable-file classification | — | none |
| Git repository selection | N/A: no git cwd routing | — | none |
| Commit state | N/A: no commit automation | — | none |
| Push state | N/A: no push automation | — | none |
| PR commands | N/A: no PR command composition | — | none |

Safe: in-process libmpv in the Lux window. Failure: diagnosis UI; zero Chromium probe; zero `mpv.exe`.

## Migration / Rollout

Chained PRs (`auto-chain`, 400 lines): (1) URL + schema + mkv play, (2) live/movie/episode, (3) tracks/subs/FS/OSD. Down drops new columns only. Do not re-enable Chromium probe.

## Open Questions

- [ ] `LUX_LIBMPV_DIR` vs `vendor/libmpv` for F2 dev (F7 bundles)
- [ ] Slice-1 HWND z-order so diagnosis stays visible over video
