# Proposal: F4 Real Player

## Intent

`/watch` mounts `PlayerPlaceholder`; `PlayerPage` plays origin URLs. F4 closes D-1, D-6, FL-03, FL-04 play, T-03: always PlayerPage, proxied src only, mid ABR + size cap, Linux GPU honors `LUX_HW_ACCEL`.

## Scope

### In Scope

- Unconditional `/watch/:type/:id` → PlayerPage (no flag)
- `TypedLuxAPI.player` matching preload
- `player:getSource` for format / live vs VOD; playback URL **only** from `player:getProxiedUrl`
- `type=series` → first episode, then proxy `episode`
- HLS playlist rewrite so relative segments stay on the proxy; stream origin bodies
- ABR: `capLevelToPlayerSize`; mid `startLevel` after `MANIFEST_PARSED`; `lowLatencyMode` live-only
- Linux GPU off unless `LUX_HW_ACCEL=true` (CJS before `app.ready`)
- Hero Play → `/watch/movie/:id`; routing tests vs `video-player`

### Out of Scope

- TMDB (F3), EPG (F6), vault (F2), mpv
- Resume clock, next-episode auto-advance, see-all (F5)
- DASH/raw TS (ADR-0001)

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `player-core`: mount PlayerPage; proxied src only; series→episode; ABR mid+cap; live-only lowLatency; hero Play
- `stream-proxy`: rewrite relative HLS URIs through proxy; stream bodies
- `renderer-quality`: Player Placeholder Route superseded (D-1 = PlayerPage)
- `desktop-shell`: `getSource` is format/metadata, not playback URL

## Approach

Adopt exploration 1+4+5. No placeholder flag. No origin URL. HLS rewrite is **in this change**. Stacked-to-main: slice 1 route+IPC+hero; slice 2 rewrite+ABR+GPU. **Play is not done until relative HLS manifests work through the proxy.**

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `App.tsx`, `api.ts`, `PlayerPage.tsx` | Modified | Route swap, typed player, proxied src |
| `hls-client.ts`, `stream-proxy.ts` | Modified | Live/VOD ABR; HLS rewrite + stream |
| `entry.cjs`, `DashboardPage.tsx`, `routing.test.tsx` | Modified | `LUX_HW_ACCEL`; hero Play; PlayerPage tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Relative HLS 404 without rewrite | High | Slice 2 rewrite; F4 incomplete until then |
| `series` is not a stream row | Med | Resolve first episode before proxy |
| Linux GPU black-screen | Med | Player error UI, not dead window |
| Review >400 lines | High | Stack slice 1 then slice 2 |

## Rollback Plan

Revert F4 PRs newest-first. No migration. Placeholder remount does not change D-1.

## Dependencies

- `StreamProxyService` + `player:getSource` / `player:getProxiedUrl` IPC and preload
- D-1 = PlayerPage; D-6 locked

## Success Criteria

- [ ] `/watch` always PlayerPage; renderer never fetches origin stream URL
- [ ] Live, movie, episode play via proxy; series plays first episode
- [ ] Relative HLS manifests and segments succeed through the proxy
- [ ] ABR starts mid, capped to player size; `lowLatencyMode` live-only
- [ ] Hero Play → `/watch/movie/:id` (FL-04)
- [ ] Linux GPU off by default; `LUX_HW_ACCEL=true` leaves it on
