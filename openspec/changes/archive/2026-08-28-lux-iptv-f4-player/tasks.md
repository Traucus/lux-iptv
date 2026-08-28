# Tasks: F4 Real Player

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650–800 (PR1 ~320, PR2 ~380) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Route PlayerPage + typed player API + proxied src + hero Play | PR 1 | `npx vitest run tests/unit/routing.test.tsx tests/unit/player/player-page.test.tsx tests/unit/features/DashboardPage.test.tsx tests/integration/ipc-player-channels.test.ts` | N/A — no Playwright in F4 | Revert `App.tsx`, `api.ts`, `PlayerPage.tsx`, `player.ts`, `DashboardPage.tsx`, matching tests |
| 2 | HLS rewrite + ABR + GPU | PR 2 | `npx vitest run tests/unit/hls-rewrite.test.ts tests/unit/stream-proxy.test.ts tests/unit/player/hls-client.test.ts tests/integration/shell-hw-accel.test.ts` | N/A — no Playwright in F4 | Revert `hls-rewrite.ts`, `stream-proxy.ts`, `hls-client.ts`, `media-engine.ts`, `entry.cjs`, matching tests |

## Phase 1: PR1 RED — Route, API, Proxied Src, Hero

- [x] 1.1 RED `tests/unit/routing.test.tsx`: `/watch/movie/42` mounts `video-player`; no placeholder; `/watch/invalid/42` → `/`
- [x] 1.2 RED `tests/unit/player/player-page.test.tsx`: src = `getProxiedUrl` not origin; fail → `player-error`; live/9 hides SeekBar; series/7 proxies episode 101
- [x] 1.3 RED `tests/integration/ipc-player-channels.test.ts`: `getSource` is `{type,id,mediaFormat}` with no `url`
- [x] 1.4 RED `tests/unit/features/DashboardPage.test.tsx`: hero Play → `/watch/movie/42`

## Phase 2: PR1 GREEN — Route, API, Proxied Src, Hero

- [x] 2.1 GREEN `src/renderer/App.tsx`: always `PlayerPage`; drop placeholder import; invalid type → `/`
- [x] 2.2 GREEN `src/renderer/lib/api.ts`: `TypedLuxAPI.player` matches preload
- [x] 2.3 GREEN `src/main/ipc/handlers/player.ts`: `getSource` omits `url`/headers
- [x] 2.4 GREEN `src/renderer/features/player/PlayerPage.tsx`: proxied src; series first episode id then proxy `episode`; no origin fallback
- [x] 2.5 GREEN `src/renderer/features/dashboard/DashboardPage.tsx`: Hero Play → `/watch/movie/:id`
- [x] 2.6 Pass Phase 1 vitest; keep `PlayerPlaceholder.tsx`

## Phase 3: PR2 RED — HLS Rewrite, ABR, GPU

- [x] 3.1 RED `tests/unit/hls-rewrite.test.ts`: relative URI → `/proxy/{type}/{id}?u=`; absolute unchanged; other origin rejected
- [x] 3.2 RED `tests/unit/stream-proxy.test.ts`: rewrite relative playlist; stream segments without full buffer
- [x] 3.3 RED `tests/unit/player/hls-client.test.ts`: 5 levels, cap + mid `startLevel`; live `lowLatencyMode` on, VOD off
- [x] 3.4 RED `tests/integration/shell-hw-accel.test.ts`: Linux GPU off unless `LUX_HW_ACCEL=true` in `entry.cjs`

## Phase 4: PR2 GREEN — HLS Rewrite, ABR, GPU

- [x] 4.1 GREEN create `src/main/services/hls-rewrite.ts`: rewrite URI/`URI=` same-origin http(s) only
- [x] 4.2 GREEN `src/main/services/stream-proxy.ts`: `?u=` route; buffer+rewrite manifests; pipe segments
- [x] 4.3 GREEN `src/renderer/services/hls-client.ts` + `media-engine.ts`: cap, mid startLevel, `live` → lowLatency
- [x] 4.4 GREEN `src/main/entry.cjs`: Linux GPU off unless `LUX_HW_ACCEL=true` before ESM import
- [x] 4.5 Pass Phase 3 vitest
