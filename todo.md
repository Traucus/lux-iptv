# Paso 2 — lint debt (37 errors)

## G4 closed — test lint debt

- [x] Open `current.yml` for test files over 300 lines / `any` / unused
- [x] Remove `eslint-disable max-lines` by splitting suites (stream-proxy, ipc-player-channels, media-engine, hls-client)
- [x] Keep classic JSX `import React` in scope without unused-vars disables
- [x] Lint 0 errors + `npx vitest run` (767)
- [ ] Exclusive commit + restore harness-only allowlist

## G3.6 closed — `38bfa75` (last product max-lines file)

- [x] Open `current.yml` for ingest-worker + `ingest-worker/**`
- [x] Split into types / persist / messages / pipeline + facade
- [x] Lint + `npx vitest run` (767)
- [x] Exclusive commit + restore harness-only allowlist

## G3.5 closed — `9af02dc`

- [x] Open `current.yml` for catalog.ts + `catalog/**`
- [x] Split into types / mappers / series / errors + facade
- [x] Lint + `npx vitest run` (767)
- [x] Exclusive commit + restore harness-only allowlist

## G3.4 closed — `e99ea2f`

- [x] Open `current.yml` for xtream-client + `xtream-client/**`
- [x] Split into types / http / urls / auth / catalogs / series-info + facade
- [x] Lint + `npx vitest run` (767)
- [x] Exclusive commit + restore harness-only allowlist

## G3.3 closed — `165cab2`

- [x] Open `current.yml` for VideoPlayer + `video-player/**`
- [x] Split into types / hook / osd / overlays + facade `<300`
- [x] Lint + `npx vitest run` (767)
- [x] Exclusive commit + restore harness-only allowlist

Evidence: `npm run lint` — 0 errors, 37 warnings (`no-console` out of this paso).

## Sequence (one allowlist group at a time)

1. **G1:** `src/main/db/sqljs-adapter.ts` — closed `280f511`
2. **G2:** `src/renderer/lib/tv-space-nav-shim.ts` — closed `e70106e`
3. **G3:** product `max-lines` — closed through ingest-worker `38bfa75`
4. **G4:** tests (`any`, unused, max-lines, fixtures) — ready to commit
