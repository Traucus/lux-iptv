# Apply Progress: lux-iptv-player-mpv

**Change**: lux-iptv-player-mpv
**Mode**: Strict TDD
**Slice**: 4 (cleanup) — merged with slices 1–3
**Delivery**: auto-chain / stacked-to-main
**Lessons read**: Engram #711 `lessons/lux-iptv` (preload stays CJS; no SPEC-HEALTH in product)

## Completed Tasks

- [x] 1.1 Honest URL RED tests
- [x] 1.2 Honest URL GREEN (drop `?? 'mp4'`)
- [x] 1.3 mkv → `unknown` (detectMediaFormat + catalog hydrate)
- [x] 1.4 Migration RED 0003
- [x] 1.5 Migration GREEN + schema + repo
- [x] 1.6 DTO `containerExtension` / `directSource` + ingest writes
- [x] 1.7 libmpv-engine threat RED
- [x] 1.8 libmpv binding/engine GREEN (in-process, never spawn)
- [x] 1.9 player:play IPC RED
- [x] 1.10 player:play / stop GREEN
- [x] 1.11 preload CJS play/stop
- [x] 1.12 PlayerPage / VideoPlayer RED
- [x] 1.13 PlayerPage / VideoPlayer GREEN; media-engine unused
- [x] 1.14 E2E skip without DLL; `npm run typecheck` pass
- [x] 2.1 RED player-page + routing live/movie/episode; `/watch/series/7` → ep 101 not 102
- [x] 2.2 GREEN PlayerPage + engine live cache/reconnect/hwdec; VOD origin quality
- [x] 2.3 RED+GREEN player:play `{type,id}` origin+headers + live/vod profile
- [x] 3.1 RED+GREEN aid 2; Off subs; `.srt`/`.ass`; `track-list` + `sub-add`
- [x] 3.2 RED+GREEN SeekBar drag 50%→75%; D-Pad +10s; buffered 60%; seek → libmpv
- [x] 3.3 RED exclusive FS; Escape; live −10s off; OSD `title`
- [x] 3.4 GREEN exclusive `setFullScreen` + OSD chrome
- [x] 4.1 Preload CJS; no Chromium probe; no SPEC-HEALTH in product PRs

## Remaining Tasks

None.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `tests/unit/xtream-client.test.ts`, `tests/unit/m3u-client.test.ts` | Unit | ✅ 35/35 | ✅ Written | ✅ Passed | ✅ mkv + direct_source + missing ext | ✅ Honest builder extracted |
| 1.2 | same | Unit | ✅ | ✅ | ✅ 29/29 | ✅ live .m3u8 + reject ftp | ➖ None needed |
| 1.3 | `tests/unit/detect-media-format.test.ts` | Unit | ✅ 18/18 | ✅ Written (regression; default already unknown) | ✅ 19/19 | ✅ xtream VOD mkv mediaFormat unknown | ✅ catalog hydrate uses detectMediaFormat |
| 1.4 | migrate / atomicity / down-migration | Integration | ✅ existing 12 pass | ✅ Written | ✅ 15/15 | ✅ 4 tables + down keeps http_headers | ➖ |
| 1.5 | same | Integration | N/A (new SQL) | ✅ | ✅ | ✅ defaults '' | ➖ |
| 1.6 | catalog-handler + schema-columns | Integration | ✅ | ✅ Written | ✅ | ✅ empty default + mkv DTO | ➖ |
| 1.7 | `tests/unit/player/libmpv-engine.test.ts` | Unit | N/A (new) | ✅ Written | ✅ 5/5 | ✅ fail + origin headers + no spawn | ➖ |
| 1.8 | same | Unit | N/A | ✅ | ✅ | ✅ stop no-op when unloaded | ➖ |
| 1.9 | `tests/integration/ipc-player-channels.test.ts` | Integration | ✅ 14 pass | ✅ Written | ✅ 17/17 | ✅ origin play + load-fail | ➖ |
| 1.10 | same | Integration | ✅ | ✅ | ✅ | ✅ | ➖ |
| 1.11 | `tests/integration/preload.test.ts` | Integration | ✅ | ✅ Written | ✅ 13/13 | ✅ play + stop + CJS | ➖ |
| 1.12 | player-page / video-player / engine-fallback | Unit | existing player-page used proxy | ✅ Written | ✅ 22/22 | ✅ diagnosis + no video + unmount stop | ✅ VideoPlayer Chromium engine removed |
| 1.13 | same | Unit | ✅ | ✅ | ✅ | ✅ | ✅ unused video handlers removed |
| 1.14 | `tests/e2e/player-playback.spec.ts` | E2E | N/A | ✅ skip without DLL | ✅ typecheck | ➖ skip path | ➖ |
| 2.1 | `tests/unit/player/next-episode.test.ts`, `tests/unit/player/player-page.test.tsx`, `tests/unit/routing.test.tsx` | Unit | ✅ 32/32 (slice-2 safety net) | ✅ Written (resolveFirstEpisode missing; series/7 played 102) | ✅ 26/26 | ✅ 101-then-102 + 102-listed-first; live/movie/episode routes | ✅ `resolveFirstEpisode` extracted |
| 2.2 | `tests/unit/player/libmpv-engine.test.ts` | Unit | ✅ 5/5 | ✅ Written (`libmpvPlaybackOptions` missing) | ✅ 8/8 | ✅ live cache/reconnect/hwdec vs VOD no cache/vf | ➖ None needed |
| 2.3 | `tests/integration/ipc-player-channels.test.ts` | Integration | ✅ 17/17 | ✅ Written (live/episode origin ok; profile missing) | ✅ 19/19 | ✅ live profile vs movie/episode vod | ➖ None needed |
| 3.1 | `tests/unit/player/video-player.test.tsx`, `tests/unit/player/libmpv-engine.test.ts` | Unit | ✅ 38/38 | ✅ Written (aid 2 / Off / add-subtitle missing) | ✅ 14/14 then 24/24 | ✅ `.srt` + `.ass`; sid `no` | ✅ `mapLibmpvTracks` / `isExternalSubtitleFile` |
| 3.2 | `tests/unit/player/seek-bar.test.tsx`, `tests/unit/player/video-player.test.tsx` | Unit | ✅ 24/24 | ✅ Written (duration 0; production SeekBar unused) | ✅ 33/33 | ✅ drag 75% + D-Pad ±10s + buffered 60% | ✅ SeekBar stub replaced with production |
| 3.3 | `tests/unit/player/osd-auto-hide.test.ts`, `tests/unit/player/video-player.test.tsx` | Unit | ✅ 33/33 | ✅ Written (no FS button / titles / live rewind) | ✅ (3.4) | ✅ live off vs movie/episode on | ➖ |
| 3.4 | same + OsdControls | Unit | ✅ | ✅ (3.3 tests) | ✅ 48/48 focused; 80 with IPC/preload | ✅ Escape exits; titles on 6 controls | ➖ None needed |
| 4.1 | `tests/unit/player/product-guards.test.ts` | Unit | ✅ 37/37 (video-player 19, engine-fallback 5, preload 13) | ✅ Written (missing `player-product-guards`) | ✅ 7/7 then VideoPlayer drop media-engine import; typecheck exit 0 | ✅ ESNext + createMediaEngine probe + SPEC-HEALTH `src/` vs openspec + git porcelain rename | ✅ `renamedPath` TS2532 guard |

## Test Summary

- **Total tests written this slice**: 7 product-guard cases (CommonJS, ESNext, media-engine probe, leftover engine allowed, SPEC-HEALTH product vs planning, git porcelain, workspace snapshot)
- **Focused run**: `npx vitest run tests/unit/player/product-guards.test.ts` → **1 file, 7 passed, exit 0**
- **Safety net after VideoPlayer edit**: `npx vitest run tests/unit/player/product-guards.test.ts tests/unit/player/video-player.test.tsx` → **2 files, 26 passed, exit 0**
- **Layers used**: Unit
- **Approval tests**: None — no refactoring of existing behavior beyond dropping a type-only media-engine import
- **Pure functions created**: `evaluatePlayerProductGuards`, `parseGitPorcelainPaths`, `isProductPath`

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run tests/unit/player/product-guards.test.ts` → **1 file, 7 passed, exit 0** |
| Runtime harness command/scenario and exact result | `npm run typecheck` → exit 0. Git porcelain + `src/` SPEC-HEALTH walk run in-process in the workspace test. No libmpv HWND on this Linux host; slice 4 is static product invariants, not HWND play. |
| Rollback boundary | `src/shared/player-product-guards.ts`, `tests/unit/player/product-guards.test.ts`, VideoPlayer local `PlaybackSource` (no `media-engine` import). Revert those without dropping slices 1–3 URL/schema/live/tracks. |

## Files Changed (this slice)

| File | Action | What Was Done |
|------|--------|---------------|
| `src/shared/player-product-guards.ts` | Created | Pure guards: preload CommonJS, unused media-engine, no HLS probe on play, no SPEC-HEALTH in product paths |
| `tests/unit/player/product-guards.test.ts` | Created | RED/GREEN/triangulate for 4.1 plus workspace git/path snapshot |
| `src/renderer/components/organisms/VideoPlayer.tsx` | Modified | Dropped `import type` from `media-engine`; local PlaybackSource so play path does not depend on Chromium engine |

## Deviations from Design

None — implementation matches design. Chromium `media-engine.ts` remains in tree unused. `openspec/specs/SPEC-HEALTH.md` may stay untracked; product `src/` must not add it.

## Issues Found

None.

## Workload / PR Boundary

- Mode: stacked PR slice (stacked-to-main)
- Current work unit: Unit 4 cleanup (preload CJS / no Chromium probe / no SPEC-HEALTH)
- Boundary: starts after slice 3 tracks/FS/OSD; ends with product-guard tests and VideoPlayer decoupled from media-engine. No further apply tasks.
- Estimated review budget impact: **Low** (new guard module + tests; VideoPlayer type-only import removal)

## Status

22/22 tasks complete (14 Phase 1 + 3 Phase 2 + 4 Phase 3 + 1 Phase 4). Ready for verify.
