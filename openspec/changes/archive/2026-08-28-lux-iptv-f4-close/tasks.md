# Tasks: F4 Close — Spec-True Player Tests

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280–360 (deletes-heavy; skip `PlayerPlaceholder.tsx`) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Spec-true player tests | single PR | `npx vitest run tests/unit/routing.test.tsx tests/unit/player/player-page.test.tsx` | `npx playwright test tests/e2e/routing.spec.ts` | `tests/unit/routing.test.tsx`, `tests/unit/player/player-page.test.tsx`, `tests/e2e/routing.spec.ts` |

## Phase 1: Branch and unit truth

- [x] 1.1 Branch from `feat/f4-player-core@d0ce736`. Do not push onto PR #2. Do not target `master` until it mounts `PlayerPage`.
- [x] 1.2 In `tests/unit/routing.test.tsx`, delete `PlayerPlaceholder`, `NavTarget`, `TestApp`, and `describe('HashRouter routing')` (~68–195). Keep hash `beforeEach`/`afterEach`, `App.tsx router selection`, `App /watch mounts PlayerPage`. Drop unused `HashRouter`/`Routes`/`Route`/`Navigate`/`useParams`/`useLocation`. Rewrite header (no REQ-NAV placeholder).
- [x] 1.3 GREEN: `npx vitest run tests/unit/routing.test.tsx` — App HashRouter + `/watch` mounts PlayerPage still pass.
- [x] 1.4 In `tests/unit/player/player-page.test.tsx`, delete stub `PlayerPage` + `describe('PlayerPage')` (~36–182). Keep hoisted `mockApi`, `ORIGIN`, `RealPlayerPage`, `renderWatch`, `PlayerPage proxied playback`. Drop unused `act` / fake timers.
- [x] 1.5 GREEN: `npx vitest run tests/unit/player/player-page.test.tsx` — proxied src, proxy error, live SeekBar hide, series→episode 101.

## Phase 2: E2E TDD (`tests/e2e/routing.spec.ts` only)

- [x] 2.1 RED: keep three cases; assert `video-player` (not `player-placeholder` / `player-type` / “PR 5”) against current incomplete `luxAPI` — expect `player-error`.
- [x] 2.2 GREEN: nest `TypedLuxAPI` mock: input-aware `catalog.getById` (movie 42; series 100 → `{ series, seasons[0].episodes[0] }`), `player.getSource` + `getProxiedUrl` (`http://127.0.0.1:9/proxy/{type}/{id}`), `reportError`/`reportProgress`/`getNextEpisode`, `config.hasSource`. Happy path: `video-player` visible, `player-placeholder` count 0, not `player-error`. Invalid type: `getByLabel('Home')`, placeholder count 0. Do not assert HLS.
- [x] 2.3 GREEN: `npx playwright test tests/e2e/routing.spec.ts`.

## Phase 3: Budget gate and proof

- [x] 3.1 Leave `tests/unit/player/video-player.test.tsx` untouched. Do not add `openspec/changes/lux-iptv-f4-close/specs/{domain}/`.
- [x] 3.2 If authored add+del after 1.x–2.x is `< 320`, delete unused `src/renderer/features/player/PlayerPlaceholder.tsx`; else skip.
- [x] 3.3 Confirm authored add+del `< 400`. One commit: `test(player): drop placeholder doubles; proxy-aware watch e2e`. New PR; do not update PR #2.
