# CHECKLIST — remaining only

Reconciliation **2026-09-14** against `feat/lux-iptv-player-mpv` (`242a36e`). Lessons: Engram #711.

Freeze 2026-08-30 had **50** items. Closed work is **out of this file**. This list is **what still blocks Lux Desktop (F1–F7)**.

**9 remaining Windows items.** Screens 9 · flows 12 unchanged.

## F2 — player (3)

| ID | Class | Item | Evidence |
| --- | --- | --- | --- |
| FA-17 | PARCIAL | OSD chrome lives in HWND inset bands (88/168). Not a Chromium overlay (D-14 GPU off). Windows click-test still required. | `0204b9c`; `OSD_HWND_INSET` in `src/shared/player-chrome.ts` |
| FA-18 | PARCIAL | `player:play` loads catalog origin URL (no `.m3u8`→`.ts` rewrite) plus live HLS reconnect. Windows must prove libmpv does not curl-abort. | `242a36e`; `src/main/ipc/handlers/player.ts` |
| FA-03 | PARCIAL | Visible OSD control opens `.srt`/`.ass` picker; subtitle button stays enabled with zero embedded tracks. Windows must prove Electron `file.path` reaches libmpv `sub-add`. | `osd-load-subtitle` in `OsdControls.tsx`; hidden input in `VideoPlayer.tsx` |

## F3 — vault / refresh (0)

Refresh on Home/Live/Movies/Series and host-only vault shipped. Not backlog.

## F4 — TMDB (2)

| ID | Class | Item | Evidence |
| --- | --- | --- | --- |
| PA-06 | PARCIAL | Hydrate posters/synopsis on Movies/Series rows (not only Home). Pages still pass `enriched: false`. | `src/renderer/features/movies/MoviesPage.tsx:34` |
| FA-08 | PARCIAL | S2 requires a TMDB key and Home prompts when missing. Play is not blocked. Enrichment still does not start from the saved key (no getPlain / worker start). | `TmdbKeyOnboarding.tsx`; `tmdb-required-banner` on Home |

## F5 — VOD flows (1)

| ID | Class | Item | Evidence |
| --- | --- | --- | --- |
| FA-09 | PARCIAL | Continue Watching includes episodes, not movies-only. `catalog:getById` still rejects `episode`. | `src/renderer/features/dashboard/useDashboardData.ts:32` |

See-all (`?group=`), resume duration, next-episode navigate, Hero Play → `/watch` are done. Not backlog.

## F6 — EPG (2)

| ID | Class | Item | Evidence |
| --- | --- | --- | --- |
| FA-11 | FALTA | EPG guide S9 | `src/renderer/App.tsx:31` — no route |
| FA-12 | FALTA | Now/next on live cards | `src/renderer/features/live/LivePage.tsx:34` `currentProgram: null` |

## F7 — installer (1)

| ID | Class | Item | Evidence |
| --- | --- | --- | --- |
| FA-13 | FALTA | Windows installer bundles libmpv DLL + `lux-libmpv.node`. Untracked `vendor/libmpv` is not a ship. Chromium GPU stays **off** unless `LUX_HW_ACCEL=true` (D-14). | `package.json` electron-builder `dist/**` only |

## Not this train

| ID | Item |
| --- | --- |
| FA-14 | Android ExoPlayer (F8) |
| FA-15 | Samsung Tizen (F9) |
| FA-16 | LG webOS (F10) |
| F11–F14 | Profiles, parental, search, license |
| AJ-03 | Archive `openspec/changes/lux-iptv-mvp/` (historical naming) |
| AJ-04 | Archive superseded `openspec/changes/lux-iptv-player/` |

## Totals

| Class | Count |
| --- | --- |
| ROTO | 0 |
| PARCIAL | 6 |
| FALTA | 3 |
| **Windows remaining** | **9** |

## Consistency

| Axis | Value |
| --- | --- |
| Screens | 9 |
| Flows | 12 |
| Checklist remaining (Windows) | 9 |
| Windows develop | F1–F7 |
| Platforms | F8–F10 |
| Backlog | F11–F14 |
