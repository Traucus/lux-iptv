## Exploration: lux-iptv-f4-player

F4 real playback on `/watch/:type/:id`. Locked: D-1 (always `PlayerPage`), D-6 (hls.js + native MP4 + stream proxy + GPU/ABR). Out of scope: TMDB (F3), EPG (F6), vault (F2), see-all, continue-watching polish except play navigation.

### Current State

Play plumbing exists and is unused.

- `App.tsx` mounts `PlayerPlaceholder` on `/watch/:type/:id`. `PlayerPage` + `VideoPlayer` + `MediaEngine` + `HlsClient` are orphaned.
- `PlayerPage` loads `catalog.getById` and passes the **origin** URL. Comment at line 239 admits the proxy was never wired. `CatalogGetByIdInputSchema` is `live | movie | series` only — `type=episode` fails validation. `TypedLuxAPI` has no `player` namespace even though preload already exposes `player.getSource` / `getProxiedUrl`.
- Stream proxy **is running**: `main/index.ts` starts `StreamProxyService` and `getProxiedUrl` returns `http://127.0.0.1:{port}/proxy/{type}/{id}`. Proxy looks up live/movie/series/episode tables. It buffers the full origin body and does **not** rewrite HLS segment URLs.
- `HlsClient` always sets `lowLatencyMode: true` (wrong for VOD). No `capLevelToPlayerSize`, no `startLevel`. `createMediaEngine` uses native `<video>` only for `mp4`; everything else is hls.js.
- Linux GPU: `entry.cjs` always calls `app.disableHardwareAcceleration()` on linux. `hw-accel.ts` has the `LUX_HW_ACCEL` policy and tests, but `applyHwAccelPolicy` is not implemented and `entry.cjs` never reads the env var.
- Play navigation: Live → `/watch/live/:id`. Movie detail Play → `/watch/movie/:id`. Series Play → `/watch/series/:id`, episode → `/watch/episode/:id`. Dashboard hero Play → `/content/:id` (FL-04 requires `/watch/movie/{id}`). Resume dialog exists but duration is hardcoded `0`; next-episode does not navigate. Those are F5 except hero Play.

Trace: FL-03, FL-04 play parts, T-03. F5 resume/next stay out.

### Affected Areas

- `src/renderer/App.tsx` — swap route element; delete placeholder usage
- `src/renderer/features/player/PlayerPage.tsx` — stop `catalog.getById` origin URL; use player IPC + proxied src
- `src/renderer/lib/api.ts` — add typed `player` (preload already has it)
- `src/renderer/services/hls-client.ts` — VOD vs live HLS config; ABR
- `src/main/entry.cjs` — honor `LUX_HW_ACCEL` instead of always-off
- `src/main/config/hw-accel.ts` — policy exists; needs a CJS-callable apply path
- `src/renderer/features/dashboard/DashboardPage.tsx` — hero Play → `/watch/movie/:id`
- `src/renderer/features/player/PlayerPlaceholder.tsx` — remove from production route (keep only if tests still import)
- `tests/unit/routing.test.tsx` — still asserts placeholder copy
- `src/main/services/stream-proxy.ts` — playability risk (no manifest rewrite; full-body buffer)
- `src/main/ipc/handlers/player.ts` — already correct for F4 if renderer calls it

### Approaches

1. **Unconditional PlayerPage swap** — `/watch/:type/:id` always mounts `PlayerPage`.
   - Pros: Matches D-1; no dual UI; placeholder tests become player tests
   - Cons: Broken play is immediately visible if proxy/ABR lag
   - Effort: Low

2. **Placeholder behind a flag** — keep `PlayerPlaceholder` until a feature flag / env is set.
   - Pros: Safer rollback during wiring
   - Cons: Violates D-1; two routes to maintain; F4 never “done”
   - Effort: Low (wrong)

3. **`catalog.getById` origin URL** — keep current PlayerPage source resolution.
   - Pros: Already written
   - Cons: Episode type invalid; origin URLs skip header injection; violates D-6; CORB/auth headers on renderer
   - Effort: Low (wrong)

4. **`player:getSource` + `player:getProxiedUrl`** — format/headers from getSource; **playback URL only from getProxiedUrl**. Series route resolves first episode id then proxies `episode`.
   - Pros: Matches D-6 and existing IPC; renderer never fetches origin; episode works
   - Cons: Two IPC calls; TypedLuxAPI must grow; series→first-episode mapping stays in PlayerPage
   - Effort: Medium

5. **ABR `capLevelToPlayerSize` + mid start** — `capLevelToPlayerSize: true`; `startLevel` = middle rung after `MANIFEST_PARSED`; `lowLatencyMode` only for live.
   - Pros: Matches T-03 (no max-rung start, UI not frozen >2s); 4K on 1080p display does not decode 4K
   - Cons: First seconds may look soft; need live vs VOD config split
   - Effort: Low

6. **ABR auto max** — hls.js default / start at highest.
   - Pros: Instant “4K” when bandwidth looks high
   - Cons: Violates T-03; Linux software decode will freeze; current `lowLatencyMode: true` makes VOD worse
   - Effort: Low (wrong)

### Recommendation

**Swap the route (1) + proxied playback (4) + capped mid ABR (5).**

Do not flag the placeholder. Do not play origin URLs. Do not start at max rung.

Concrete wiring:

1. `App` imports `PlayerPage`; `/watch/:type/:id` never mounts `PlayerPlaceholder`.
2. Extend `TypedLuxAPI.player` to match preload.
3. `PlayerPage`: `player.getSource({ type, id })` for `mediaFormat` / live vs VOD; `player.getProxiedUrl({ type, id })` for `source.url`. For `type=series`, pick first episode then proxy that episode id.
4. `HlsClient`: `lowLatencyMode: source.type === 'live'`; `capLevelToPlayerSize: true`; on `MANIFEST_PARSED` set `startLevel` to `Math.floor((levels.length - 1) / 2)` then enable auto levels.
5. `entry.cjs`: disable GPU on Linux **unless** `LUX_HW_ACCEL=true` (reuse `shouldDisableHwAccel` logic in CJS — ESM `hw-accel.ts` cannot run before GPU init).
6. Hero Play: `navigate(\`/watch/movie/${featured.id}\`)` — play navigation, in F4.

Leave resume clock, next-episode auto-advance, see-all, TMDB, EPG.

Likely stacked PRs (400-line budget, `auto-chain` / `stacked-to-main`):

- Slice 1: route swap + TypedLuxAPI + PlayerPage proxied src + hero Play
- Slice 2: HLS live/VOD + ABR + Linux GPU policy + tests

### Risks

- Proxy does not rewrite HLS segment URLs and buffers the entire origin response. Relative segments resolve against `127.0.0.1/proxy/...` and 404; large VOD/live may stall. F4 play fails unless Xtream manifests are absolute **or** slice 2 rewrites playlists.
- `type=series` is not a stream row; must resolve an episode id before `getProxiedUrl`.
- Routing tests assert placeholder copy; they will fail on the swap and must be rewritten against `PlayerPage` / `data-testid="video-player"`.
- Linux GPU-on via `LUX_HW_ACCEL` can black-screen; T-03 still requires the override to work. Decode fail must surface player error UI, not a dead window.
- `VideoPlayer` / `HlsClient` have no covering tests on the real modules (player-page tests mock a fake component). Budget risk is High if proxy rewrite lands in the same PR.

### Ready for Proposal

Yes. Orchestrator should tell the user: F4 is a wiring + policy change, not a new player. Swap `/watch` to `PlayerPage`, play only through `player:getProxiedUrl`, ABR starts mid with size cap, Linux GPU follows `LUX_HW_ACCEL`. Next phase is `sdd-propose`. Do not implement yet.
