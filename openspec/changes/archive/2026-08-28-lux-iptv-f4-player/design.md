# Design: F4 Real Player

## Technical Approach

Wire existing `PlayerPage` / `VideoPlayer` / `HlsClient` / `StreamProxyService`. `/watch/:type/:id` always mounts `PlayerPage` (D-1). `TypedLuxAPI.player` matches preload. Playback `src` is only `player:getProxiedUrl`. `getSource` returns format + live/VOD metadata, never a URL. `type=series` takes first episode id (catalog payload ids only) then proxies `episode`. Slice 2 rewrites relative HLS URIs onto the proxy, streams segment bodies, applies mid ABR + size cap, and honors `LUX_HW_ACCEL` in `entry.cjs`. Play is not done until relative HLS works through the proxy.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| Route | Flag vs always `PlayerPage` | dual UI vs broken play visible | Always `PlayerPage`; invalid type → `/` |
| Playback URL | Origin / `getSource.url` / proxy | CORB + D-6 fail vs extra IPC | `getProxiedUrl` only; no origin fallback |
| `getSource` | Full `PlaybackSource` vs meta | leaks origin vs two calls | `{ type, id, mediaFormat }` — no `url` |
| Series | New IPC vs page resolve | extra channel vs existing `getById` | Page uses first episode **id**, then proxy `episode` |
| HLS rewrite | Absolute origin vs `?u=` on proxy | skips headers vs SSRF | Relative → `/proxy/{type}/{id}?u=`; same-origin http(s) only |
| Bodies | Buffer all vs stream segments | stall vs extra branches | Manifests buffer+rewrite; segments pipe |
| ABR | Max / auto / mid+cap | T-03 freeze vs soft start | `capLevelToPlayerSize`; mid `startLevel` after `MANIFEST_PARSED`; `lowLatencyMode` live-only |
| GPU | ESM `hw-accel.ts` vs CJS | ESM too late vs duplication | Same predicate in `entry.cjs` before `import('./index.js')` |
| PRs | One PR / stacked-to-main | >400 lines vs two reviews | Two stacked PRs; F4 incomplete after slice 1 |

## Data Flow

    Hero Play ──→ /watch/movie/:id
    App ──→ PlayerPage
         invalid type → /
         series → catalog.getById → first episode id (ignore episode.url)
         getSource(type,id) → mediaFormat (no url)
         getProxiedUrl(type,id) → http://127.0.0.1:{port}/proxy/{type}/{id}
         fail → error UI (`data-testid="player-error"`); origin never src
         VideoPlayer → createMediaEngine → HlsClient | native <video>
    HlsClient GET proxy
         playlist → rewrite relative URI / URI= → ?u=
         ?u= resolve vs catalog origin; reject cross-origin
         segment → stream unchanged
    entry.cjs (before ESM): Linux GPU off unless LUX_HW_ACCEL=true

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/main/services/hls-rewrite.ts` | Create | Pure playlist rewrite + same-origin resolve |
| `tests/unit/hls-rewrite.test.ts` | Create | Relative URI → proxy; absolute unchanged; reject other origin |
| `src/renderer/App.tsx` | Modify | Mount `PlayerPage`; drop placeholder import |
| `src/renderer/lib/api.ts` | Modify | Add `player` matching preload |
| `src/renderer/features/player/PlayerPage.tsx` | Modify | Proxy src; series→episode id; no origin fallback |
| `src/main/ipc/handlers/player.ts` | Modify | `getSource` omits `url` / headers |
| `src/renderer/features/dashboard/DashboardPage.tsx` | Modify | Hero Play → `/watch/movie/:id` |
| `tests/unit/routing.test.tsx` | Modify | Assert `video-player`; no placeholder |
| `tests/unit/player/player-page.test.tsx` | Modify | Real page + mocked `luxAPI` |
| `tests/integration/ipc-player-channels.test.ts` | Modify | `getSource` has no `url` |
| `src/main/services/stream-proxy.ts` | Modify | `?u=` route; rewrite manifests; stream segments |
| `src/renderer/services/hls-client.ts` | Modify | ABR + live-only lowLatency |
| `src/renderer/services/media-engine.ts` | Modify | Pass `live: source.type === 'live'` |
| `src/main/entry.cjs` | Modify | Honor `LUX_HW_ACCEL` |
| `tests/unit/stream-proxy.test.ts` | Modify | Rewrite + stream RED |
| `tests/unit/player/hls-client.test.ts` | Modify | Hit real `HlsClient` ABR/latency |
| `tests/integration/shell-hw-accel.test.ts` | Modify | Assert `entry.cjs` matches policy |
| `src/renderer/features/player/PlayerPlaceholder.tsx` | Keep | Unused after slice 1 |

Delete: none.

## Interfaces / Contracts

```ts
type PlayerSourceMeta = { type: CatalogType; id: number; mediaFormat: MediaFormat };
// getProxiedUrl → { url: `http://127.0.0.1:${port}/proxy/${type}/${id}` }
// PlaybackSource.url is that proxy URL only. No httpHeaders on renderer src.
// HlsClientOptions.live?: boolean  // lowLatencyMode iff true
```

`getSource(series)` is unused for playback. Manifest detect: listed HLS content-types, `.m3u8`/`.m3u`, or body `#EXTM3U`. Rewrite URI lines and `URI=` on `EXT-X-KEY` / `EXT-X-MAP` / `EXT-X-MEDIA`. Nested playlists rewrite again.

## Testing Strategy

Strict TDD, `vitest`. No Playwright in F4.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Route mounts PlayerPage; invalid type `/` | `routing.test.tsx` + App/QueryClient mocks |
| Unit | Proxied src; no origin; series episode 101; proxy fail → error UI | Real `PlayerPage`, mock `luxAPI` |
| Unit | Hero Play → `/watch/movie/42` | `DashboardPage` |
| Unit | Relative HLS rewrite; cross-origin `?u=` rejected | `hls-rewrite.test.ts` |
| Unit | Manifest rewrite + segment not fully buffered | `stream-proxy.test.ts` |
| Unit | 5 levels: cap + startLevel not highest; live LL on, VOD off | Real `HlsClient` + hls.js mock |
| Unit | Linux GPU off; `LUX_HW_ACCEL=true` leaves on | Policy + `entry.cjs` source |

## Threat Matrix

Skill matrix is VCS/shell/executable classification, not React or stream-proxy HTTP.

| Boundary | Applicability |
|----------|----------------|
| Documentation-like paths | N/A — no executable-file classification |
| Git repository selection | N/A — no git cwd/path selection |
| Commit state | N/A — no commit automation |
| Push state | N/A — no push automation |
| PR commands | N/A — no PR command composition |

No threat-matrix RED tasks. Same-origin `?u=` is an application SSRF guard, not a matrix row.

## Migration / Rollout

No migration. Revert newest F4 PR first.

**Review (400-line budget, `auto-chain` / `stacked-to-main`): High.** Play is not done until slice 2.

1. **Route + IPC + hero** — `App`, `api.ts`, `PlayerPage` proxied src, `getSource` meta, hero Play, routing/player-page/ipc tests. Placeholder unused.
2. **HLS rewrite + ABR + GPU** — `hls-rewrite.ts`, proxy stream, `HlsClient` ABR, `entry.cjs`, rewrite/hls/hw tests.

If a slice still exceeds 400, split slice 1 into route/API then PlayerPage src.

## Open Questions

- None blocking. Absolute playlist URIs stay origin (spec requires relative only).
