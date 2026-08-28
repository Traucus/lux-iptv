# Exploration: lux-iptv-f2-secure-source (F2 Fuente segura)

Change: `lux-iptv-f2-secure-source`
Owner freeze (do not reopen): D-2 (2026-08-28) — refresh is chrome on Home/Live/Movies/Series, not inside account. Saved server/username/password are NEVER displayed after save. Replace-source requires retyping.
F2 is ONLY this. Out of scope: player wiring, TMDB, EPG, see-all, continue watching, 4K, at-rest encryption of `config.json`.

Contract sources: `docs/planning/PLAN-MAESTRO.md` (F2), `CRITERIOS-POR-FLUJO.md` (FL-01, FL-02, T-02), `CHECKLIST.md` (PA-01, PA-02, PA-03, FA-01, FA-02, AJ-05), `PANTALLAS-POR-FLUJO.md` (S1 refresh, S2 vault, S3/S4/S5 refresh).

## Exploration: F2 secure source (refresh chrome + vault)

### Current State

Ingest already works (Xtream + M3U worker, `ON CONFLICT(url)` upsert in `processM3UEntries`). Credentials persist as plaintext JSON via `ConfigService` (`userData/config.json`) and are returned in full — including password — through `config:loadCredentials`.

S2 (`IngestPage`) is always an “Add your IPTV source” form. On mount it auto-fills server, username, password, and URL from `loadCredentials` (PA-03). PasswordField already masks *new* input with show/hide. On DONE it saves credentials and navigates to `/`.

Refresh exists only on Home (`DashboardPage`): shown iff `loadCredentials` returns data. The handler loads secrets in the renderer, calls `ingest:start`, then **navigates to `/ingest`** so `IngestOverlay` can render. Live/Movies/Series have no refresh button and duplicate sidebar routing. Settings already routes to `/ingest` (AJ-05 path exists; the screen is still onboarding copy, not a vault).

`useStartIngest` invalidates query key `['catalog']` on *start*. List pages read `['catalog-grouped', type, limit]`, which that prefix does not match. `catalog:ingestion-complete` is sent from main and has no renderer subscriber. T-02 “rows update” would fail even if the user stayed on `/movies`.

### Contract map (must not invent a different product)

| ID | Requirement | Today |
| --- | --- | --- |
| FL-01 | Xtream vs M3U; overlay with counts; DONE → Home with rows. After DONE, S2 does not show server/username/password. New password masked with show/hide. | Overlay + DONE→Home exist. Form still shows (and auto-fills) secrets. Masking of *typed* password exists. |
| FL-02 | Actualizar listas on Home, Live, Movies, Series without opening S2. Uses stored credentials; no secret fields on screen. Hidden if no source. Upsert by URL. | Home only, then opens S2. Upsert already in worker. |
| T-02 | From `/movies`, refresh, stay in movies IA, rows update. | Refresh leaves `/movies` for `/ingest`. Grouped queries not invalidated on DONE. |
| PA-01 / FA-01 | Refresh only Home / missing on Live/Movies/Series | Confirmed. |
| PA-02 / FA-02 / AJ-05 | Settings = add-source form; no vault; sidebar Settings should be vault | Copy + always-form. Route `/ingest` already. |
| PA-03 / D-2 | Password auto-fill; never display saved secrets; replace requires retype | Auto-fill is the defect. |

### Affected Areas

- `src/renderer/features/dashboard/DashboardPage.tsx` — only refresh chrome; navigates to `/ingest`; loads full secrets to detect source and start ingest.
- `src/renderer/features/live/LivePage.tsx` — no refresh chrome (FA-01 / FL-02).
- `src/renderer/features/movies/MoviesPage.tsx` — no refresh; T-02 stay-on-page target.
- `src/renderer/features/series/SeriesPage.tsx` — no refresh chrome (FA-01 / FL-02).
- `src/renderer/features/ingest/IngestPage.tsx` — always-form + auto-fill (PA-02, PA-03, FL-01, FA-02).
- `src/renderer/features/ingest/CredentialsForm.tsx` — empty/replace form only; keep show/hide for *new* password.
- `src/renderer/features/ingest/IngestOverlay.tsx` + `src/renderer/components/molecules/ProgressOverlay.tsx` — overlay is page-local to S2; must work on list routes.
- `src/renderer/App.tsx` — no app-level ingest host; four list routes are independent shells.
- `src/renderer/components/organisms/Sidebar.tsx` — Settings already exists; AJ-05 is vault *behavior*, not a new nav item.
- `src/renderer/queries/use-ingest.ts` — invalidate-on-start; wrong catalog keys.
- `src/renderer/queries/use-catalog.ts` — `catalog-grouped` keys must refetch on DONE.
- `src/main/ipc/handlers/config.ts` + `src/main/services/config-service.ts` — `loadCredentials` returns secrets to renderer; no `hasSource` / summary IPC.
- `src/main/ipc/handlers/ingest.ts` + `src/main/services/ingest-orchestrator.ts` — start requires renderer-supplied credentials; no vault-backed refresh.
- `src/main/workers/ingest-worker.ts` — `ON CONFLICT(url)` already satisfies FL-02 upsert; do not rewrite persist.
- `tests/unit/features/IngestPage.test.tsx` + `tests/unit/features/DashboardPage.test.tsx` — must cover vault states, chrome visibility, stay-on-page.

### Approaches

#### Decision 1 — Shared refresh chrome vs duplicating the button

1. **Copy the Home button into Live/Movies/Series** — paste `hasSavedCredentials` + `handleRefresh` three more times.
   - Pros: smallest diff; matches current Dashboard markup.
   - Cons: four secret-loading copies; four navigate-to-ingest bugs; chrome will drift.
   - Effort: Low (and wrong).

2. **Shared `RefreshListsButton` + `useHasSource` hook; each page places it** — one molecule, four call sites.
   - Pros: one visibility/start path; pages keep their layouts.
   - Cons: sidebar routing still duplicated four times; easy to forget a page.
   - Effort: Low–Medium.

3. **`ListScreenChrome` organism (sidebar + optional Actualizar listas)** wrapping S1/S3/S4/S5.
   - Pros: M7 “shell / refresh chrome”; one hide-if-no-source rule; kills duplicated `onSidebarSelect`.
   - Cons: more layout churn in four pages; review-size risk if mixed with vault in one PR.
   - Effort: Medium.

#### Decision 2 — Progress UX: stay on current list vs `/ingest`

1. **Keep navigating to `/ingest`** (today).
   - Pros: overlay already lives there.
   - Cons: fails T-02 and FL-02 (“without opening S2”).
   - Effort: none — reject.

2. **App-level `IngestProgressHost`** (overlay portal next to `Routes`). Refresh starts ingest and stays on the current route. On DONE: invalidate catalog queries, dismiss overlay, **do not navigate**. First-run FL-01 on S2 still navigates Home after DONE.
   - Pros: T-02; overlay remains one component (`fixed inset-0` already); first-add vs refresh navigation rules stay distinct.
   - Cons: overlay state must leave `IngestPage`; refresh and first-add share job progress.
   - Effort: Medium.

3. **Per-page overlay via a hook** in each list page.
   - Pros: no App.tsx change.
   - Cons: four overlay mounts; unmounting the page kills progress; worse than a host.
   - Effort: Medium–High.

#### Decision 3 — Vault configured state vs empty form

1. **Always empty form** (stop auto-fill only).
   - Pros: smallest change; stops PA-03 echo.
   - Cons: fails S2 “configured: **no secret fields**”; Settings still looks like onboarding (PA-02).
   - Effort: Low — incomplete.

2. **Two S2 states.** Configured: status card with **listName + source type only** (no server, username, password, M3U URL) and a Replace source action. Empty / replace: blank `CredentialsForm` + overlay. Replace never pre-fills.
   - Pros: matches PANTALLAS S2, FL-01, D-2, FA-02, AJ-05.
   - Cons: needs a non-secret summary IPC; more S2 tests.
   - Effort: Medium.

3. **Configured form with masked placeholders (`••••`).**
   - Pros: familiar “edit account” pattern.
   - Cons: still *displays* saved secret fields; replace would not force retype; conflicts with D-2.
   - Effort: Low — reject.

### Recommendation

Combine **ListScreenChrome (decision 1.3)** + **app-level IngestProgressHost (decision 2.2)** + **two-state vault (decision 3.2)**.

IPC shape (renderer never needs saved secrets for F2):

- `config:hasSource` → `{ configured: boolean }` for chrome visibility.
- `config:sourceSummary` → `{ configured, listName, source }` for the vault card (no server/user/pass/url).
- `ingest:refresh` → main loads vault and calls `IngestOrchestrator.start`. If no source, return a typed error; chrome is already hidden.
- Keep `ingest:start` for first-run and replace, using **retyped** form values. Persist credentials only after DONE (existing timing).

On refresh DONE: `invalidateQueries` for `catalog`, `catalog-grouped`, `catalog-groups`, and dashboard list keys **after** main `db.reload()`, not on start. Stay on the current route.

S2 copy becomes vault language (not “Add your IPTV source”) when configured. Sidebar Settings stays the `/ingest` entry (AJ-05). Password show/hide remains for *new* typing only.

Do not change worker upsert, player, TMDB, EPG, see-all, or continue watching. Do not encrypt `config.json` in F2 (display contract, not at-rest).

Review budget: authored F2 will likely exceed 400 lines. Tasks should forecast chained PRs (vault+IPC, then chrome+stay-on-page overlay). Delivery strategy already `auto-chain`.

### Risks

- `['catalog']` invalidation does not refresh `catalog-grouped`; T-02 fails unless DONE invalidates the grouped keys after `db.reload()`.
- `config:loadCredentials` still returns the password to any renderer caller until F2 stops using it; chrome must not keep that path.
- `ingest:start` logs server/URL (`handlers/ingest.ts`). Do not log password; leftover URL logs are residual, not F2 encryption work.
- Replacing a source upserts by URL and does **not** delete stale rows from the previous playlist. Not in the freeze; do not add a wipe unless the owner asks.
- `config.json` remains plaintext on disk. Out of F2 display scope; residual.
- Overlay-on-list plus first-run navigate-Home are easy to conflate; keep the two DONE behaviors explicit.
- Four-page chrome + vault + IPC in one PR will blow the 400-line review budget.

### Ready for Proposal

Yes. Orchestrator should run **sdd-propose** for `lux-iptv-f2-secure-source` with this recommendation. Do not reopen D-2. Do not pull F3–F6 into the change.
