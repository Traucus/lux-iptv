# Exploration: F2 Windows product player (libmpv)

Owner freeze 2026-08-30 (D-10 / D-11 / D-12 / D-14). Change: `lux-iptv-player-mpv`. Windows only.

## Quick path

F2 replaces the Chromium probe player with **libmpv as the only happy path**, an **honest Xtream URL builder**, and **real player chrome** (tracks, external subs, exclusive fullscreen, truthful OSD). Chromium `hls.js` / `mpegts.js` / `<video>` stay as a diagnostic corpse, not a fallback cascade.

## Current State

Windows play today is a **Chromium shell**:

1. `PlayerPage` (`/watch/:type/:id`) calls `player:getSource` (format metadata) + `player:getProxiedUrl` (`http://127.0.0.1:<port>/proxy/:type/:id`).
2. `VideoPlayer` mounts `<video>` and `createMediaEngine` → `FallbackMediaEngine.probeOrder` (live: hls→mpegts→native; mp4 VOD: native→hls).
3. OSD markup exists (`OsdControls`, `SeekBar`, live badge). Audio/subtitle handlers **only set React state**. Native/mpegts expose **empty track lists**. HLS getters exist but `handleAudioTrackChange` never calls `hls.audioTrack`.
4. No `BrowserWindow.setFullScreen` anywhere. `createWindow` is 1280×800, `sandbox: true`, `contextIsolation: true`. `PlayerHandlerDeps` does not receive `mainWindow` even though `HandlerDeps` has it.
5. OSD buttons have `aria-label` but **no `title` tooltip**. −10s / +10s stay enabled on live. SeekBar is hidden for live (good).
6. `TrackSelectorModal` already has `showOffOption` for subs. There is **no load-external-file control**.
7. Stream proxy (Node `http`, not `net.request`) already supports `episode` → `episodes` table. Keep it for header injection / HLS rewrite; **mpv in main should play catalog origin URL + headers**, not depend on Chromium CSP `media-src`.
8. OpenSpec `player-core` still requires hls.js as the engine (AJ-02). Planning D-10 **supersedes D-6**.
9. No `mpv` / `libmpv` dependency. Electron `^33.4.11`. `entry.cjs` disables GPU only on Linux unless `LUX_HW_ACCEL=true`.
10. Orphan change `openspec/changes/lux-iptv-player/` is Chromium-era naming. Vault/refresh is **F3** (historical folder `lux-iptv-f2-secure-source`). This change `lux-iptv-player-mpv` is **F2 player**. Do not collide names.

### URL construction gaps (D-12)

| Layer | What happens today | Honest rule |
| --- | --- | --- |
| `buildStreamUrl` live | Always `.../live/user/pass/{id}.m3u8` | Keep `.m3u8` unless panel/direct_source says otherwise; do not invent `.ts` |
| `buildStreamUrl` movie/series | `extension ?? 'mp4'` | Missing ext → persist unknown; **never default fake `.mp4`** |
| `fetchXtreamVod` | Reads `container_extension` into the URL, then maps **every non-m3u8/mpd/ts ext to `media_format='mp4'`** | URL may be `.mkv` while catalog lies `mp4` → Chromium probe treats mkv as mp4 |
| `direct_source` | Present on Xtream types, **never used** | If non-empty, that is the play URL |
| `fetchXtreamSeries` | Series row URL uses fake `'m3u8'` | Series row is not playable; leave as catalog key only |
| `fetchXtreamSeriesInfo` / `xtreamEpisodeUrl` | `container_extension ?? 'mp4'`; hydrate maps mkv/avi → `media_format='mp4'` | Persist real ext; media_format from real container (`unknown` if not hls/mp4/dash/ts) |
| Schema | No `container_extension` / `direct_source` columns; `media_format` enum is `hls\|mp4\|dash\|ts\|unknown` | Add columns; do not coerce mkv→mp4 |
| `allowed_output_formats` | Unused | Only if **engine** cannot play the container. libmpv plays mkv/HEVC/AC3 → almost never remux |

Verified: `NativeMediaEngine.audioTracks` / `MpegtsMediaEngine.audioTracks` return `[]` (`media-engine.ts`). `handleAudioTrackChange` comments `"we'd set audioTrack"` (`VideoPlayer.tsx`). Zero `setFullScreen` hits in `src/`.

## Affected Areas

- `src/main/services/xtream-client.ts` — `buildStreamUrl`, VOD/episode ext default, unused `direct_source`
- `src/main/ipc/handlers/catalog.ts` — episode hydrate URL + `media_format` coercion
- `src/main/db/schema.ts` + new migration — persist `container_extension`, `direct_source`
- `src/main/workers/ingest-worker.ts`, `src/main/db/repo.ts` — write new columns
- `src/shared/types/player.ts` — format enum no longer drives Chromium engine choice
- `src/main/ipc/handlers/player.ts` — play/load/tracks/fullscreen IPC; needs `mainWindow`
- `src/main/ipc/index.ts`, `src/preload/index.ts` (CJS), `src/renderer/lib/api.ts` — new `luxAPI.player.*` surface
- `src/main/index.ts` — window fullscreen; mpv lifecycle; **do not** Chromium-probe on mpv fail
- `src/renderer/features/player/PlayerPage.tsx` — drive libmpv, not `<video>` probe
- `src/renderer/components/organisms/VideoPlayer.tsx` — become OSD + libmpv surface host
- `src/renderer/components/molecules/osd/OsdControls.tsx` — tooltips, disable N/A, load-sub file
- `src/renderer/services/media-engine.ts`, `hls-client.ts` — not the product engine (leave unused or quarantine)
- `openspec/specs/player-core/spec.md` — rewrite (AJ-02); hls.js requirement is obsolete
- Tests: `tests/unit/xtream-client.test.ts`, `xtream-series-info.test.ts`, `detect-media-format.test.ts`, `tests/unit/player/*`, `tests/integration/ipc-player-channels.test.ts`

Out of F2: vault/refresh (F3), TMDB (F4), resume/next/continue (F5), EPG (F6), installer bundle (F7). F2 **dev** needs a loadable in-process libmpv (DLL/binding). F7 ships that libmpv — not `mpv.exe` on PATH as the player. Diagnosis is libmpv failed to load, not missing `mpv.exe`.

## Approaches

1. **Native N-API libmpv addon in main (F2 product)** — load `libmpv-2.dll`, libmpv API in the Lux process, same process, one window. `mpv_set_option("wid")` on a child HWND owned by Lux.
   - Pros: true in-process libmpv; `aid`/`sid`/`sub-file`; hwdec; no extra process; matches D-14.
   - Cons: no maintained Electron 33 binding (`mpv.js` is dead); `electron-rebuild` per ABI; Windows CI compile; renderer sandbox cannot load the addon.
   - Effort: High
   - ABI fallback (still this approach, still in-process): small native host or updated binding. Never spawn `mpv.exe` as the product.

2. **Spawn `mpv.exe --wid=<HWND>` + JSON IPC** — investigated; **rejected for F2** (D-14).
   - Pros: no native compile; tracks/subs/cache via IPC; F7 could copy `mpv.exe` + DLLs.
   - Cons: spawned `mpv.exe` is not in-process; Chromium 130 / Electron 33 **HWND sharing is historically flaky** (black frame, compositor wins). `--wid` on `BrowserWindow.getNativeWindowHandle()` is a known risk and is not a product path.
   - Effort: Medium (High if HWND fight)

3. **Spawn mpv + JSON IPC + parented video window (no `--wid` into Chromium HWND)** — investigated; **rejected for F2** (D-14: spawned `mpv.exe` child window is not the product engine).
   - Pros: avoids Chromium HWND compositor; OSD can stay React; exclusive fullscreen is Electron’s.
   - Cons: extra process; two windows to keep in sync; DPI/move/maximize edge cases; not in-process libmpv.
   - Effort: Medium

4. **Spawn mpv as a separate unparented player** — investigated; **rejected for F2**.
   - Pros: proves codecs in hours.
   - Cons: **fails D-11** (no overlay OSD, no exclusive product chrome) and **fails D-14** (external mpv). Not the product.
   - Effort: Low — reject for F2 done

## Recommendation

**Ship (1) as the F2 product engine**: in-process libmpv (libmpv API in Lux, same process, one window). Control via libmpv properties/commands (`track-list`, `aid`, `sid`, `sub-add`, `pause`, `seek`, `cache-secs`, `hwdec`).

Approaches (2), (3), and (4) stay documented as investigated and **rejected for F2**. Spawned `mpv.exe` (parented or not), Chromium `--wid`, and external VLC/mpv are not the product. If Electron ABI blocks a Node addon, the fallback is still in-process (small native host / updated binding), never spawn-as-product.

Do **not** npm-install abandoned `mpv.js` / `electron-mpv`. Do **not** cascade to `FallbackMediaEngine` when libmpv fails to load — show diagnosis (DLL/binding load fail, GPU), not missing `mpv.exe`.

URL builder is a **separate, test-first slice** and should land before or with the first play PR: persist real ext + `direct_source`; stop `?? 'mp4'` and stop mapping mkv→`media_format mp4`. libmpv does not need remux via `allowed_output_formats`.

Live profile (libmpv options): `cache=yes`, `cache-secs=20` (or equivalent demuxer bytes), reconnect, `hwdec=auto-safe`. **Never** `cache=no`. VOD: origin quality, no ABR downscale.

OSD overlay stays in the renderer. Track lists come from libmpv `track-list`, not from `<video>.audioTracks`.

### What F2 must prove

| ID | Proof |
| --- | --- |
| D-12 | Unit: mkv episode URL ends `.mkv`; `direct_source` wins; missing ext is not rewritten to `.mp4` |
| D-10 live | `/watch/live/{id}` plays via mpv; ~20s cache; reconnect; no SeekBar; −10s disabled |
| D-10 VOD | Movie + episode including **mkv / HEVC / AC3** play at origin quality |
| D-11 audio | Selecting a listed track **changes audible language** (not React state only) |
| D-11 subs | Real list; Off; load external `.srt`/`.ass` via `sub-add` |
| D-11 FS | `BrowserWindow.setFullScreen(true)` covers the Windows taskbar; Esc exits |
| D-11 OSD | Every control has `title` tooltip; icons match action; N/A disabled |
| Fail | libmpv fails to load → diagnostic error UI; **zero** hls/mpegts/native probe |
| Adjacent | Hero Play navigates to `/watch` (PA-05) if cheap in the player PR |

## Risks

- Electron 33 Chromium HWND (`--wid`) may not composite — a reason (2) is rejected, not a path to spawn (3).
- F2 will exceed the **400-line review budget** — chained PRs: (1) honest URL + schema, (2) in-process libmpv play live/movie/episode, (3) tracks + subs + fullscreen + OSD.
- F7 does not exist yet: F2 needs the libmpv DLL/binding loadable in-process; CI without libmpv cannot prove real decode (strict TDD on URL builder + libmpv fakes; Windows manual for HEVC).
- Preload is sandboxed **CJS** (lesson): new IPC in `src/preload/index.ts` must stay CommonJS output or `luxAPI` goes silent.
- OpenSpec `player-core` still mandates hls.js — delta spec must MODIFIED/REMOVED that requirement or verify will fight D-10.
- Orphan `lux-iptv-player` vs this change vs vault `lux-iptv-f2-secure-source` — names collide in conversation, not on disk if we keep `lux-iptv-player-mpv`.
- Next-episode overlay and resume clock are **F5**; do not expand F2 into them.
- Do not mix `docs/planning/` or `SPEC-HEALTH.md` into product PRs.

## Ready for Proposal

Yes. Orchestrator should tell the user: F2 is ready to propose as `lux-iptv-player-mpv`. Product engine is **in-process libmpv** (libmpv API in Lux, same process, one window), not Chromium probe and not spawned `mpv.exe`. If Electron ABI blocks a Node addon, fallback stays in-process (small native host / updated binding). URL honesty is a required first slice. Expect chained PRs over the 400-line budget.
