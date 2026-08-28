# Design: F2 Secure Source (Vault + Refresh)

## Technical Approach

Close D-2 / FL-01 / FL-02 / T-02 with the proposal’s three pieces: two-state S2 vault, `ListScreenChrome` on S1/S3/S4/S5, app-level `IngestProgressHost`. Main owns secrets. F2 renderer uses `config:hasSource`, `config:sourceSummary`, `ingest:refresh` — never `config:loadCredentials`. Keep `ingest:start` for first-run/replace (retyped). Persist with existing `saveCredentials` after DONE. Worker upsert unchanged. Out of scope: player, TMDB, EPG, 4K, `config.json` encryption, stale-row wipe.

## Architecture Decisions

| Decision | Option | Tradeoff | Choice |
|----------|--------|----------|--------|
| List chrome | Copy / molecule / organism | drift vs layout churn | `ListScreenChrome` (`Sidebar` + Actualizar listas) |
| Overlay | `/ingest` / per-page / host | T-02 fail vs four mounts | `IngestProgressHost` beside `Routes` |
| S2 | Empty form / masked / two-state | incomplete vs D-2 conflict | Configured card vs blank form |
| Presence | `loadCredentials` / `hasSource` | secrets in renderer | `{ configured }` + summary, no URL/secrets |
| No-source | new code / `NOT_FOUND` | enum vs reuse | `NOT_FOUND` `"No saved source"` |
| DONE vs reload | send then reload / reverse | stale catalog IPC | `db.reload()` then DONE events |
| PR chain | stacked-to-main / feature-branch | independent review vs parent diffs | stacked-to-main |

## Data Flow

First-run / replace (FL-01, D-2):

    IngestPage ──ingest:start──→ Orchestrator ──→ worker
         │                         reload() then DONE
         └── saveCredentials (typed) → / (first-run)
             replace: stay on S2, show card

Refresh (FL-02, T-02):

    ListScreenChrome ──hasSource──→ hide if false
         └──ingest:refresh──→ loadCredentials (main only) → start
                                reload then DONE
    IngestProgressHost → invalidate catalog-grouped, catalog, catalog-groups
                       → overlay; no navigate

    HashRouter → IngestProgressHost + Routes (unchanged)

## File Changes

Create: `use-source.ts` (`useHasSource`, `useSourceSummary`); `SourceVaultCard.tsx`; `IngestProgressHost.tsx`; `ListScreenChrome.tsx`; `tests/unit/config-handlers.test.ts`; `ListScreenChrome.test.tsx`; `IngestProgressHost.test.tsx`.

Modify: `config-service.ts` (`hasSource`, `sourceSummary`); `handlers/config.ts`; `handlers/ingest.ts` (`ingest:refresh` + `configService`); `ipc/index.ts`; `ingest-orchestrator.ts` (reload before DONE / `catalog:ingestion-complete`); `preload/index.ts`; `lib/api.ts`; `shared/types/ipc.ts`; `use-ingest.ts` (DONE grouped invalidation, not start); `IngestPage.tsx` (two-state, no auto-fill; page overlay until slice 2); `organisms/index.ts`; `App.tsx`; dashboard/live/movies/series (chrome, drop secret load); `ingest-handlers.test.ts`; `ingest-orchestrator.test.ts`; `IngestPage.test.tsx`; `DashboardPage.test.tsx`.

Delete: none.

## Interfaces / Contracts

```ts
type HasSource = { configured: boolean };
type SourceSummary = { configured: boolean; listName?: string; source?: 'xtream' | 'm3u' };
// ingest:refresh(): Promise<IpcResult<{ jobId: string }>>  // no input
```

Summary omits server, username, password, url. Refresh builds `IngestStartInput` in main. Keep `config:loadCredentials` channel; F2 UI MUST NOT call it.

## Testing Strategy

Strict TDD (`vitest`). RED before production. No F2 Playwright.

| Layer | What | Approach |
|-------|------|----------|
| Unit | Strip secrets; vault refresh; NOT_FOUND; reload-before-send | handler/orchestrator harness |
| Unit | Card vs blank replace; show/hide; no `loadCredentials` | happy-dom `IngestPage` |
| Unit | Chrome iff source; no `/ingest` nav | `ListScreenChrome` |
| Unit | Stay `/movies`; invalidate `['catalog-grouped']` after DONE | host + QueryClient |

## Threat Matrix

Skill matrix is VCS/shell/executable classification, not Electron IPC. All rows N/A — no path classification, git, commit, push, or PR automation. No threat-matrix RED tasks.

## Migration / Rollout

No migration. `config.json` unchanged.

**Review (400-line budget, `auto-chain`): High.** Stacked-to-main (PR2 after PR1 on `main`):

1. **Vault + IPC** — ConfigService, handlers, preload/api, two-state `IngestPage`, vault tests. Dashboard may keep `loadCredentials` until 2.
2. **Chrome + host** — chrome, host, four pages, DONE invalidation, reload-before-send, T-02 tests.

If a slice still exceeds 400, split IPC then vault UI. Avoid feature-branch-chain unless parent diffs force it.

## Open Questions

None. Slice 1 keeps S2 overlay page-local; slice 2 lifts it to the host.
