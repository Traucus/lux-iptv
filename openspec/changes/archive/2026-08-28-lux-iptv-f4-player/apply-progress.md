# Apply Progress: lux-iptv-f4-player (PR1 + PR2 HLS rewrite + ABR + GPU)

**Change**: lux-iptv-f4-player
**Mode**: Strict TDD
**Work unit**: PR2 HLS rewrite + ABR + GPU (Phases 3–4); PR1 preserved below
**Delivery**: auto-chain / stacked-to-main
**applyState after this batch**: all_done (19/19 tasks complete; ready for verify)
**Authored diff (PR2)**: 393 changed lines (implementation files); tasks.md checkboxes +18

## Completed this batch (PR2)

- [x] 3.1 RED tests/unit/hls-rewrite.test.ts: relative URI → `/proxy/{type}/{id}?u=`; absolute unchanged; other origin rejected
- [x] 3.2 RED tests/unit/stream-proxy.test.ts: rewrite relative playlist; stream segments without full buffer
- [x] 3.3 RED tests/unit/player/hls-client.test.ts: 5 levels, cap + mid startLevel; live lowLatencyMode on, VOD off
- [x] 3.4 RED tests/integration/shell-hw-accel.test.ts: Linux GPU off unless LUX_HW_ACCEL=true in entry.cjs
- [x] 4.1 GREEN create src/main/services/hls-rewrite.ts: rewrite URI/URI= same-origin http(s) only
- [x] 4.2 GREEN src/main/services/stream-proxy.ts: ?u= route; buffer+rewrite manifests; pipe segments
- [x] 4.3 GREEN src/renderer/services/hls-client.ts + media-engine.ts: cap, mid startLevel, live → lowLatency
- [x] 4.4 GREEN src/main/entry.cjs: Linux GPU off unless LUX_HW_ACCEL=true before ESM import
- [x] 4.5 Pass Phase 3 vitest — 4 files, 49 passed, exit 0

## Previously completed (PR1 — merged, do not drop)

- [x] 1.1 RED routing.test.tsx: `/watch/movie/42` mounts `video-player`; no placeholder; `/watch/invalid/42` → `/`
- [x] 1.2 RED player-page.test.tsx: src = getProxiedUrl not origin; fail → player-error; live/9 hides SeekBar; series/7 proxies episode 101
- [x] 1.3 RED ipc-player-channels.test.ts: getSource is {type,id,mediaFormat} with no url
- [x] 1.4 RED DashboardPage.test.tsx: hero Play → /watch/movie/42
- [x] 2.1 GREEN App.tsx always PlayerPage; drop placeholder import
- [x] 2.2 GREEN TypedLuxAPI.player matches preload
- [x] 2.3 GREEN getSource omits url/headers
- [x] 2.4 GREEN PlayerPage proxied src; series first episode id then proxy episode
- [x] 2.5 GREEN Hero Play → /watch/movie/:id
- [x] 2.6 Pass Phase 1 vitest; PlayerPlaceholder.tsx kept unused

## Remaining

None. All 19 tasks complete.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/2.1 | `tests/unit/routing.test.tsx` | Integration | ✅ 9/9 routing + 39/39 PR1 files | ✅ Written (placeholder still mounted) | ✅ 11/11 routing | ✅ movie/42 video-player + invalid → `/` | ✅ Compacted App mocks |
| 1.2/2.4 | `tests/unit/player/player-page.test.tsx` | Integration | ✅ 10/10 existing fake-page tests | ✅ Origin src / no player-error | ✅ 15/15 | ✅ movie proxy, live hide SeekBar, series ep 101, proxy fail | ➖ Kept useQuery; proxy effect only |
| 1.3/2.3 | `tests/integration/ipc-player-channels.test.ts` | Integration | ✅ 15/15 then 2 RED | ✅ url+headers still returned | ✅ 15/15 | ✅ live and episode omit url | ✅ Removed unused safeParseHeaders |
| 1.4/2.5 | `tests/unit/features/DashboardPage.test.tsx` | Integration | ✅ 5/5 | ✅ `/content/42` | ✅ 6/6 | ➖ Single spec scenario (hero Play) | ➖ One-line navigate change |
| 2.2 | `src/renderer/lib/api.ts` | Unit (type) | N/A (type surface) | ✅ PlayerPage calls `player.getProxiedUrl` | ✅ TypedLuxAPI.player | ➖ Structural type export | ➖ None needed |
| 2.6 | Phase 1 vitest | Integration | ✅ 39/39 then 47/47 | n/a | ✅ 47 passed / 4 files | n/a | n/a |
| 3.1/4.1 | `tests/unit/hls-rewrite.test.ts` | Unit | N/A (new) | ✅ Module missing | ✅ 6/6 | ✅ relative, absolute, other-origin, URI=, resolve reject/accept | ➖ Pure functions already small |
| 3.2/4.2 | `tests/unit/stream-proxy.test.ts` | Unit | ✅ 20/20 + 37/37 net | ✅ no rewrite; stream hung until end; ?u= not 403 | ✅ 23/23 | ✅ rewrite playlist, pipe segment, cross-origin 403 | ➖ fetchAndStream split manifest vs pipe |
| 3.3/4.3 | `tests/unit/player/hls-client.test.ts` | Unit | ✅ 6/6 resilience | ✅ cap undefined; VOD lowLatency still true | ✅ 8/8 | ✅ 5-level mid startLevel + live vs VOD | ➖ Compacted hls.js mock |
| 3.4/4.4 | `tests/integration/shell-hw-accel.test.ts` | Unit (source) | ✅ 11/11 policy | ✅ entry.cjs had no LUX_HW_ACCEL | ✅ 12/12 | ✅ policy tests remain; entry.cjs env gate | ➖ None needed |
| 4.5 | Phase 3 vitest | Mixed | ✅ 37/37 then 49/49 | n/a | ✅ 49 passed / 4 files | n/a | n/a |

### Test Summary
- **Total tests written this batch**: 12 new behavioral tests (hls-rewrite×6, stream-proxy×3, hls-client×2, entry.cjs×1)
- **Total tests passing (focused command)**: 49
- **Layers used**: Unit (11), Integration/source (1)
- **Approval tests** (refactoring): None — no refactoring-only tasks
- **Pure functions created**: 2 (`rewritePlaylist`, `resolveSameOriginHttp`)

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run tests/unit/hls-rewrite.test.ts tests/unit/stream-proxy.test.ts tests/unit/player/hls-client.test.ts tests/integration/shell-hw-accel.test.ts` → exit 0, 4 files, 49 passed |
| Runtime harness command/scenario and exact result | N/A — no Playwright in F4 (tasks/design) |
| Rollback boundary | Revert `hls-rewrite.ts`, `stream-proxy.ts`, `hls-client.ts`, `media-engine.ts`, `entry.cjs`, matching tests. Do not revert PR1 PlayerPage/route/proxy-src files. |

## Files Changed (PR2)

| File | Action | What Was Done |
|------|--------|---------------|
| `tests/unit/hls-rewrite.test.ts` | Created | Relative/absolute/other-origin/URI= rewrite tests |
| `tests/unit/stream-proxy.test.ts` | Modified | Rewrite playlist, pipe segments, reject cross-origin `?u=` |
| `tests/unit/player/hls-client.test.ts` | Modified | Real HlsClient ABR cap + mid startLevel; live vs VOD lowLatency |
| `tests/integration/shell-hw-accel.test.ts` | Modified | Assert entry.cjs honors LUX_HW_ACCEL before ESM import |
| `src/main/services/hls-rewrite.ts` | Created | Pure playlist rewrite + same-origin http(s) resolve |
| `src/main/services/stream-proxy.ts` | Modified | `?u=` route; buffer+rewrite manifests; pipe segments |
| `src/renderer/services/hls-client.ts` | Modified | capLevelToPlayerSize, mid startLevel, live-only lowLatency |
| `src/renderer/services/media-engine.ts` | Modified | Pass `live: source.type === 'live'` |
| `src/main/entry.cjs` | Modified | Linux GPU off unless LUX_HW_ACCEL=true before ESM import |
| `openspec/changes/lux-iptv-f4-player/tasks.md` | Modified | PR2 tasks `[x]` |

## Deviations from Design
None — implementation matches design.

## Issues Found
None blocking PR2.

## Workload / PR Boundary
- Mode: stacked PR slice (stacked-to-main)
- Current work unit: PR2 HLS rewrite + ABR + GPU
- Boundary: starts after PR1 PlayerPage + proxied src; ends with relative HLS through proxy, mid ABR + size cap, Linux GPU env gate. Does not redo PR1.
- Estimated review budget impact: 393 authored lines on implementation files (≤400)

## Status
19/19 tasks complete. Ready for verify.
