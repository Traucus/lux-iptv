# Proposal: F4 Close — Spec-True Player Tests

## Intent

Archived F4 mounts `PlayerPage` with proxied `src` only. Unit and E2E suites still assert `PlayerPlaceholder` and origin m3u8, so green CI lies. Kill or rewrite those suites so tests match archived `player-core` / `renderer-quality`.

## Scope

### In Scope

- `tests/unit/routing.test.tsx`: delete local `PlayerPlaceholder`, `TestApp` (and `NavTarget`), `describe('HashRouter routing')` (~73–195). Keep `App.tsx router selection` and `App /watch mounts PlayerPage` (~207–271). Keep shared hash `beforeEach`/`afterEach` if those suites still need them.
- `tests/unit/player/player-page.test.tsx`: delete stub `PlayerPage` + `describe('PlayerPage')` (~45–182). Keep `describe('PlayerPage proxied playback')` (~203+).
- `tests/e2e/routing.spec.ts`: stop asserting `player-placeholder` / “Player coming in PR 5”. Extend `luxAPI` mock with `player.getProxiedUrl` (plus catalog item / `config.hasSource` as needed). Assert `video-player`, loading, or error — never testid-swap only.
- Optional: delete unused `src/renderer/features/player/PlayerPlaceholder.tsx` if the PR stays small.

### Out of Scope

- F3 TMDB, EPG, new player features
- `SPEC-HEALTH.md`, `docs/planning/`
- `tests/unit/player/video-player.test.tsx` (organism fixture)
- Inflating GitHub PR #2
- Spec rewrites (F4 archive already merged truth)

## Capabilities

> Contract for sdd-spec. Main specs already require PlayerPage + proxied src.

### New Capabilities

None

### Modified Capabilities

None

## Approach

Tests-only work unit on a **new PR** (stacked-to-main; do not mix into PR #2). Delete lying local doubles. Keep production App and proxied-playback suites. E2E mock must include `player.getProxiedUrl` so `/watch` does not fall through to `player-error`. Optional unused-component delete only if authored lines stay well under 400.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `tests/unit/routing.test.tsx` | Modified | Remove placeholder TestApp suites |
| `tests/unit/player/player-page.test.tsx` | Modified | Remove origin-URL stub suite |
| `tests/e2e/routing.spec.ts` | Modified | Proxy-aware watch assertions |
| `src/renderer/features/player/PlayerPlaceholder.tsx` | Removed (optional) | Dead component |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| E2E testid swap → `player-error` | High | Mock `getProxiedUrl` + catalog/config |
| Accidental PR #2 inflation | Med | New branch/PR; do not append to PR #2 |
| Deleting `PlayerPlaceholder.tsx` grows the slice | Low | Skip delete if budget tight |

## Rollback Plan

Revert the tests-only PR. Production player and archived F4 specs stay unchanged.

## Dependencies

- `lux-iptv-f4-player` archived (`openspec/changes/archive/2026-08-28-lux-iptv-f4-player/`, commit `d0ce736`, PR #2). Do not land tests against a tree that still mounts a placeholder.

## Success Criteria

- [ ] No local `PlayerPlaceholder` / `TestApp` / `HashRouter routing` suite in `routing.test.tsx`
- [ ] No stub origin-m3u8 `PlayerPage` suite; proxied playback suite remains
- [ ] E2E no longer asserts `player-placeholder`; mock includes `player.getProxiedUrl`
- [ ] `video-player.test.tsx` untouched
- [ ] New PR; PR #2 not updated; authored lines < 400
- [ ] Focused vitest routing + player-page, and Playwright `routing.spec.ts`, pass
