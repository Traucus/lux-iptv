# Proposal: Lux IPTV — Foundation (Pre-Player Gap Closure) v2

## Intent

Two adversarial reviews found 20 gaps (7 CRITICAL + 7 WARNING + 6 NEW) blocking the Video Player. This change closes ALL findings in 7 synergistic work groups, including the player core — making this the complete foundation for playback.

## Scope

### In Scope
- **G1 Schema**: `http_headers` + `media_format` on 4 tables, transactional migration, manual down-migration rollback
- **G2 Capture**: M3U/Xtream header ingestion, media format auto-detection from URL
- **G3 Shell**: Preload path fix, renderer load, IPC consolidation, player channels
- **G4 Quality**: HashRouter, CSP media-src/connect-src/worker-src, player placeholder route
- **G5 Proxy**: Electron `net` header-injecting stream proxy with manifest caching
- **G6 Player**: hls.js engine, VideoPlayer, SeekBar, OSD, live/VOD modes, resume, next-episode
- **G7 Harness**: HTMLMediaElement + hls.js mocks, Playwright fixtures

### Out of Scope
- DASH/TS engines (ADR, Slice 3)
- EPG/Zapping (Slice 3)
- Per-profile history (Slice 5)
- Parental PIN overlay (Slice 4)
- Settings page (Slice 5)

## Capabilities

### New
- `stream-proxy`: Header-injecting proxy via Electron `net`
- `player-core`: hls.js engine, VideoPlayer, SeekBar, OSD, resume, next-episode
- `media-test-harness`: HTMLMediaElement + hls.js mocks

### Modified
- `catalog-schema`: `http_headers` + `media_format` + `content_type` on 4 tables
- `ingestion-pipeline`: M3U `Entry.http` + Xtream headers + format detection
- `desktop-shell`: Preload, renderer, IPC consolidation, player channels
- `frontend-app`: HashRouter, CSP, player route, dead buttons hidden

## Approach

**Wave 0** (parallel): G1 schema + G7 harness. **Wave 1**: G2 capture + G3 shell + G4 quality. **Wave 2**: G5 proxy. **Wave 3**: G6 player (depends on all above). Schema is root dependency; player is terminal goal.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/main/db/schema.ts` + `migrate.ts` | Add columns, wrap in BEGIN/COMMIT |
| `src/main/db/migrations/0001_*.sql` | New Drizzle migration |
| `src/main/services/m3u-client.ts` | Capture `Entry.http` |
| `src/main/services/xtream-client.ts` | Capture stream headers |
| `src/main/services/stream-proxy.ts` | New proxy service |
| `src/main/services/media-engine.ts` | New hls.js wrapper |
| `src/main/index.ts` + `ipc/index.ts` | Wire preload, renderer, IPC |
| `src/preload/index.ts` | Player channels |
| `src/renderer/App.tsx` + `index.html` | HashRouter, CSP |
| `src/renderer/features/player/*` | New: VideoPlayer, SeekBar, OSD, PlayerPage |
| `tests/helpers/media-mock.ts` | New mock harness |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration on existing DB | Low | Additive columns, safe defaults |
| hls.js in Electron | Low | Well-supported; proxy handles CORS |
| Proxy latency | Medium | Manifest caching, short TTL |
| happy-dom limits | Medium | Mocks for unit; real browser for e2e |

## Rollback Plan

Schema: manually authored down migration (DROP COLUMN). Proxy/Player: revert commit. No data loss — all new columns have defaults.

## Dependencies

- Slice 1 complete
- `iptv-m3u-playlist-parser` exposes `Entry.http`
- Electron 20+
- `hls.js` npm package

## Success Criteria

- [ ] `npm run typecheck` passes
- [ ] `npx vitest run` passes (342+ tests, no regression)
- [ ] 4 catalog tables have `http_headers` + `media_format` with defaults
- [ ] M3U captures user-agent/referer from `Entry.http`
- [ ] `CatalogItem` has `content_type` + `media_format`
- [ ] Shell creates window, loads renderer, IPC responds
- [ ] Preload exposes `window.luxAPI` with player channels
- [ ] HashRouter works on `file://`
- [ ] CSP allows media playback
- [ ] Stream proxy injects headers
- [ ] `getNextEpisode` returns correct episode
- [ ] hls.js installed, media engine works
- [ ] Test harness mocks HTMLMediaElement + hls.js
