## Exploration: lux-iptv-f4-close

F4 close-out: isolate SPEC-HEALTH dirt, persist-audit PASS, archive `lux-iptv-f4-player`, kill lying PlayerPlaceholder / origin-src tests. Out: F3 TMDB, EPG, new player features, committing `SPEC-HEALTH.md`.

### Current State

`lux-iptv-f4-player` is 19/19, native `nextRecommended: archive`, `reviewGate` absent, `actionContext.mode: repo-local`. HEAD `feat/f4-player-core` = origin (`1fe3b51` + `30c4e17` + `7e6470b`). GitHub PR #2 OPEN vs `feat/lux-iptv-foundation` (28 files, +1433/−130). Code mounts `PlayerPage` at `/watch/:type/:id` (`App.tsx:38`); `src` is only `player:getProxiedUrl` (`PlayerPage.tsx:131-180`). `PlayerPlaceholder.tsx` is unused.

**Persist-audit `lux-iptv-f4-player` (now):** artifact rows PASS; overall **FAIL** until unrelated dirty is isolated.

| artifact | disk | engram | git |
| --- | --- | --- | --- |
| explore | yes | #673 | HEAD |
| proposal | yes | #674 | HEAD |
| spec | yes | #675 | HEAD |
| design | yes | #676 | HEAD |
| tasks | yes | #677 | HEAD |
| apply-progress | yes | #678 | `7e6470b` |
| verify-report | yes | #682 | `30c4e17` |

`unrelated_dirty`: `.atl/skill-registry.md`, `.gitignore`, `openspec/specs/00-initial-spec.md`, `catalog-schema/spec.md`, `player-core/spec.md`, `renderer-quality/spec.md`, untracked `openspec/specs/SPEC-HEALTH.md`, `docs/planning/`. F4 change folder is clean.

Working-tree stamps on `player-core` / `renderer-quality` still say `/watch` mounts `PlayerPlaceholder` and proxied `src` is UNMET. Archiving into that tree would merge F4 deltas **under those banners**. `SPEC-HEALTH.md` repeats the same stale D-1=A claim. It is **not** required for a clean archive; committing it would fight the F4 merge.

F4 delta already replaces D-1: `renderer-quality` MODIFIED `Player Placeholder Route` → always `PlayerPage`. After isolate + archive, that merge **is** spec-truth for `/watch`. Do not rewrite the whole health matrix in this close.

Verify #682 `pass_with_warnings` leftover-stub WARNINGs still match disk. Its “PR2 uncommitted” note is stale (HEAD has PR2 + apply-progress).

### Affected Areas

- `openspec/specs/player-core/spec.md` — revert SPEC-HEALTH stamp; archive then ADDs proxied playback / ABR / hero Play
- `openspec/specs/renderer-quality/spec.md` — revert stamp; archive MODIFIES `Player Placeholder Route`
- `openspec/specs/desktop-shell/spec.md` / `stream-proxy/spec.md` — archive MODIFIED IPC + HLS rewrite (clean HEAD; no dirt)
- `openspec/specs/00-initial-spec.md`, `catalog-schema/spec.md` — revert only; not F4 merge targets
- `openspec/specs/SPEC-HEALTH.md`, `docs/planning/` — leave untracked; do not stage
- `.gitignore`, `.atl/skill-registry.md` — revert; not F4
- `openspec/changes/lux-iptv-f4-player/` — native archive move
- `tests/unit/routing.test.tsx` — local `PlayerPlaceholder` + `TestApp` (`73-195`) still assert placeholder; keep `App.tsx router selection` + `App /watch mounts PlayerPage` (`207-271`)
- `tests/unit/player/player-page.test.tsx` — stub `PlayerPage` (`52-182`) hardcodes `https://example.com/*.m3u8|mp4`; keep `PlayerPage proxied playback` (`203+`)
- `tests/e2e/routing.spec.ts` — Playwright still asserts `player-placeholder` + “Player coming in PR 5”; mock has no `player.getProxiedUrl` / `config.hasSource` (swap-testid alone will fail → `player-error`)
- `src/renderer/features/player/PlayerPlaceholder.tsx` — unused; F4 task 2.6 kept it. Optional delete in the test PR only, not archive
- `tests/unit/player/video-player.test.tsx` — `example.com` is organism fixture `src`, not PlayerPage origin contract; **out**

### Approaches

1. **Archive-only + tiny test PR (recommended)** — Isolate dirt (no commit) → persist-audit PASS → native `sdd-archive` of `lux-iptv-f4-player` (spec merge + `git mv` on clean HEAD) as a small commit on `feat/f4-player-core` or stacked PR #3 → then `lux-iptv-f4-close` apply is tests-only.
   - Pros: Matches persist-audit + archive gates; F4 merge hits clean specs; PR review split (OpenSpec vs tests); `lux-iptv-f4-close` DAG is not “archive another change”
   - Cons: Two landings; PR #2 still open and already over the 400-line budget
   - Effort: Low (ops) + Low (tests ~150–250 authored lines)

2. **One SDD change wrapping archive + tests** — `lux-iptv-f4-close` apply does dirt isolate, archive F4, and rewrite tests in one cycle.
   - Pros: Single named close-out
   - Cons: Mixes `sdd-archive` authority with `sdd-apply`; one PR grows #2 further; archive blocked while tests are dirty unless carefully ordered
   - Effort: Medium (process risk, not code)

### Recommendation

Use **approach 1**.

**Revert (restore HEAD, do not commit):**

- `openspec/specs/00-initial-spec.md`
- `openspec/specs/catalog-schema/spec.md`
- `openspec/specs/player-core/spec.md`
- `openspec/specs/renderer-quality/spec.md`
- `.atl/skill-registry.md`
- `.gitignore` (the `.atl/` ignore is unrelated and would hide future registry files)

**Keep untracked / do not stage:**

- `openspec/specs/SPEC-HEALTH.md` — stale vs F4; not needed for archive
- `docs/planning/` — master-planning, not F4

**Keep (already in HEAD):** entire `openspec/changes/lux-iptv-f4-player/` including `apply-progress.md`.

**Lying tests to kill or rewrite:**

| File | Action |
| --- | --- |
| `tests/unit/routing.test.tsx` | Delete local `PlayerPlaceholder`, `TestApp`, and `describe('HashRouter routing')`. Keep production App suites. |
| `tests/unit/player/player-page.test.tsx` | Delete stub `function PlayerPage` + `describe('PlayerPage')` (lines 45–182). Keep `describe('PlayerPage proxied playback')`. |
| `tests/e2e/routing.spec.ts` | Kill or rewrite: assert `video-player` / loading / error; extend `luxAPI` mock with `player.getProxiedUrl` + catalog item. Do not only rename the testid. |

Do not treat `video-player.test.tsx` as lying. Do not delete `PlayerPlaceholder.tsx` during archive.

### Risks

- Archiving with current dirt merges F4 under PlayerPlaceholder UNMET banners (judges). persist-audit: isolate first.
- Archive while PR #2 is open appends spec merge + folder move to an already oversized review (`+1433`). Prefer a stacked OpenSpec-only commit/PR, not mixing tests into #2.
- Merging PR #2 **without** archive leaves `feat/lux-iptv-foundation` with F4 code and main specs still requiring a placeholder.
- E2E rewrite needs a real player IPC mock; naive testid swap fails.
- `reviewOffer` is available; `reviewGate` absent — archive is allowed, not blocked. Do not start review as part of this close.
- `.gitignore` `.atl/` is unrelated; reverting it avoids hiding `.atl/skill-registry.md` later.

### Ready for Proposal

Yes — with sequencing: orchestrator must isolate dirt, confirm persist-audit PASS, and run native archive of `lux-iptv-f4-player` **before** `sdd-apply` on `lux-iptv-f4-close`. The proposal for `lux-iptv-f4-close` should scope **lying tests only** (optional unused `PlayerPlaceholder.tsx` delete). Tell the user: do not commit `SPEC-HEALTH.md`; F4 archive on clean HEAD is the spec-truth for D-1.
