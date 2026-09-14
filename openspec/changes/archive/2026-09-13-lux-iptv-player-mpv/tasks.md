# Tasks: F2 Windows in-process libmpv player

## Review Workload Forecast

Estimated changed lines: 1400–2100. Delivery strategy: auto-chain. Suggested split: PR 1 → PR 2 → PR 3.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | URL+schema+mkv play | PR 1; FBC base `feat/lux-iptv-player-mpv` | `npx vitest run tests/unit/xtream-client.test.ts tests/unit/player/libmpv-engine.test.ts tests/integration/ipc-player-channels.test.ts` | `npx playwright test tests/e2e/player-playback.spec.ts` (skip without DLL) | `0003_*`, `libmpv-*`, play IPC/UI; down drops new cols |
| 2 | live/movie/episode | PR 2; FBC base = PR 1 branch | `npx vitest run tests/unit/player/player-page.test.tsx tests/unit/routing.test.tsx` | live, movie, `/watch/series/7` → ep 101 | PlayerPage/routing/live cache |
| 3 | tracks/FS/OSD | PR 3; FBC base = PR 2 branch | `npx vitest run tests/unit/player/video-player.test.tsx tests/unit/player/seek-bar.test.tsx` | aid 2; Off; `.srt`/`.ass`; exclusive FS; live −10s off | OSD/track/FS files |

Threat VCS/docs N/A. Process RED: 1.9.

## Phase 1: Slice 1 URL + schema + mkv play

- [x] 1.1 RED `tests/unit/xtream-client.test.ts` + `tests/unit/m3u-client.test.ts`: `.mkv`; `direct_source` wins; missing ext not `.mp4`.
- [x] 1.2 GREEN `src/main/services/xtream-client.ts` + `src/main/services/m3u-client.ts`: drop `?? 'mp4'`.
- [x] 1.3 RED `tests/unit/detect-media-format.test.ts`: mkv → `unknown`. GREEN `src/main/ipc/handlers/catalog.ts` `detectMediaFormat`.
- [x] 1.4 RED `tests/integration/migrate.test.ts` + `tests/integration/migration-atomicity.test.ts` + `tests/integration/down-migration.test.ts`: 0003 up 4 tables; down drops those cols only.
- [x] 1.5 GREEN `src/main/db/migrations/0003_add_container_extension_and_direct_source.sql` + `_down.sql`; `src/main/db/schema.ts`; `src/main/db/repo.ts`.
- [x] 1.6 RED `tests/integration/catalog-handler.test.ts` + `tests/integration/schema-columns.test.ts`: DTO `containerExtension`/`directSource`. GREEN `src/shared/types/ipc.ts`, `src/main/workers/ingest-worker.ts`.
- [x] 1.7 RED threat `tests/unit/player/libmpv-engine.test.ts`: `{kind:'libmpv-load-failed'}`; never `spawn('mpv.exe')`; origin+headers; no Chromium probe.
- [x] 1.8 GREEN `src/main/player/libmpv-binding.ts` + `src/main/player/libmpv-engine.ts` (N-API; in-process FFI; never spawn).
- [x] 1.9 RED `tests/integration/ipc-player-channels.test.ts`: `player:play` origin; `getSource` no url; `getProxiedUrl` not required.
- [x] 1.10 GREEN `src/shared/schemas/player.ts`, `src/main/ipc/handlers/player.ts`, `src/main/ipc/index.ts`.
- [x] 1.11 RED `tests/integration/preload.test.ts`: `luxAPI.player.play`/`stop`; `tsconfig.preload.json` stays CommonJS. GREEN `src/preload/index.ts`, `src/renderer/lib/api.ts`.
- [x] 1.12 RED `tests/unit/player/player-page.test.tsx` + `tests/unit/player/video-player.test.tsx` + `tests/unit/player/engine-fallback.test.ts`: play IPC not `getProxiedUrl`; diagnosis UI; no hls/mpegts/`<video>`; unmount stops.
- [x] 1.13 GREEN `src/renderer/features/player/PlayerPage.tsx` + `src/renderer/components/organisms/VideoPlayer.tsx`; leave `src/renderer/services/media-engine.ts` unused.
- [x] 1.14 E2E `tests/e2e/player-playback.spec.ts` mkv in Lux window (skip without DLL). `tsc --noEmit`.

## Phase 2: Slice 2 live / movie / episode

- [x] 2.1 RED `tests/unit/player/player-page.test.tsx` + `tests/unit/routing.test.tsx`: live/movie/episode; `/watch/series/7` → ep 101 not 102.
- [x] 2.2 GREEN `src/renderer/features/player/PlayerPage.tsx` + engine: live `cache=yes` `cache-secs=20` reconnect `hwdec=auto-safe`; VOD origin quality.
- [x] 2.3 RED+GREEN `tests/integration/ipc-player-channels.test.ts` / `src/main/ipc/handlers/player.ts`: `player:play` `{type,id}` origin+headers.

## Phase 3: Slice 3 tracks / FS / OSD

- [x] 3.1 RED `tests/unit/player/video-player.test.tsx`: aid 2; Off subs; `.srt`/`.ass` selectable. GREEN `track-list` + `sub-add`.
- [x] 3.2 RED `tests/unit/player/seek-bar.test.tsx`: drag 50%→75%; D-Pad +10s; buffered 60%. GREEN SeekBar → libmpv.
- [x] 3.3 RED `tests/unit/player/osd-auto-hide.test.ts` + `tests/unit/player/video-player.test.tsx`: exclusive FS; Escape; live −10s off; OSD `title`.
- [x] 3.4 GREEN exclusive `setFullScreen` + OSD chrome.

## Phase 4: Cleanup

- [x] 4.1 Preload CJS; no Chromium probe; no SPEC-HEALTH in product PRs.
