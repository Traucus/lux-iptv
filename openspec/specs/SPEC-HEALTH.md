# Spec health — current-state index (2026-09-13)

Product truth is `docs/planning/PLAN-MAESTRO.md` (D-10 / D-14). Main OpenSpec files must describe **current intended contract**, not leftover deltas.

Do **not** copy this file or `docs/planning/` into product source PRs.

## Quick path

1. Windows happy path is **in-process libmpv**, one Lux window, **child HWND** of the BrowserWindow. Chromium/hls.js is not the product engine.
2. Chromium GPU stays **off** on Windows/Linux unless `LUX_HW_ACCEL=true`. Decode is libmpv `hwdec=auto-safe`.
3. `/watch/:type/:id` mounts real `PlayerPage`. Settings is the source vault (D-2).
4. Native `lux-libmpv.node` shipped (P0). SDD change `lux-iptv-player-mpv` is **not yet archived**.
5. Open change `lux-iptv-f2-secure-source` is **F3** (vault + refresh), not the player.

## Classes

| Class | Meaning |
| --- | --- |
| CURRENT | Spec matches intended product and code direction. |
| UNMET | Spec is still the intended truth; code does not satisfy it. |
| STALE | Spec describes a superseded slice. |
| CONFLICT | Two specs disagree. Owner decision required. |
| SUPERSEDED | Bootstrap or obsolete snapshot. |
| MISSING | Product need with no live requirement. |
| HISTORICAL | Keep for history; do not implement as current product. |

## Source inventory

| Source | Role | Health |
| --- | --- | --- |
| `docs/planning/*` | Product freeze 2026-08-30 + D-14 HWND clarify 2026-09-13 | CURRENT |
| `openspec/specs/player-core/spec.md` | Live player contract | CURRENT (libmpv + HWND child + GPU off) |
| `openspec/specs/desktop-shell/spec.md` | Shell + Chromium GPU policy | CURRENT for HW accel; other rows still delta-shaped |
| `openspec/specs/media-harness/spec.md` | hls.js test mocks | STALE — not product happy path |
| Other `openspec/specs/*.md` | Still delta-shaped from foundation | Mixed; do not implement STALE rows |
| `openspec/specs/00-initial-spec.md` | sdd-init bootstrap | SUPERSEDED |
| `openspec/config.yaml` | Project card | STALE (Fastify/profiles as current features) |
| `docs/adr/ADR-0001-deferred-engines.md` | hls.js Slice 2 | SUPERSEDED by D-10 |
| `openspec/changes/lux-iptv-player-mpv/` | F2 player | Applied in code + native addon; archive pending |
| `openspec/changes/lux-iptv-f2-secure-source/` | F3 vault/refresh | Live; name is historical |
| `openspec/changes/lux-iptv-mvp/` | Historical ingest/UI | HISTORICAL naming only (D-13) |
| `openspec/changes/lux-iptv-player/` | Chromium player orphan | SUPERSEDED; do not collide with F2 |
| `openspec/changes/archive/` | foundation + f4 | Historical only |

## Closed owner decisions

| ID | Rule | Date |
| --- | --- | --- |
| D-1 | Real player on `/watch`. | 2026-08-28 |
| D-2 | Refresh in chrome; never display saved username/password. Host only. | 2026-08-28 |
| D-10 | Windows engine is in-process libmpv. Supersedes D-6 (hls.js product). | 2026-08-30 |
| D-13 | One product: Lux / Lux Desktop. Stop saying MVP. | 2026-08-30 |
| D-14 | Gold: libmpv in-process. Reject spawned `mpv.exe`, Chromium `--wid` to an external player, VLC. | 2026-08-30 |
| D-14 clarified | Gold embed is a **child HWND of the Lux BrowserWindow**. Chromium GPU off on Windows unless `LUX_HW_ACCEL=true`. | 2026-09-13 |

## Checklist

- [x] D-1 and D-2 recorded as closed (code mounts `PlayerPage`; vault card has no secrets)
- [x] ADR-0001 marked SUPERSEDED
- [x] Main `player-core` rewritten off hls.js
- [x] Native `lux-libmpv.node` shipped on Windows
- [x] HWND child + Chromium GPU-off recorded as D-14
- [x] `lux-iptv-mvp` and `lux-iptv-player` marked historical / superseded
- [x] `media-harness` / hls-client happy path marked STALE
- [ ] Archive `lux-iptv-player-mpv` via SDD archive
- [ ] Rewrite remaining main specs from delta shape to current-state

## Next step

Archive `lux-iptv-player-mpv` (SDD archive). Then F3 chrome refresh on Live/Movies/Series.
