# Apply Progress: lux-iptv-f4-close

**Change**: lux-iptv-f4-close
**Mode**: Strict TDD
**Branch**: `feat/f4-close-tests` at `d0ce736` (not `feat/f4-player-core`; PR #2 not updated)
**Delivery**: auto-chain / stacked-to-main / single PR (400-line budget risk: Low)
**Native attempt**: acquired by parent (`f4-close-tests-20260828`); apply did not acquire/settle

## Completed Tasks

- [x] 1.1 Branch `feat/f4-close-tests` from `feat/f4-player-core@d0ce736`
- [x] 1.2 Delete `PlayerPlaceholder` / `NavTarget` / `TestApp` / `describe('HashRouter routing')` from `tests/unit/routing.test.tsx`
- [x] 1.3 GREEN `npx vitest run tests/unit/routing.test.tsx` — 4 passed
- [x] 1.4 Delete stub `PlayerPage` + `describe('PlayerPage')` from `tests/unit/player/player-page.test.tsx`
- [x] 1.5 GREEN `npx vitest run tests/unit/player/player-page.test.tsx` — 5 passed
- [x] 2.1 RED E2E: assert `video-player` against incomplete `luxAPI` — movie/series failed (`player-error` / "Failed to load content"); invalid type already passed
- [x] 2.2 GREEN nested `TypedLuxAPI` mock (`getById` movie 42 / series 100 → first episode 101; `player.getSource` + `getProxiedUrl`; `config.hasSource`)
- [x] 2.3 GREEN `npx playwright test tests/e2e/routing.spec.ts` — 3 passed
- [x] 3.1 `tests/unit/player/video-player.test.tsx` untouched; no `openspec/changes/lux-iptv-f4-close/specs/{domain}/`
- [x] 3.2 Skip `PlayerPlaceholder.tsx` delete (authored add+del after 1.x–2.x = 361, not < 320)
- [x] 3.3 Authored add+del 361 < 400. Commit/PR deferred (launch: prefer clean diff; do not push or open PRs). Intended: `test(player): drop placeholder doubles; proxy-aware watch e2e`

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `tests/unit/routing.test.tsx` | Modified | Dropped placeholder helpers + `HashRouter routing`; kept App HashRouter + `/watch` mounts PlayerPage |
| `tests/unit/player/player-page.test.tsx` | Modified | Dropped origin-m3u8 stub suite; kept proxied playback |
| `tests/e2e/routing.spec.ts` | Modified | Proxy-aware `TypedLuxAPI` mock; assert `video-player`; absolute Vite origin for goto |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | N/A | Structural | N/A (branch) | ➖ Branch only | ➖ | ➖ Structural | ➖ None needed |
| 1.2 | `tests/unit/routing.test.tsx` | Unit | ✅ 11/11 then 26/26 combined | ✅ Deleted lying placeholder suite (tests-only; no production RED) | ✅ 4 passed (kept App suites) | ✅ HashRouter import + `/watch` PlayerPage + invalid type | ➖ None needed |
| 1.3 | `tests/unit/routing.test.tsx` | Unit | ✅ after 1.2 | ➖ Kept suites already existed | ✅ `npx vitest run tests/unit/routing.test.tsx` — 4 passed | ✅ 2 App router + 2 PlayerPage mount cases | ➖ None needed |
| 1.4 | `tests/unit/player/player-page.test.tsx` | Unit | ✅ 15/15 | ✅ Deleted origin-m3u8 stub (tests-only) | ✅ 5 passed (proxied suite) | ✅ proxy src, proxy error, live hide, movie SeekBar, series→101 | ➖ Dropped unused `act` / fake timers |
| 1.5 | `tests/unit/player/player-page.test.tsx` | Unit | ✅ after 1.4 | ➖ Kept suite already existed | ✅ `npx vitest run tests/unit/player/player-page.test.tsx` — 5 passed | ✅ 5 proxied cases | ➖ None needed |
| 2.1 | `tests/e2e/routing.spec.ts` | E2E | N/A (rewrite assertions) | ✅ Incomplete mock: movie/series `video-player` not found; snapshot "Failed to load content" (`player-error`); invalid type passed | ➖ RED gate | ✅ 3 cases kept | ➖ |
| 2.2 | `tests/e2e/routing.spec.ts` | E2E | after 2.1 RED | ✅ Written first | ✅ Nested mock; happy path `video-player` + placeholder 0 + not `player-error` | ✅ movie 42, series 100 reload, invalid → Home | ➖ None needed |
| 2.3 | `tests/e2e/routing.spec.ts` | E2E | after 2.2 | ➖ | ✅ `npx playwright test tests/e2e/routing.spec.ts` — 3 passed (3.9s) | ✅ 3 cases | ➖ None needed |
| 3.1 | `tests/unit/player/video-player.test.tsx` | — | ✅ git clean | ➖ Untouched | ➖ | ➖ | ➖ |
| 3.2 | `PlayerPlaceholder.tsx` | — | N/A | ➖ Skip: 361 ≮ 320 | ➖ | ➖ | ➖ |
| 3.3 | budget | — | N/A | ➖ | ➖ 361 < 400 | ➖ | ➖ Commit/PR deferred |

### Test Summary

- **Total tests written**: 0 new unit tests (deletes); 3 E2E cases rewritten
- **Total tests passing**: 9 unit + 3 E2E
- **Layers used**: Unit (9), Integration (0), E2E (3)
- **Approval tests** (refactoring): None — no production refactoring
- **Pure functions created**: 0

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npx vitest run tests/unit/routing.test.tsx tests/unit/player/player-page.test.tsx` — exit 0, 2 files, **9 passed** |
| Runtime harness command/scenario and exact result | `npx playwright test tests/e2e/routing.spec.ts` — exit 0, **3 passed** (3.9s). RED prior: 2 failed (`player-error`), 1 passed (invalid type) |
| Rollback boundary | `tests/unit/routing.test.tsx`, `tests/unit/player/player-page.test.tsx`, `tests/e2e/routing.spec.ts` — revert those three files; no production files changed |

## Deviations from Design

- E2E `page.goto` uses `http://localhost:5173/#/watch/...` because Playwright has no `baseURL` and relative `/#/` is an invalid URL. Assertions and mock shape still match design.
- Task 3.3 commit/PR not created: launch forbade push/open PR and preferred a clean uncommitted diff. Intended message recorded.

## Issues Found

- `playwright.config.ts` has no `baseURL`; existing relative `goto('/#/...')` cannot navigate. Out of scope to change the config.
- `PlayerPlaceholder.tsx` still present (69 lines) by budget gate.

## Remaining Tasks

None.

## Workload / PR Boundary

- Mode: single PR (forecast Low; chained PRs not recommended)
- Current work unit: Spec-true player tests
- Boundary: starts at `feat/f4-player-core@d0ce736`; ends with tests-only diff on `feat/f4-close-tests`
- Estimated review budget impact: **361 authored add+del** (66 insertions, 295 deletions) vs 400

## Status

11/11 tasks complete. Ready for verify. Do not start verify from apply.
