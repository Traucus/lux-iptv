# Archive Report: lux-iptv-f4-player

**Change**: lux-iptv-f4-player
**Archived at**: 2026-08-28
**Archive path**: `openspec/changes/archive/2026-08-28-lux-iptv-f4-player/`
**Mode**: hybrid (OpenSpec filesystem + Engram)
**Status**: complete
**reviewGate**: structurally absent — archive proceeded under ordinary repository policy; `reviewOffer` was an invitation, not a gate. No review topics were read.

## Observation IDs Read

| Artifact | Engram ID | Topic |
|----------|-----------|-------|
| proposal | 674 | `sdd/lux-iptv-f4-player/proposal` |
| spec | 675 | `sdd/lux-iptv-f4-player/spec` |
| design | 676 | `sdd/lux-iptv-f4-player/design` |
| tasks | 677 | `sdd/lux-iptv-f4-player/tasks` |
| verify-report | 682 | `sdd/lux-iptv-f4-player/verify-report` |

apply-progress #678 was listed by search and not retrieved (optional). Review `{transaction,ledger,receipt,gate-context}` topics were not read because `reviewGate` was absent.

## Final-State Authority

Ranked sources at close:

1. Native structured status: artifacts done, 19/19 tasks complete, apply `all_done`, verify `all_done`, archive ready, `reviewGate` absent, `actionContext.mode: repo-local`.
2. Persisted tasks artifact (`tasks.md` + Engram #677): all 19 implementation tasks `- [x]`. Zero unchecked implementation tasks.
3. Orchestrator final-state facts (outrank intermediate snapshots):
   - PR2 + TS2532 + `apply-progress.md` are committed: `30c4e17` and `7e6470b` on `feat/f4-player-core` (= origin). HEAD at archive: `7e6470be`.
   - Verify verdict `pass_with_warnings`, 0 CRITICAL, typecheck exit 0, 96 F4 vitest.
   - Leftover `PlayerPlaceholder` stub tests remain in the tree and are **out of this archive** (owned by later `lux-iptv-f4-close`). Not treated as CRITICAL and not as incomplete F4 tasks.
   - SPEC-HEALTH dirt was restored off tracked specs; this archive did not re-introduce stamps.
4. `verify-report` #682 (2026-08-28 12:43:05) is an intermediate snapshot. At verification time it recorded PR2 + TS2532 as uncommitted on PR1 HEAD `1fe3b51`. That pending claim is **not** final state; later commits `30c4e17` and `7e6470b` closed it.

No unrankable contradiction: repository evidence (`git log` HEAD `7e6470b` / `30c4e17`) corroborates the orchestrator final-state facts.

## Gates

| Gate | Result |
|------|--------|
| Native Review Receipt | PASS — `reviewGate` absent; proceed |
| Task Completion | PASS — 19/19 `- [x]` in `tasks.md` and Engram #677 |
| CRITICAL verification | PASS — 0 CRITICAL (`verify-report` #682) |
| Action context | PASS — `repo-local`; edits stayed inside `/home/traucus/desarrollos_softam/iptv` |
| Untracked isolation | PASS — did not stage or edit `docs/planning/`, `openspec/specs/SPEC-HEALTH.md`, `openspec/changes/lux-iptv-f4-close/` |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| player-core | Updated | 3 added, 0 modified, 0 removed — Proxied Playback And Series Resolve; HLS Abr And Latency Policy; Hero Play Navigates To Movie Watch |
| stream-proxy | Updated | 0 added, 1 modified, 0 removed — Stream Proxy via Electron net Module (relative HLS rewrite) |
| renderer-quality | Updated | 0 added, 1 modified, 0 removed — Player Placeholder Route now always mounts PlayerPage (D-1) |
| desktop-shell | Updated | 0 added, 2 modified, 0 removed — Player IPC Channels (`getSource` metadata-only + `getProxiedUrl`); Hardware Acceleration Configuration (`LUX_HW_ACCEL`) |

No REMOVED/RENAMED requirement blocks. Merge was not destructive. Pre-existing requirements not named in the deltas were preserved.

Main specs now reflecting shipped behavior:

- `openspec/specs/player-core/spec.md`
- `openspec/specs/stream-proxy/spec.md`
- `openspec/specs/renderer-quality/spec.md`
- `openspec/specs/desktop-shell/spec.md`

## Mechanical Archive Evidence

Step 2 (delta → main): merge into existing main specs (not a mechanical copy of full specs).

Step 3 move: `git mv openspec/changes/lux-iptv-f4-player openspec/changes/archive/2026-08-28-lux-iptv-f4-player`

Pre-move recursive snapshot vs archived tree `diff -r` (verbatim; empty = pass):

```
```

Empty `diff -r` (no differences). Source directory gone after move. This `archive-report.md` is additive and was written after the move.

## Archive Contents

- proposal.md
- specs/ (player-core, stream-proxy, renderer-quality, desktop-shell)
- design.md
- tasks.md (19/19 complete)
- apply-progress.md
- verify-report.md
- exploration.md

Active path `openspec/changes/lux-iptv-f4-player/` no longer exists.

## Shipped At Close

- `/watch/:type/:id` always mounts `PlayerPage`; invalid type redirects to `/`.
- Playback `src` is only `player:getProxiedUrl`; `getSource` returns format/live-VOD metadata, not a URL.
- Series `/watch/series/:id` resolves first episode id then proxies `episode`.
- Relative HLS URIs rewrite onto the proxy; segments stream unchanged.
- ABR: `capLevelToPlayerSize` + mid `startLevel`; `lowLatencyMode` live-only.
- Hero Play navigates to `/watch/movie/:id`.
- Linux GPU off unless `LUX_HW_ACCEL=true`, applied in `entry.cjs` before ESM import.
- Commits on `feat/f4-player-core`: PR1 `1fe3b51`; PR2 `30c4e17`; apply-progress on disk `7e6470b`.
- Tests at close (highest-ranked covering source): 96 F4 vitest, typecheck exit 0, 7/7 requirements, 17/17 scenarios.

## Out Of Scope / Deferred

Leftover stub `PlayerPage` / `TestApp`+`PlayerPlaceholder` suites remain in the working tree and belong to later `lux-iptv-f4-close`. They do not reopen F4 tasks.

## Intentional Overrides

None. Full archive. No stale-checkbox reconciliation. No partial archive.
