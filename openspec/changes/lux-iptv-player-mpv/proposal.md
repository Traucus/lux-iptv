# Proposal: F2 Windows in-process libmpv player

## Intent

Chromium `hls.js` / `<video>` cannot play origin mkv/HEVC/AC3 and fakes `.mp4` URLs. F2 (D-10, D-12, D-14) makes **in-process libmpv** the only happy path in **one Lux window**, with honest Xtream/M3U URLs.

## Scope

### In Scope
- Honest URLs: real extension; `direct_source` when usable; never invent `.mp4`
- In-process libmpv; origin URL + item headers (proxy is not the happy path)
- Diagnosis UI if libmpv fails to load; **no** hls.js / mpegts / `<video>` fallback
- Real audio/subs (`track-list` + Off + load `.srt`/`.ass`)
- Exclusive fullscreen + truthful OSD (later slices of **this** change)
- Dev-loadable libmpv; F7 later bundles the DLL/binding

### First slice
Honest URL + schema + **real in-process mkv play**. Not tracks, fullscreen, or OSD.

### Out of Scope
- Spawn `mpv.exe`, Chromium `--wid`, VLC (rejected D-14)
- Sidecar auto-subs; F3–F7 product work (F2 must load in dev); F8–F14; non-Windows (D-9)
- Next-episode overlay and VOD resume (F5)

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `player-core`: libmpv-only; origin play; load-fail diagnosis; tracks/subs/FS/OSD; REMOVE hls.js, native `<video>` fallback, proxied `src` as product
- `catalog-schema`: `container_extension` + `direct_source`; stop mkv→`media_format=mp4`
- `ingestion-capture`: honest `buildStreamUrl` / episode URLs; `direct_source` wins
- `desktop-shell`: libmpv player IPC; preload stays sandboxed CJS

## Approach

Exploration **(1)**: N-API (or equivalent) libmpv in **main**, child HWND owned by Lux. OSD via IPC. Electron 33 ABI fail → still in-process (native host / rebuilt binding), never spawn-as-product.

Live: `cache=yes`, ~20s, reconnect, `hwdec=auto-safe`. VOD: origin quality. Preload CJS (lesson #711).

Chained PRs (`auto-chain`, 400 lines): (1) URL + mkv play, (2) live/movie/episode, (3) tracks + subs + FS + OSD.

## Affected Areas

- Modified: `xtream-client.ts` (honest URLs), `schema.ts` (new columns), `ipc/handlers/player.ts`, `preload/index.ts` (CJS `luxAPI.player.*`), `renderer/features/player/`, `openspec/specs/player-core/spec.md`

## Risks

- Electron 33 addon ABI fail (High) → in-process host / rebuild; never spawn
- Review >400 lines (High) → chained PRs; first slice URL+mkv
- Preload ESNext silences luxAPI (Med) → keep CJS
- Engram explore #724 still recommends spawn (Med) → filesystem `exploration.md` is D-14

## Rollback Plan

Revert chained PRs. Down-migration drops new columns. Do not re-enable Chromium probe as product.

## Dependencies

In-process `libmpv` DLL/binding loadable in dev; Electron `^33.4.11`; F1 catalog rows present.

## Success Criteria

- [ ] mkv URL ends `.mkv`; `direct_source` wins; missing ext is not `.mp4`
- [ ] In-process libmpv plays that mkv in the Lux window
- [ ] Missing libmpv → diagnosis UI; zero hls/mpegts/native probe
- [ ] Later F2 slices: real aid/sid, Off, external sub, exclusive fullscreen, OSD tooltips
