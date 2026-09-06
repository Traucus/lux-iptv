# CHECKLIST — Lux IPTV

Freeze 2026-08-30: **50 items** (14 FUNCIONAN / 8 ROTAS / 7 PARCIALES / 16 FALTAN / 5 AJUSTE), **9 screens**, **12 flows**, **F1–F7 Windows** + **F8–F10 platforms** + **F11–F14 backlog**.

Evidence dated against branch work 2026-08-30 (`VideoPlayer.tsx`, `media-engine.ts`, `OsdControls.tsx`).

## FUNCIONAN (14)

| ID | Item | Evidence | Phase |
| --- | --- | --- | --- |
| OK-01 | HashRouter | `App.tsx` | F1 |
| OK-02 | Xtream ingest | `xtream-client.ts` | F1 |
| OK-03 | M3U ingest | `m3u-client.ts` | F1 |
| OK-04 | Catalog sql.js | `sqljs-adapter.ts` | F1 |
| OK-05 | Grouped catalog IPC | `useCatalogGrouped` | F1 |
| OK-06 | Category rows | Live/Movies/Series pages | F1 |
| OK-07 | Dashboard layout | `DashboardPage.tsx` | F1 |
| OK-08 | Detail `/content/:type/:id` | `App.tsx` | F1 |
| OK-09 | Lazy `get_series_info` | `catalog.ts` hydrate | F1 |
| OK-10 | Episode route skips `getById` | `PlayerPage.tsx` | F1 |
| OK-11 | TMDB key encryption | `tmdb-key.ts` | F4 |
| OK-12 | PlaceholderArt component exists | `PlaceholderArt.tsx` — not product-done; no-key still OK (PA-06) | F4 |
| OK-13 | Stream proxy Node http | `stream-proxy.ts` (not `net.request`) | F2 |
| OK-14 | VideoPlayer + OSD markup | `VideoPlayer.tsx`, `OsdControls.tsx` | F2 |

## ROTAS (8)

| ID | Item | Evidence | Phase |
| --- | --- | --- | --- |
| BR-01 | Audio select is a no-op | `VideoPlayer.tsx` `handleAudioTrackChange` only sets React state | F2 |
| BR-02 | Subtitle select is a no-op | same file; native/mpegts return `[]` tracks | F2 |
| BR-03 | No exclusive fullscreen | no `setFullScreen` in repo; Windows taskbar stays | F2 |
| BR-04 | OSD icons/tooltips | `OsdControls.tsx` has no `title` / tooltip | F2 |
| BR-05 | URL builder lies `.mp4` | Xtream `container_extension` mapped to mp4; mkv episodes fail | F2 |
| BR-06 | Chromium cannot be the product engine | IPTVnator/mpv benchmark; probe cascade | F2 |
| BR-07 | Continue Watching fake | `useDashboardData.ts` | F5 |
| BR-08 | See-all ignored | `MoviesPage.tsx` `onSeeAll` | F5 |

## PARCIALES (7)

| ID | Item | Evidence | Phase |
| --- | --- | --- | --- |
| PA-01 | Refresh only Home | `DashboardPage.tsx` | F3 |
| PA-02 | Settings = add source / secrets | `IngestPage.tsx` | F3 |
| PA-03 | Resume duration 0 | `PlayerPage.tsx` | F5 |
| PA-04 | Next-episode incomplete | `VideoPlayer.tsx` next card does not navigate | F5 |
| PA-05 | Hero Play | Dashboard Play may not hit `/watch` | F2 |
| PA-06 | TMDB optional / rows not hydrated | no-key treated as OK | F4 |
| PA-07 | GPU / Chromium still default engine | `entry.cjs` / `media-engine.ts` probe | F2 |

## FALTAN (16)

| ID | Item | Phase |
| --- | --- | --- |
| FA-01 | libmpv Windows engine | F2 |
| FA-02 | Honest Xtream URL builder | F2 |
| FA-03 | Load external subtitle file | F2 |
| FA-04 | Exclusive fullscreen IPC | F2 |
| FA-05 | OSD tooltip + icon pass | F2 |
| FA-06 | Refresh on Live/Movies/Series | F3 |
| FA-07 | Vault UI, no secret echo | F3 |
| FA-08 | TMDB required onboarding + row hydration | F4 |
| FA-09 | Continue Watching from `playback_positions` | F5 |
| FA-10 | See-all screen S8 | F5 |
| FA-11 | EPG guide S9 | F6 |
| FA-12 | Now/next on live cards | F6 |
| FA-13 | Windows installer bundles libmpv (DLL/binding) | F7 |
| FA-14 | Android ExoPlayer app | F8 |
| FA-15 | Samsung Tizen player | F9 |
| FA-16 | LG webOS player | F10 |

## AJUSTE (5)

| ID | Item | Phase |
| --- | --- | --- |
| AJ-01 | This freeze supersedes D-6 hls.js | contract |
| AJ-02 | OpenSpec `player-core` rewrite for mpv | contract |
| AJ-03 | Archive folder `lux-iptv-mvp` (historical ingest slice). New name for that era: **Lux Desktop** first ship, not MVP | contract |
| AJ-04 | Close `lux-iptv-player` orphan if still open | contract |
| AJ-05 | Sidebar Settings = vault | F3 |

F11–F14 (profiles, parental, search, license) stay backlog — not in the 50 until that train starts.

## Totals

| Class | Count |
| --- | --- |
| FUNCIONAN | 14 |
| ROTAS | 8 |
| PARCIALES | 7 |
| FALTAN | 16 |
| AJUSTE | 5 |
| **Total** | **50** |

## Consistency

| Axis | Value |
| --- | --- |
| Screens | 9 |
| Flows | 12 |
| Checklist items | 50 |
| Windows develop | F1–F7 |
| Platforms | F8–F10 |
| Backlog | F11–F14 |
