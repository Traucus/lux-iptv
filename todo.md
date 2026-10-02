# Current work — 2026-10-02

Continuity note only. This file is not an implementation plan and does not authorize product changes.

## Active milestone

Stabilize the desktop player.

FA-17 is not the milestone. The Windows checklist is supporting validation work. It does not redefine the milestone.

## Current checkpoint

Windows HWND / OSD interaction.

This checkpoint is not complete. Windows validation has not passed.

## Already confirmed

- The active milestone is "Stabilize the desktop player."
- HNR-001, HNR-002, HNR-003, and HNR-005 are complete.
- Remote-aligned HEAD when this note was written: `40693cab460824a68cff5bc2811c7d9a615629a5`.

## Unverified

- Windows HWND / OSD interaction, including whether OSD lists can be selected on Windows.
- Vitest and jsdom do not prove Windows clickability.

## Governance constraints

- This note does not authorize product-code writes.
- Product-code changes still require an approved OpenSpec change before implementation.
- This note does not authorize adding product paths to `.harness/policies/current.yml`.
- This note does not authorize rebuilding or modifying libmpv.
- This note does not authorize new features.

## Next human decision

A person must validate the Windows HWND / OSD interaction. Until that result is recorded, the checkpoint stays open. Do not treat this file as permission to implement.
