# Tasks: F2 Secure Source (Vault + Refresh)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–800 total; ~350–400 per PR |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 (stacked-to-main) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Vault + IPC | PR 1 (base=`main`) | `npx vitest run tests/unit/config-handlers.test.ts tests/unit/ingest-handlers.test.ts tests/unit/features/IngestPage.test.tsx` | N/A — no F2 Playwright; vault via happy-dom | `config-service.ts`, config/ingest handlers, `ipc/index.ts`, preload/api, `ipc.ts`, `use-source.ts`, `SourceVaultCard.tsx`, `IngestPage.tsx` + vault tests |
| 2 | Chrome + host | PR 2 (base=`main` after PR1) | `npx vitest run tests/unit/features/ListScreenChrome.test.tsx tests/unit/features/IngestProgressHost.test.tsx tests/unit/ingest-orchestrator.test.ts tests/unit/features/DashboardPage.test.tsx` | N/A — no F2 Playwright; T-02 via host unit | `ListScreenChrome.tsx`, `IngestProgressHost.tsx`, `App.tsx`, four list pages, `use-ingest.ts`, `ingest-orchestrator.ts` + chrome/host tests |

## Phase 1: Vault IPC (PR 1)

- [x] 1.1 RED `tests/unit/config-handlers.test.ts`: `sourceSummary` omits server/username/password/URL (D-2); `hasSource` is `{ configured }`.
- [x] 1.2 GREEN `src/main/services/config-service.ts` + `src/main/ipc/handlers/config.ts`: add `hasSource()` and `sourceSummary()`.
- [x] 1.3 RED `tests/unit/ingest-handlers.test.ts`: `ingest:refresh` uses vault; no source → `NOT_FOUND` `"No saved source"`; ingest does not start.
- [x] 1.4 GREEN `src/main/ipc/handlers/ingest.ts` + `src/main/ipc/index.ts`: `ingest:refresh()` (no input); main `loadCredentials` then start.
- [x] 1.5 GREEN `src/shared/types/ipc.ts`, `src/preload/index.ts`, `src/renderer/lib/api.ts`: `HasSource`, `SourceSummary`, `ingest:refresh`.

## Phase 2: Two-state S2 (PR 1)

- [x] 2.1 RED `tests/unit/features/IngestPage.test.tsx`: card shows listName+type only; empty form + password show/hide; replace blank; no `loadCredentials` (FL-01, D-2).
- [x] 2.2 GREEN `src/renderer/queries/use-source.ts` (`useHasSource`, `useSourceSummary`); export from `src/renderer/queries/index.ts`.
- [x] 2.3 GREEN `src/renderer/features/ingest/SourceVaultCard.tsx` + `IngestPage.tsx`: two-state; retyped `ingest:start`; persist after DONE; page-local overlay; first-run DONE → Home.
- [x] 2.4 Verify PR1 with unit-1 vitest; Dashboard may keep `loadCredentials` until PR2.

## Phase 3: Chrome + host (PR 2)

- [ ] 3.1 RED `tests/unit/features/ListScreenChrome.test.tsx`: Actualizar listas iff source; no `/ingest` nav (FL-02).
- [ ] 3.2 GREEN `src/renderer/components/organisms/ListScreenChrome.tsx` + `organisms/index.ts`: Sidebar + `hasSource`/`ingest:refresh`.
- [ ] 3.3 RED `tests/unit/features/IngestProgressHost.test.tsx`: stay `/movies` on DONE; no S2; invalidate `['catalog-grouped']` (T-02).
- [ ] 3.4 GREEN `src/renderer/features/ingest/IngestProgressHost.tsx` beside Routes in `src/renderer/App.tsx`; refresh no navigate; first-run still Home.
- [ ] 3.5 GREEN `src/renderer/queries/use-ingest.ts`: invalidate `catalog-grouped`, `catalog`, `catalog-groups` on DONE only.

## Phase 4: Wire pages + reload (PR 2)

- [ ] 4.1 RED `tests/unit/ingest-orchestrator.test.ts`: `db.reload()` before DONE / `catalog:ingestion-complete`.
- [ ] 4.2 GREEN `src/main/services/ingest-orchestrator.ts`: reload then send.
- [ ] 4.3 GREEN chrome on `DashboardPage.tsx`, `LivePage.tsx`, `MoviesPage.tsx`, `SeriesPage.tsx`; drop renderer `loadCredentials`.
- [ ] 4.4 RED/GREEN `tests/unit/features/DashboardPage.test.tsx`: hasSource chrome; no `loadCredentials`; hidden without source.
- [ ] 4.5 Verify PR2 with unit-2 vitest; in-flight rows need not match until DONE.
