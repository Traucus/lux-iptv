# ADR-0001 — Defer DASH and raw MPEG-TS engines to Slice 3

- **Status**: Accepted
- **Date**: 2026-08-27
- **Deciders**: Lux IPTV engineering
- **Slice**: Foundation + Player (Slice 2)
- **Related**: `design.md §9 Key Decisions`, `design.md §7.2 MediaEngine`

## Context

The Lux IPTV player needs to play a mix of HLS, MP4, raw MPEG-TS, and DASH
manifests. Slice 2 ships the full player experience (hls.js engine, OSD, seek,
resume, next-episode). We need to decide which engine(s) ship in Slice 2
versus what is deferred.

The IPTV-content reality:

- **HLS** is by far the most common container. Almost every modern IPTV
  provider packages streams as HLS, often with fMP4 segments.
- **MP4** is common for VOD assets.
- **Raw MPEG-TS** over HTTP is rare in modern providers; most TS content is
  also packaged as HLS-TS (HLS playlist pointing at `.ts` segments).
- **DASH** is rare in residential IPTV; it is mostly a telco / OTT
  provider format.

Three competing libraries:

| Library  | Footprint | Formats                  | Status                                    |
| -------- | --------- | ------------------------ | ----------------------------------------- |
| hls.js   | ~250KB    | HLS (TS + fMP4)          | Mature, renderer-only                     |
| dash.js  | ~500KB    | DASH                     | Heavy, complex API                        |
| mpegts.js| ~150KB    | Raw MPEG-TS              | Niche; only useful for `.ts` direct URLs  |
| shaka    | ~500KB    | HLS + DASH + MSS         | Heavy; would replace hls.js               |

## Decision

For Slice 2 we ship:

- **hls.js** as the universal renderer engine for `hls`, `dash`, `ts`, and
  `unknown` media formats. hls.js natively demuxes HLS (TS or fMP4); for
  `.ts` URLs that arrive without an HLS manifest, hls.js is the only sane
  browser-side path without bundling mpegts.js.
- **Native `<video>`** for `mp4` (browser handles it directly, no library
  overhead, hardware acceleration path is cleanest).

DASH and raw MPEG-TS are **deferred to Slice 3**. Slice 3 will add:

- `dash.js` as an opt-in engine for `media_format === 'dash'`.
- `mpegts.js` as a fallback when `media_format === 'ts'` and hls.js cannot
  parse a transport stream (rare; usually means non-HLS `.ts`).

## Rationale

1. **Content reality**: HLS covers the dominant 95%+ case. We are not
   blocking real user content with this decision.
2. **Bundle budget**: hls.js + native is ~250KB. Adding dash.js + mpegts.js
   for Slice 2 is +650KB of mostly unused code. Deferring keeps the renderer
   payload small and the `npm run build:renderer` time under control.
3. **Engine surface area**: Slice 2 already adds `MediaEngine`, the
   resilience loop, the hls.js wrapper, the OSD, the seek bar, and the
   resume store. Adding two more engine implementations compounds
   integration risk.
4. **Clean extension point**: `MediaEngine` already switches on
   `mediaFormat`. Slice 3 can drop in `DASHEngine` + `MpegTsEngine` without
   touching Slice 2 code paths.

## Consequences

**Positive**

- Smaller renderer bundle for Slice 2.
- One well-understood engine (hls.js) to harden resilience for.
- `mediaFormat` enum is already wired in G1 (`media_format` column) and
  the renderer, so Slice 3 can ship without a migration.

**Negative**

- A user with a raw DASH playlist will see a clear error today ("DASH
  support is coming in Slice 3"). Acceptable because the count is small
  and the failure mode is explicit, not silent.
- If we discover a major provider ships DASH-only content, we will need to
  promote the deferred work. The trigger is "≥5% of catalog rows are DASH".

## Reversibility

This is a deferral, not a removal. Slice 3 plan already includes the
two engines. The `mediaFormat` enum (`hls | mp4 | dash | ts | unknown`) is
forward-compatible — no schema change required.

## References

- `design.md` §2 G1 — `media_format` column shape
- `design.md` §7.2 — `MediaEngine` engine-selection logic
- `design.md` §9 — Key Decisions table
