# ADR-0001 — Defer DASH and raw MPEG-TS engines to Slice 3

- **Status**: SUPERSEDED
- **Date**: 2026-08-27
- **Superseded by**: PLAN-MAESTRO D-10 / D-14 (2026-08-30) — Windows product engine is in-process libmpv
- **Deciders**: Lux IPTV engineering

## Current rule

Do not implement this ADR. Chromium `hls.js` plus native `<video>` is not the Windows happy path. DASH/MPEG-TS browser engines are not a Slice 3 product plan.

libmpv in-process is the decoder for all origin formats on Windows. Historical context below is kept for audit only.

## Historical context (obsolete)

Slice 2 originally shipped hls.js for HLS and native `<video>` for MP4, deferring dash.js and mpegts.js. That product decision was **D-6**, closed by **D-10**.
