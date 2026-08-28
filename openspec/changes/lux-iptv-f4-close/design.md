# Design: F4 Close — Spec-True Player Tests

## Technical Approach

Tests-only alignment with archived F4 (`d0ce736`). Production already mounts `PlayerPage` at `/watch/:type/:id` (`App.tsx:38`) and sets `src` only from `player.getProxiedUrl` (`PlayerPage.tsx:131–180`). Unit/E2E doubles still assert `PlayerPlaceholder` and origin m3u8, so green CI lies. Delete those doubles; rewrite Playwright so the mock can reach `video-player`. Zero product deltas. Do not create `openspec/changes/lux-iptv-f4-close/specs/{domain}/`.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Lying unit suites | Rewrite stubs vs delete | Rewrite duplicates kept proxied/App suites | **Delete** local `PlayerPlaceholder`/`NavTarget`/`TestApp` and `describe('HashRouter routing')` (`routing.test.tsx` ~68–195). **Delete** stub `PlayerPage` + `describe('PlayerPage')` (`player-page.test.tsx` ~36–182). Keep hash `beforeEach`/`afterEach`, `App.tsx router selection`, `App /watch mounts PlayerPage`, `PlayerPage proxied playback`. |
| E2E watch | Testid swap vs proxy-complete mock | Current `getById → { data: null }` and no `player` namespace → `player-error` | **Extend** namespaced `luxAPI` (same shape as `TypedLuxAPI` / other e2e specs): catalog item, `player.getSource` + `getProxiedUrl`, `config.hasSource`. Assert `video-player`; `player-placeholder` count 0; happy path not `player-error`. |
| `PlayerPlaceholder.tsx` | Delete now vs skip | Unused (~69 lines); unit+e2e deletes already ~270+ | **Skip unless** after test edits authored add+del < 320. Not required for CI truth. |
| Delivery | Append PR #2 vs new PR | PR #2 already has archive `d0ce736` (+1433) | **New branch from `feat/f4-player-core@d0ce736`**, new PR, tests-only diff. Do not push onto PR #2. Do not target `master` until it mounts `PlayerPage`. |
| `video-player.test.tsx` | Touch vs leave | `example.com` is organism fixture, not PlayerPage origin | **Untouched** |

## Data Flow

    Playwright addInitScript(luxAPI) → Vite App HashRouter → PlayerPage
         │
         ├─ catalog.getById
         ├─ player.getSource          (format/live meta only)
         └─ player.getProxiedUrl      (playback src; never origin)
                    │
                    ├── item + proxy OK → video-player
                    ├── in flight       → player-loading
                    └── null / no IPC   → player-error   ← current E2E trap

E2E mounts the real `VideoPlayer` (`data-testid="video-player"`). A fake `http://127.0.0.1/proxy/{type}/{id}` URL is enough; do not assert HLS playback. Invalid type: `PlayerPage` navigates `/`; dashboard needs `config.hasSource` + `catalog.list` so `getByLabel('Home')` still works.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `tests/unit/routing.test.tsx` | Modify | Drop helpers + `HashRouter routing`. Drop unused `HashRouter`/`Routes`/`Route`/`Navigate`/`useParams`/`useLocation` imports. Keep mocks (`getProxiedUrl` already present), hash reset, App suites. Rewrite file header (no REQ-NAV placeholder). |
| `tests/unit/player/player-page.test.tsx` | Modify | Drop stub + origin suite. Keep hoisted `mockApi`, `ORIGIN`, `RealPlayerPage`, `renderWatch`, proxied suite. Drop unused `act` / fake timers. |
| `tests/e2e/routing.spec.ts` | Modify | Keep three cases (movie hash, series reload, invalid type). Input-aware `getById`: movie 42; series 100 returns first episode. No `player-type` / “PR 5” copy. |
| `src/renderer/features/player/PlayerPlaceholder.tsx` | Optional delete | No production importers. Budget-gated. |
| `tests/unit/player/video-player.test.tsx` | None | Out of scope. |

## Interfaces / Contracts

No new production types. E2E mock must be nested `TypedLuxAPI`, not IPC channel strings.

```ts
player: {
  getSource: async (i) => ({ data: { type: i.type, id: i.id, mediaFormat: 'hls' } }),
  getProxiedUrl: async (i) => ({ data: { url: `http://127.0.0.1:9/proxy/${i.type}/${i.id}` } }),
  reportError: async () => ({ data: undefined }),
  reportProgress: async () => ({ data: undefined }),
  getNextEpisode: async () => ({ data: null }),
},
config: { hasSource: async () => ({ data: { configured: false } }) },
```

`getById({ type: 'series', id: 100 })` MUST return `{ series, seasons[0].episodes[0] }` or reload stays on `player-error`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit | App HashRouter + `/watch` mounts PlayerPage; proxied src; proxy error; live SeekBar hide; series→episode 101 | STRICT vitest. Work *is* the test edit (no production RED). Kept suites already GREEN vs `PlayerPage`/`App`. `npx vitest run tests/unit/routing.test.tsx tests/unit/player/player-page.test.tsx` |
| E2E | Watch hash, reload, invalid type | Playwright `tests/e2e/routing.spec.ts` only (already in repo). Incomplete mock is RED (`player-error`). |
| Organism | — | Do not use `video-player.test.tsx` as this change’s proof. |

One work-unit commit: `test(player): drop placeholder doubles; proxy-aware watch e2e`. Single PR. Authored add+del expected well under 400 if placeholder stays. `Chained PRs recommended: No`. `400-line budget risk: Low`.

## Threat Matrix

N/A — no production routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Revert the tests-only PR. Production player and archived F4 specs stay unchanged.

## Open Questions

- [ ] None blocking. Placeholder delete is an apply-time line-budget gate, not a product question.
