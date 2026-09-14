# Archive Report: lux-iptv-player-mpv

**Change**: lux-iptv-player-mpv
**Archived at**: 2026-09-13
**Archive path**: `openspec/changes/archive/2026-09-13-lux-iptv-player-mpv/`
**Mode**: hybrid (OpenSpec filesystem + Engram)
**Status**: complete
**HEAD at archive**: `8c6adac` (D-14 HWND child + Chromium GPU-off)
**reviewOffer**: invitation only — not archive state. Archive proceeded under ordinary repository policy.

## Persist-audit (before archive)

```text
PERSIST-AUDIT: PASS (unrelated dirt isolated, not mixed)
change: lux-iptv-player-mpv
HEAD: 8c6adac5c8d781df43fcb1287203198877d15812
unrelated_dirty: .atl/skill-registry.md ; .pi/  (isolated; not edited)
rows:
artifact        | disk | engram | git
proposal        | yes  | #729   | HEAD
spec            | yes  | #731   | HEAD (4 domain deltas)
design          | yes  | #732   | HEAD
tasks           | yes  | #733   | HEAD
apply-progress  | yes  | #736   | HEAD
verify-report   | yes  | #738   | HEAD
lessons         | n/a  | #711   | n/a (pinned)
```

Native status: `artifactStore` reported `openspec`; workspace `openspec/config.yaml` and orchestrator launch declared **hybrid**. Archive followed hybrid (filesystem merge+move AND Engram archive-report). `dependencies.archive: ready`, `nextRecommended: archive`, `taskProgress: 22/22`, `blockedReasons: []`, `actionContext.mode: repo-local`.

## Observation IDs Read

| Artifact | Engram ID | Topic |
|----------|-----------|-------|
| proposal | 729 | `sdd/lux-iptv-player-mpv/proposal` |
| spec | 731 | `sdd/lux-iptv-player-mpv/spec` |
| design | 732 | `sdd/lux-iptv-player-mpv/design` |
| tasks | 733 | `sdd/lux-iptv-player-mpv/tasks` |
| apply-progress | 736 | `sdd/lux-iptv-player-mpv/apply-progress` |
| verify-report | 738 | `sdd/lux-iptv-player-mpv/verify-report` |
| lessons | 711 | `lessons/lux-iptv` (pinned) |

Explore #724 was listed by search and not used as D-14 authority (filesystem exploration + discovery #730: Engram explore still recommended spawn). Review topics were not read; `reviewOffer` is not a gate.

## Final-State Authority

Ranked sources at close:

1. Persisted tasks artifact (`tasks.md` + Engram #733): 22/22 implementation tasks `- [x]`. Zero unchecked implementation tasks.
2. Orchestrator final-state facts (outrank intermediate snapshots), corroborated by `git log` on HEAD `8c6adac`:
   - Native N-API addon shipped: `7a009f2`
   - node-gyp 13 rebuild: `0054a2d`
   - P0 Windows playable HWND child + GPU off + live `.ts`: `47ff592`
   - P1 next-episode / resume duration / Continue Watching: `8167ce4`
   - P2 D-14 clarified (gold embed = child HWND of Lux BrowserWindow; Chromium GPU off on Windows unless `LUX_HW_ACCEL=true`): `8c6adac`
   - In-process libmpv is the product engine. Do not restore `hls-client`/`media-engine` as happy path.
   - Leftover `hls-client`/`media-engine` source stays demoted/STALE (not deleted this archive).
   - `vendor/libmpv` DLL untracked and must not be committed.
   - Do not mix `SPEC-HEALTH.md` or `docs/planning/` into product source.
3. `verify-report` #738 (2026-08-31) is an intermediate snapshot from when this Linux host lacked `LUX_LIBMPV_DIR`. At verification time: verdict `pass_with_warnings`, 0 CRITICAL, 18/18 requirements, 26/26 scenarios, 218/218 Vitest, typecheck exit 0. Its HWND-e2e-skip / partial-HWND claims are **not** final state; later commits `7a009f2`, `0054a2d`, `47ff592`, `8167ce4`, `8c6adac` closed the product gaps they described.

No unrankable contradiction: repository evidence corroborates the orchestrator final-state facts.

Per `verify-report` #738 at verification time (historical, not current blockers): leftover local `<video>` stub describe in `video-player.test.tsx`; stale `getProxiedUrl` comment in `player.ts`. Those were not listed as fixed in final-state facts and are not CRITICAL. They do not reopen tasks.

## Gates

| Gate | Result |
|------|--------|
| Native archive ready | PASS — `dependencies.archive: ready`, `nextRecommended: archive` |
| Task Completion | PASS — 22/22 `- [x]` in `tasks.md` and Engram #733 |
| CRITICAL verification | PASS — 0 CRITICAL (`verify-report` #738); no override |
| Action context | PASS — `repo-local`; edits stayed inside `/home/traucus/desarrollos_softam/iptv` |
| Untracked isolation | PASS — did not edit `.atl/skill-registry.md`, `.pi/`, `SPEC-HEALTH.md`, `docs/planning/`, `vendor/libmpv` |
| D-14 preservation | PASS — player-core HWND child + Chromium GPU-off from `8c6adac` kept byte-for-byte |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| player-core | Kept (compose refused; already canonical) | `sdd-archive-compose` exit 1: `unapplied REMOVED delta for requirement "hls.js Engine with Resilience": no canonical requirement named "hls.js Engine with Resilience"`. Canonical already contains ADDED/MODIFIED F2 requirements plus D-14 HWND child and Chromium GPU Off from `8c6adac`. No manual Read/Edit merge. Canonical file not replaced. |
| catalog-schema | Updated | 3 added, 0 modified, 0 removed — Container Extension And Direct Source Columns; CatalogItem Honest Source Fields; Honest Source Columns Migration |
| ingestion-capture | Updated | 2 added, 0 modified, 0 removed — Honest Stream URL Construction; No Fake Container Coercion |
| desktop-shell | Updated | 2 added, 1 modified, 0 removed — ADDED Preload Remains Sandboxed CommonJS, libmpv Player IPC; MODIFIED Player IPC Channels (`getProxiedUrl` not happy path). Hardware Acceleration Configuration (Windows/Linux GPU off unless `LUX_HW_ACCEL=true`) preserved. |

Compose invocations (zero exit except player-core):

```bash
gentle-ai sdd-archive-compose --canonical "openspec/specs/player-core/spec.md" --delta "openspec/changes/lux-iptv-player-mpv/specs/player-core/spec.md" --output "openspec/specs/player-core/spec.md.compose-tmp"
# exit 1 — stderr as above; no output file written

gentle-ai sdd-archive-compose --canonical "openspec/specs/catalog-schema/spec.md" --delta "openspec/changes/lux-iptv-player-mpv/specs/catalog-schema/spec.md" --output "openspec/specs/catalog-schema/spec.md.compose-tmp"
&& mv "openspec/specs/catalog-schema/spec.md.compose-tmp" "openspec/specs/catalog-schema/spec.md"

gentle-ai sdd-archive-compose --canonical "openspec/specs/ingestion-capture/spec.md" --delta "openspec/changes/lux-iptv-player-mpv/specs/ingestion-capture/spec.md" --output "openspec/specs/ingestion-capture/spec.md.compose-tmp"
&& mv "openspec/specs/ingestion-capture/spec.md.compose-tmp" "openspec/specs/ingestion-capture/spec.md"

gentle-ai sdd-archive-compose --canonical "openspec/specs/desktop-shell/spec.md" --delta "openspec/changes/lux-iptv-player-mpv/specs/desktop-shell/spec.md" --output "openspec/specs/desktop-shell/spec.md.compose-tmp"
&& mv "openspec/specs/desktop-shell/spec.md.compose-tmp" "openspec/specs/desktop-shell/spec.md"
```

No REMOVED/RENAMED applied this archive (player-core REMOVED targets already absent). Merge was not destructive. Unrelated requirements not named in the deltas were preserved.

Main specs now reflecting shipped behavior:

- `openspec/specs/player-core/spec.md` (HWND child + Chromium GPU-off retained from `8c6adac`)
- `openspec/specs/catalog-schema/spec.md`
- `openspec/specs/ingestion-capture/spec.md`
- `openspec/specs/desktop-shell/spec.md`

## Mechanical Archive Evidence

Step 2 (delta → main): native compose for catalog-schema, ingestion-capture, desktop-shell. player-core already canonical; compose wrote nothing.

Step 3 move: `git mv openspec/changes/lux-iptv-player-mpv openspec/changes/archive/2026-09-13-lux-iptv-player-mpv`

Pre-move recursive snapshot vs archived tree `diff -r` (verbatim; empty = pass):

```
```

Empty `diff -r` (no differences). Source directory gone after move. This `archive-report.md` is additive and was written after the move.

## Archive Contents

- proposal.md
- specs/ (player-core, catalog-schema, ingestion-capture, desktop-shell)
- design.md
- tasks.md (22/22 complete)
- apply-progress.md
- verify-report.md
- exploration.md

Active path `openspec/changes/lux-iptv-player-mpv/` no longer exists.

## Shipped At Close

- In-process libmpv in one Lux window is the only happy path. Gold embed is a **child HWND of the Lux BrowserWindow**.
- Chromium GPU off on Windows/Linux unless `LUX_HW_ACCEL=true`. Decode is libmpv `hwdec=auto-safe`.
- Honest Xtream/M3U URLs: real extension; `direct_source` wins; never invent `.mp4`. Schema 0003 `container_extension` + `direct_source`.
- Native N-API addon `lux-libmpv.node` (node-gyp 13). Never `spawn('mpv.exe')`. Diagnosis UI on load failure; zero Chromium probe.
- Live cache ~20s + reconnect; VOD origin quality; tracks/Off/`.srt`/`.ass`; exclusive fullscreen; OSD titles; `/watch/series/:id` → first episode.
- Next-episode overlay, resume duration clock, Continue Watching (`8167ce4`).
- Preload stays sandboxed CommonJS. `getProxiedUrl` is not the happy path.
- Leftover `hls-client` / `media-engine` remain in tree unused/STALE.
- Commits: `9a452f0` honest URLs; `b193d0a` in-process play; `7a009f2` N-API; `0054a2d` node-gyp 13; `47ff592` Windows HWND; `8167ce4` P1; `8c6adac` D-14.

## Out Of Scope / Deferred

- F3 chrome refresh on Live/Movies/Series.
- F7 Windows installer bundling of libmpv DLL (`vendor/libmpv` stays untracked).
- Non-Windows product (D-9).
- SPEC-HEALTH archive-pending checkbox not flipped (this archive did not edit `SPEC-HEALTH.md`, matching f4-player convention).
- Do not commit `.atl/skill-registry.md` or `.pi/`.

## Intentional Overrides

None for incomplete tasks or CRITICAL issues. Full archive. No stale-checkbox reconciliation.

player-core compose refusal treated as already-applied canonical (plus D-14 from `8c6adac`), not as a partial archive and not as a manual merge.
