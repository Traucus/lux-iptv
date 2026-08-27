// ─── Player shared types ──────────────────────────────────────────────────────
//
// Single source of truth for player-specific shapes. The `MediaFormat` enum
// is used by:
//   - G1 schema column `media_format` (TEXT, default 'unknown')
//   - G2 M3U/Xtream capture (auto-detected from URL extension)
//   - G5 stream proxy (decision input for header-injection rules)
//   - G6 MediaEngine (engine selection)
//
// Adding a new format here is a one-line change. ADR-0001 defers DASH/TS
// engines to Slice 3; the enum still accepts the values today so future
// content can round-trip through the DB without a migration.

export const MediaFormats = ['hls', 'mp4', 'dash', 'ts', 'unknown'] as const;

export type MediaFormat = (typeof MediaFormats)[number];

/** True when the format is in the deferred-until-Slice-3 bucket. */
export function isDeferredFormat(format: MediaFormat): boolean {
  return format === 'dash' || format === 'ts';
}
