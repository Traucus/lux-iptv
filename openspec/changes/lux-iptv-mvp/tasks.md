# Tasks: Lux IPTV MVP — Slice 1 (Ingestion + Enrichment)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 4,200–4,800 (production + tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 3-work-unit chain: Foundation → Core → UI |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Scaffolding + IPC Contract + Classifier/Preprocessor | PR 1 (base=main) | `vitest run src/main/db src/main/services/classifier src/shared/schemas` | N/A (pure logic) | Drop Phase 0+1+2 files only |
| 2 | Ingest Worker + TMDB Key + Enrichment Worker | PR 2 (base=PR1) | `vitest run src/main/workers src/main/services/ingest-orchestrator src/renderer/workers/enrichment` | Playwright ingest-to-dashboard.spec | Drop Phase 3+5+6 files only |
| 3 | UI Features + TanStack Query wiring + E2E | PR 3 (base=PR2) | `vitest run src/renderer/queries src/renderer/features && playwright test` | Full Playwright suite | Drop Phase 7+8 files + revert query-client wiring |

---

## Phase 0: Scaffolding

- [ ] 0.1 [TASK-001] Add runtime dependencies to `package.json` (type: setup, ~5 LOC)
  - **Files**: `package.json`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] `better-sqlite3`, `@types/better-sqlite3` present in dependencies
    - [ ] `iptv-m3u-playlist-parser`, `@tanstack/react-query`, `idb`, `react-tv-space-navigation`, `react-window` present
  - **Tests**: None (package.json-only change)

- [ ] 0.2 [TASK-002] Add `electron-rebuild` postinstall hook (type: setup, ~2 LOC)
  - **Files**: `package.json` scripts
  - **Depends on**: TASK-001
  - **Acceptance**:
    - [ ] `postinstall` script runs `electron-rebuild -f`
  - **Tests**: None

- [ ] 0.3 [TASK-003] Create `drizzle.config.ts` targeting `src/main/db/schema.ts` (type: setup, ~15 LOC)
  - **Files**: `drizzle.config.ts`
  - **Depends on**: TASK-001
  - **Acceptance**:
    - [ ] Config points schema output to `src/main/db/migrations`
    - [ ] Driver set to `better-sqlite3`
  - **Tests**: None

- [ ] 0.4 [TASK-004] Create SQLite schema with Drizzle DSL (type: schema, ~120 LOC)
  - **Files**: `src/main/db/schema.ts`
  - **Depends on**: TASK-003
  - **Acceptance**:
    - [ ] `live_channels` table with all REQ-CATALOG-1 columns + indexes (byXtreamId, byName, byGroup)
    - [ ] `vod_movies` table with REQ-CATALOG-1 columns
    - [ ] `series` table with REQ-CATALOG-1 columns
    - [ ] `episodes` table with FK to series (onDelete cascade)
    - [ ] `schema_version` table
  - **Tests**:
    - [ ] `describe('schema', ...)` — table creation emits correct SQL DDL

- [ ] 0.5 [TASK-005] Create `src/main/db/client.ts` (better-sqlite3 + drizzle instance) (type: infra, ~20 LOC)
  - **Files**: `src/main/db/client.ts`
  - **Depends on**: TASK-004
  - **Acceptance**:
    - [ ] Opens DB at `app.getPath('userData') + '/catalog.db'`
    - [ ] Exports typed `db` instance and `sqlite` driver
  - **Tests**:
    - [ ] `describe('client')` — `:memory:` mode works for tests

- [ ] 0.6 [TASK-006] Create `src/main/db/migrate.ts` (type: infra, ~40 LOC)
  - **Files**: `src/main/db/migrate.ts`
  - **Depends on**: TASK-005
  - **Acceptance**:
    - [ ] Reads `schema_version` table, applies pending migrations from `src/main/db/migrations/`
    - [ ] Idempotent: re-running does nothing
    - [ ] Creates `schema_version` row if not exists
  - **Tests**:
    - [ ] `describe('migrate')` — empty migration folder does not error

- [ ] 0.7 [TASK-007] Create `src/main/db/repo.ts` with `bulkInsert` (type: repo, ~80 LOC)
  - **Files**: `src/main/db/repo.ts`
  - **Depends on**: TASK-005, TASK-006
  - **Acceptance**:
    - [ ] `bulkInsert(table, rows)` chunks into batches of 1,000 with transaction per chunk
    - [ ] `bulkInsert(8_000 rows)` completes in < 400ms in :memory: DB
    - [ ] Upsert by `url` with `ON CONFLICT DO UPDATE` (REQ-CATALOG-4)
  - **Tests**:
    - [ ] `describe('repo')` — 8k rows in <400ms
    - [ ] `describe('repo')` — upsert updates existing row

- [ ] 0.8 [TASK-008] Wire migration into `app.whenReady()` before `createWindow` (type: wiring, ~15 LOC)
  - **Files**: `src/main/index.ts`
  - **Depends on**: TASK-006, TASK-007
  - **Acceptance**:
    - [ ] Migration runs synchronously before window creation
    - [ ] Migration failure is fatal (logs + exits)
  - **Tests**:
    - [ ] Integration test: fresh DB gets schema_version=1

- [ ] 0.9 [TASK-009] Generate initial migration files (type: setup, ~0 LOC generated)
  - **Files**: `src/main/db/migrations/0000_initial.sql`, `0000_initial.ts`
  - **Depends on**: TASK-004
  - **Acceptance**:
    - [ ] `drizzle-kit generate` produces migration files
    - [ ] Migration SQL creates all 4 tables + indexes + schema_version
  - **Tests**: None (drizzle-kit output)

---

## Phase 1: IPC Contract

- [ ] 1.1 [TASK-010] Create `src/shared/types/ipc.ts` (ErrorCode enum + LuxAPI interface) (type: types, ~60 LOC)
  - **Files**: `src/shared/types/ipc.ts`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] `ErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'DB_CORRUPTED' | 'INGEST_IN_PROGRESS' | 'AUTH_FAILED' | 'NETWORK' | 'TMDB_RATE_LIMIT' | 'INTERNAL'`
    - [ ] `LuxAPI` interface lists all 10 methods from design §IPC Bridge table
    - [ ] All request/response types exported
  - **Tests**:
    - [ ] `describe('ipc types')` — Zod schema parses valid inputs

- [ ] 1.2 [TASK-011] Create `src/shared/schemas/ingest.ts` (Zod schemas) (type: schema, ~30 LOC)
  - **Files**: `src/shared/schemas/ingest.ts`
  - **Depends on**: TASK-010
  - **Acceptance**:
    - [ ] `IngestStartInputSchema` validates `{ source: 'xtream'|'m3u', credentials?, url?, listName }`
    - [ ] `IngestProgressSchema` validates progress payload shape
  - **Tests**:
    - [ ] `describe('ingest schemas')` — valid and invalid inputs rejected

- [ ] 1.3 [TASK-012] Create `src/shared/schemas/catalog.ts` and `src/shared/schemas/tmdb.ts` (type: schema, ~30 LOC)
  - **Files**: `src/shared/schemas/catalog.ts`, `src/shared/schemas/tmdb.ts`
  - **Depends on**: TASK-010
  - **Acceptance**:
    - [ ] `CatalogListInputSchema`, `CatalogGetByIdInputSchema` validate list/get queries
    - [ ] `TmdbKeyInputSchema` validates API key format
  - **Tests**:
    - [ ] `describe('catalog schemas')` — valid/invalid pagination params
    - [ ] `describe('tmdb schemas')` — key format validation

- [ ] 1.4 [TASK-013] Create `src/shared/types/catalog.ts` (LiveChannel, VodMovie, Series, Episode DTOs) (type: types, ~50 LOC)
  - **Files**: `src/shared/types/catalog.ts`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] `LiveChannel`, `VodMovie`, `Series`, `Episode` interfaces match Drizzle schema columns
    - [ ] `enrichment_status: 'pending' | 'enriched' | 'not_found' | 'error'` field present
  - **Tests**:
    - [ ] `describe('catalog types')` — type compatibility with Drizzle inferred types

- [ ] 1.5 [TASK-014] Create `src/shared/types/ingest.ts` and `src/shared/types/tmdb.ts` (type: types, ~40 LOC)
  - **Files**: `src/shared/types/ingest.ts`, `src/shared/types/tmdb.ts`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] `IngestSource`, `IngestJob`, `IngestProgress` types for worker messages
    - [ ] `TmdbMatch`, `EnrichmentStatus` types for enrichment pipeline
  - **Tests**: None (types only)

- [ ] 1.6 [TASK-015] Create IPC handlers stubs returning `NOT_IMPLEMENTED` (type: scaffolding, ~80 LOC)
  - **Files**: `src/main/ipc/index.ts`, `src/main/ipc/handlers/{ingest,catalog,enrichment,tmdb}.ts`
  - **Depends on**: TASK-010, TASK-011, TASK-012
  - **Acceptance**:
    - [ ] `registerHandlers()` registers all 10 handlers
    - [ ] Each handler returns `{ error: { code: 'INTERNAL', message: 'not yet implemented' } }`
    - [ ] All handlers validate input with Zod safeParse, return `INVALID_INPUT` on failure
  - **Tests**:
    - [ ] `describe('ipc handlers')` — invalid input returns INVALID_INPUT error
    - [ ] `describe('ipc handlers')` — valid input returns INTERNAL error (stub)

- [ ] 1.7 [TASK-016] Rewrite `src/preload/index.ts` exposing `window.luxAPI` (type: bridge, ~80 LOC)
  - **Files**: `src/preload/index.ts`
  - **Depends on**: TASK-010, TASK-015
  - **Acceptance**:
    - [ ] All 10 `ipcRenderer.invoke` calls wired to correct channels
    - [ ] `contextIsolation: true` + `nodeIntegration: false` preserved
    - [ ] Exposes `luxAPI.ingest`, `luxAPI.catalog`, `luxAPI.enrichment`, `luxAPI.tmdb` namespaces
  - **Tests**:
    - [ ] `describe('preload')` — all channels exposed (mock-based test)

- [ ] 1.8 [TASK-017] Create `src/renderer/lib/api.ts` (typed `window.luxAPI` wrapper) (type: bridge, ~50 LOC)
  - **Files**: `src/renderer/lib/api.ts`
  - **Depends on**: TASK-016
  - **Acceptance**:
    - [ ] `createLuxAPI()` returns typed `LuxAPI` implementation backed by `window.luxAPI`
    - [ ] All 10 methods have correct return types
  - **Tests**:
    - [ ] `describe('api')` — mock `window.luxAPI` produces correct types

- [ ] 1.9 [TASK-018] Create `src/renderer/lib/query-client.ts` (TanStack Query config) (type: infra, ~25 LOC)
  - **Files**: `src/renderer/lib/query-client.ts`
  - **Depends on**: TASK-001
  - **Acceptance**:
    - [ ] `QueryClient` with `staleTime: 60_000`, `gcTime: 5*60_000`, `retry: 1`, `refetchOnWindowFocus: false`
    - [ ] Mutations have `retry: 0`
  - **Tests**: None (config only)

- [ ] 1.10 [TASK-019] Wrap renderer root with `QueryClientProvider` (type: wiring, ~10 LOC)
  - **Files**: `src/renderer/main.tsx`
  - **Depends on**: TASK-018
  - **Acceptance**:
    - [ ] `<QueryClientProvider client={queryClient}>` wraps `<RouterProvider>`
    - [ ] App does not crash on cold start
  - **Tests**: None (React integration)

---

## Phase 2: Classifier + Preprocessor

- [ ] 2.1 [TASK-020] RED: Write `classifier.test.ts` with 6-stage heuristic fixtures (type: test, ~80 LOC)
  - **Files**: `tests/unit/classifier.test.ts`
  - **Depends on**: TASK-013
  - **Acceptance**:
    - [ ] Test cases for: URL contains `/movie/` → `movie`
    - [ ] Test cases for: `group-title="Series"` or `"Diziler"` → `series`
    - [ ] Test cases for: radio stream signals → `radio`
    - [ ] Test cases for: fallback → `live`
  - **Tests**: Vitest `describe('classifier')` — 12+ fixture pairs from DOC-3 §3.2

- [ ] 2.2 [TASK-021] GREEN: Implement `src/main/services/classifier.ts` (6-stage heuristic) (type: logic, ~90 LOC)
  - **Files**: `src/main/services/classifier.ts`
  - **Depends on**: TASK-020
  - **Acceptance**:
    - [ ] Stage 1: URL path check (`/movie/`, `/series/`, `/live/`)
    - [ ] Stage 2: group-title pattern matching (Series, Diziler, Movies, etc.)
    - [ ] Stage 3: stream type metadata
    - [ ] Stage 4: IMDb ID presence (via preprocessor)
    - [ ] Stage 5: name pattern analysis (SxxExx episode detection)
    - [ ] Stage 6: default to `live`
    - [ ] All 12+ fixture tests pass
  - **Tests**: Inherited from TASK-020

- [ ] 2.3 [TASK-022] RED: Write `preprocessor.test.ts` with DOC-8 §8.3 regex fixtures (type: test, ~100 LOC)
  - **Files**: `tests/unit/preprocessor.test.ts`
  - **Depends on**: TASK-013
  - **Acceptance**:
    - [ ] Fixtures: `"Avatar (2009) [1080p] tt0499549.mkv"` → `imdbId=tt0499549, cleanTitle=Avatar, year=2009`
    - [ ] Fixtures: `"Breaking.Bad.S03E07.720p.HDTV"` → `seriesName=Breaking Bad, season=3, episode=7`
    - [ ] Fixtures: noisy titles → quality/codec tags stripped
  - **Tests**: Vitest `describe('preprocessor')` — 15+ noisy title fixtures

- [ ] 2.4 [TASK-023] GREEN: Implement `src/renderer/services/preprocessor.ts` (4 regex DOC-8 §8.3) (type: logic, ~70 LOC)
  - **Files**: `src/renderer/services/preprocessor.ts`
  - **Depends on**: TASK-022
  - **Acceptance**:
    - [ ] Regex 1: IMDb ID extraction `tt\d{7,8}`
    - [ ] Regex 2: Year extraction `(yyyy)`
    - [ ] Regex 3: Season/Episode `S(\d+)E(\d+)`
    - [ ] Regex 4: Noise stripping (quality, codec, release group tags)
    - [ ] All 15+ fixture tests pass
  - **Tests**: Inherited from TASK-022

---

## Phase 3: Ingest Worker

- [ ] 3.1 [TASK-024] RED: Write `xtream-client.test.ts` with MSW fixtures (type: test, ~100 LOC)
  - **Files**: `tests/unit/xtream-client.test.ts`
  - **Depends on**: TASK-013
  - **Acceptance**:
    - [ ] MSW handler for valid `/player_api.php` auth response
    - [ ] MSW handler for 401 AUTH_FAILED
    - [ ] MSW handler for timeout → CONNECTION_ERROR
  - **Tests**: Vitest `describe('xtream-client')` — auth, categories, streams fetching

- [ ] 3.2 [TASK-025] GREEN: Implement `src/main/services/xtream-client.ts` (type: logic, ~120 LOC)
  - **Files**: `src/main/services/xtream-client.ts`
  - **Depends on**: TASK-024
  - **Acceptance**:
    - [ ] `login()` → fetches `/player_api.php?username=X&password=Y`
    - [ ] `getLiveCategories()`, `getVODCategories()`, `getSeriesCategories()`
    - [ ] `getLiveStreams(categoryId)`, `getVODStreams(categoryId)`, `getSeriesStreams(categoryId)`
    - [ ] 15s timeout per request
    - [ ] HTTPS-only enforcement
  - **Tests**: Inherited from TASK-024

- [ ] 3.3 [TASK-026] RED: Write `m3u-client.test.ts` with fixture `.m3u` content (type: test, ~80 LOC)
  - **Files**: `tests/unit/m3u-client.test.ts`
  - **Depends on**: TASK-013
  - **Acceptance**:
    - [ ] Test: valid M3U with 50 entries parses to array
    - [ ] Test: malformed entries skipped without crash
    - [ ] Test: local file path outside userData rejected (threat matrix: file reads)
  - **Tests**: Vitest `describe('m3u-client')`

- [ ] 3.4 [TASK-027] GREEN: Implement `src/main/services/m3u-client.ts` (type: logic, ~80 LOC)
  - **Files**: `src/main/services/m3u-client.ts`
  - **Depends on**: TASK-026
  - **Acceptance**:
    - [ ] `fetchM3U(url)` downloads and parses with `iptv-m3u-playlist-parser`
    - [ ] `readLocalM3U(path)` validates path is in `userData` + `.m3u`/`.m3u8` extension
    - [ ] Malformed entries logged and skipped
  - **Tests**: Inherited from TASK-026

- [ ] 3.5 [TASK-028] Implement `src/main/workers/ingest-worker.ts` (worker_threads) (type: logic, ~180 LOC)
  - **Files**: `src/main/workers/ingest-worker.ts`
  - **Depends on**: TASK-021, TASK-025, TASK-027
  - **Acceptance**:
    - [ ] Receives `{ type: 'START', payload }` → runs 5 phases (FETCH → ITEMS → CLASSIFY → PERSIST → DONE)
    - [ ] Emits `{ type: 'PROGRESS', live, movies, series, radio, total, phase }` every 100 items
    - [ ] Emits `{ type: 'DONE', counts }` or `{ type: 'ERROR', code, message, retryable }`
    - [ ] Handles `{ type: 'CANCEL' }` → sets `aborted=true`, emits DONE
  - **Tests**:
    - [ ] `describe('ingest-worker')` integration — worker_threads + in-memory DB + M3U fixture

- [ ] 3.6 [TASK-029] Implement `src/main/services/ingest-orchestrator.ts` (type: logic, ~100 LOC)
  - **Files**: `src/main/services/ingest-orchestrator.ts`
  - **Depends on**: TASK-028
  - **Acceptance**:
    - [ ] `start(source)` spawns worker with `jobId = uuid()`
    - [ ] Forwards worker PROGRESS → `mainWindow.webContents.send('ingest:progress', ...)`
    - [ ] On DONE: `worker.terminate()`, forwards DONE event
    - [ ] `cancel(jobId)` → `worker.postMessage({ type: 'CANCEL' })`; if no response in 2s → `terminate()`
    - [ ] Only one active job at a time (INGEST_IN_PROGRESS error if second start attempted)
  - **Tests**:
    - [ ] `describe('ingest-orchestrator')` — start/cancel/only-one-job logic

- [ ] 3.7 [TASK-030] Wire `ingest:*` IPC handlers to orchestrator (type: wiring, ~40 LOC)
  - **Files**: `src/main/ipc/handlers/ingest.ts`
  - **Depends on**: TASK-015, TASK-029
  - **Acceptance**:
    - [ ] `ingest:start` validates with `IngestStartInputSchema`, calls `orchestrator.start()`
    - [ ] `ingest:cancel` calls `orchestrator.cancel(jobId)`
    - [ ] `ingest:getProgress` returns current job state
    - [ ] All Zod validation errors return `INVALID_INPUT` with details
  - **Tests**:
    - [ ] `describe('ingest handlers')` — Zod validation + orchestrator calls (mock)

---

## Phase 4: Catalog Queries

- [ ] 4.1 [TASK-031] Implement `catalog:list` IPC handler (type: wiring, ~60 LOC)
  - **Files**: `src/main/ipc/handlers/catalog.ts`
  - **Depends on**: TASK-015, TASK-007
  - **Acceptance**:
    - [ ] `catalog:list` validates `{ type, limit=50, offset=0, search? }` with Zod
    - [ ] Returns paginated items from correct table
    - [ ] Search filters by name prefix (exact → prefix → contains)
    - [ ] Returns `{ items: Item[], total: number }`
  - **Tests**:
    - [ ] `describe('catalog list handler')` — pagination, type filter, search

- [ ] 4.2 [TASK-032] Implement `catalog:getById` IPC handler (type: wiring, ~50 LOC)
  - **Files**: `src/main/ipc/handlers/catalog.ts`
  - **Depends on**: TASK-015, TASK-007
  - **Acceptance**:
    - [ ] `catalog:getById` for movie/live/radio returns single item
    - [ ] `catalog:getById` for series returns `{ series, seasons: [{ season_number, episodes: [...] }] }`
    - [ ] Returns `NOT_FOUND` if id does not exist
  - **Tests**:
    - [ ] `describe('catalog getById handler')` — series with episodes grouping

---

## Phase 5: TMDB Key + Encryption

- [ ] 5.1 [TASK-033] RED: Write `encryption.test.ts` (type: test, ~80 LOC)
  - **Files**: `tests/unit/encryption.test.ts`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] `encrypt(plaintext)` → base64 string with `v1:` prefix
    - [ ] `decrypt(ciphertext)` → original plaintext (roundtrip)
    - [ ] Tampering: flip 1 byte in ciphertext → `decrypt` throws
    - [ ] Wrong HWID → decrypt returns null or throws
  - **Tests**: Vitest `describe('encryption')` — roundtrip + tamper detection

- [ ] 5.2 [TASK-034] GREEN: Implement `src/main/services/encryption.ts` (AES-256-GCM + scrypt) (type: logic, ~100 LOC)
  - **Files**: `src/main/services/encryption.ts`
  - **Depends on**: TASK-033
  - **Acceptance**:
    - [ ] `encrypt(plain)` → `[12-byte IV][ciphertext][16-byte authTag]` → base64 `v1:...`
    - [ ] `decrypt(v1:base64)` → original plaintext
    - [ ] Key derivation: `scryptSync(HWID, STATIC_SALT, N=2^15, r=8, p=1, keylen=32)`
    - [ ] `iv` is random 12 bytes per encryption
  - **Tests**: Inherited from TASK-033

- [ ] 5.3 [TASK-035] RED: Write `tmdb-key.test.ts` (type: test, ~90 LOC)
  - **Files**: `tests/unit/tmdb-key.test.ts`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] `setTmdbKey(validKey)` → calls TMDB /configuration, on 200 encrypts + writes
    - [ ] `setTmdbKey(invalidKey)` → on 401 returns `{ valid: false }`, does NOT write
    - [ ] `getTmdbKeyPlain()` → decrypts and returns plaintext
    - [ ] `hasTmdbKey()` → returns boolean
    - [ ] `clearTmdbKey()` → deletes file
  - **Tests**: Vitest `describe('tmdb-key')` — valid/invalid/clear paths (mock fetch)

- [ ] 5.6 [TASK-038] Implement `src/main/services/tmdb-key.ts` (vault API) (type: logic, ~80 LOC)
  - **Files**: `src/main/services/tmdb-key.ts`
  - **Depends on**: TASK-034, TASK-035
  - **Acceptance**:
    - [ ] `setTmdbKey(plain)` → validates via `tmdb-validate.ts` → encrypts → writes `userData/tmdb-key.enc`
    - [ ] `hasTmdbKey()` → checks file existence
    - [ ] `getTmdbKeyPlain()` → decrypts on-demand, never caches long-lived
    - [ ] `clearTmdbKey()` → removes file
  - **Tests**: Inherited from TASK-035

- [ ] 5.7 [TASK-039] Implement `src/main/services/tmdb-validate.ts` (type: logic, ~25 LOC)
  - **Files**: `src/main/services/tmdb-validate.ts`
  - **Depends on**: TASK-038
  - **Acceptance**:
    - [ ] `validateKey(key)` → `GET /configuration?api_key=...` with 5s timeout
    - [ ] 200 → `{ valid: true }`, 401 → `{ valid: false }`, network error → throws
  - **Tests**: `describe('tmdb-validate')` — mock fetch 200 + 401

- [ ] 5.8 [TASK-040] Wire `tmdb:*` IPC handlers (type: wiring, ~40 LOC)
  - **Files**: `src/main/ipc/handlers/tmdb.ts`
  - **Depends on**: TASK-015, TASK-038
  - **Acceptance**:
    - [ ] `tmdb:setKey` → validates with Zod → calls `tmdb-key.setTmdbKey()`
    - [ ] `tmdb:hasKey` → calls `tmdb-key.hasTmdbKey()`
    - [ ] `tmdb:clearKey` → calls `tmdb-key.clearTmdbKey()`
  - **Tests**: `describe('tmdb handlers')` — Zod validation + key vault calls (mock)

---

## Phase 6: Enrichment Worker

- [ ] 6.1 [TASK-041] Create `src/renderer/db/schema.ts` (IndexedDB stores) (type: schema, ~50 LOC)
  - **Files**: `src/renderer/db/schema.ts`
  - **Depends on**: TASK-001
  - **Acceptance**:
    - [ ] `content_enrichment` store: PK `content_id`, indexes on `enrichment_status`, `tmdb_id`
    - [ ] `tmdb_negative_cache` store: PK `content_id`, `expiresAt` field
    - [ ] `upgrade(db, oldVersion, newVersion)` handles migrations
  - **Tests**:
    - [ ] `describe('IndexedDB schema')` — `fake-indexeddb` upgrade from v0

- [ ] 6.2 [TASK-042] Create `src/renderer/db/enrichment.ts` (idb wrapper) (type: repo, ~50 LOC)
  - **Files**: `src/renderer/db/enrichment.ts`
  - **Depends on**: TASK-041
  - **Acceptance**:
    - [ ] `getEnrichment(contentId)` → record or null
    - [ ] `upsertEnrichment(record)` → upsert by `content_id`
    - [ ] `getPendingEnrichments()` → filter by `enrichment_status IN ('pending','error')` + expired negative cache
  - **Tests**: `describe('enrichment db')` — CRUD with `fake-indexeddb`

- [ ] 6.3 [TASK-043] Create `src/renderer/db/negative-cache.ts` (idb wrapper) (type: repo, ~30 LOC)
  - **Files**: `src/renderer/db/negative-cache.ts`
  - **Depends on**: TASK-041
  - **Acceptance**:
    - [ ] `get(contentId)` → record or null
    - [ ] `set(contentId, expiresAt)` → upsert with TTL
    - [ ] `isExpired(contentId)` → checks `expiresAt > now`
  - **Tests**: `describe('negative-cache')` — TTL expiry logic

- [ ] 6.4 [TASK-044] RED: Write `queue.test.ts` (semaphore + backoff) (type: test, ~80 LOC)
  - **Files**: `tests/unit/queue.test.ts`
  - **Depends on**: —
  - **Acceptance**:
    - [ ] 5 tasks run in parallel, 6th waits
    - [ ] Backoff: 1st retry after ~1000ms, 2nd after ~2000ms, 3rd after ~4000ms
    - [ ] Concurrency respected under load
  - **Tests**: Vitest `describe('queue')` — mock timers + promise tracking

- [ ] 6.5 [TASK-045] GREEN: Implement `src/renderer/services/queue.ts` (semaphore concurrency=5) (type: logic, ~50 LOC)
  - **Files**: `src/renderer/services/queue.ts`
  - **Depends on**: TASK-044
  - **Acceptance**:
    - [ ] `enqueue(fn)` — runs immediately if <5 active, else waits
    - [ ] `RETRY_BACKOFF_MS = [1000, 2000, 4000] as const` + `random(0, 250)` jitter
  - **Tests**: Inherited from TASK-044

- [ ] 6.6 [TASK-046] Create `src/renderer/services/tmdb-client.ts` (fetch wrapper) (type: logic, ~60 LOC)
  - **Files**: `src/renderer/services/tmdb-client.ts`
  - **Depends on**: TASK-001
  - **Acceptance**:
    - [ ] `searchByImdbId(imdbId, apiKey)` → GET `/find/{imdbId}?external_source=imdb_id`
    - [ ] `searchMovie(query, year, apiKey)` → GET `/search/movie?query=...&year=...`
    - [ ] `searchTv(query, year, apiKey)` → GET `/search/tv?query=...&first_air_date_year=...`
    - [ ] `searchMulti(query, apiKey)` → GET `/search/multi?query=...`
    - [ ] 429 → throw `TmdbRateLimitError`
    - [ ] No key obfuscation in logs (key hash only)
  - **Tests**: `describe('tmdb-client')` — mock fetch for all 4 endpoints

- [ ] 6.7 [TASK-047] Create `src/renderer/workers/enrichment.worker.ts` (Web Worker) (type: logic, ~150 LOC)
  - **Files**: `src/renderer/workers/enrichment.worker.ts`
  - **Depends on**: TASK-045, TASK-046, TASK-002, TASK-023
  - **Acceptance**:
    - [ ] State machine per item: `pending → queued → fetching → succeeded | failed | not_found`
    - [ ] Cascade: IMDb → movie search → TV search → multi fallback
    - [ ] Auto-persist only if `vote_count >= 5` AND `matchConfidence >= 0.85`
    - [ ] `not_found` → writes to negative cache with 30d TTL
    - [ ] Receives `tmdbKey` via `workerData` (not via message channel)
  - **Tests**:
    - [ ] `describe('enrichment-worker')` — full cascade + threshold + negative cache (mock fetch + fake-indexeddb)

- [ ] 6.8 [TASK-048] Create `src/renderer/services/enrichment-controller.ts` (type: logic, ~80 LOC)
  - **Files**: `src/renderer/services/enrichment-controller.ts`
  - **Depends on**: TASK-047
  - **Acceptance**:
    - [ ] `startEnrichment(tmdbKey)` — spawns worker lazily, passes key in workerData
    - [ ] `pauseEnrichment()`, `resumeEnrichment()` — worker message passthrough
    - [ ] On `catalog:ingestion-complete` event → `queryClient.invalidateQueries(['catalog'])` + start
    - [ ] Fetches tmdbKey from main via IPC before spawning worker
  - **Tests**: `describe('enrichment-controller')` — lifecycle (mock worker + IPC)

- [ ] 6.9 [TASK-049] Wire `enrichment:*` IPC handlers (type: wiring, ~30 LOC)
  - **Files**: `src/main/ipc/handlers/enrichment.ts`
  - **Depends on**: TASK-015, TASK-048
  - **Acceptance**:
    - [ ] `enrichment:getStatus` → returns `{ queueLength, lastEnrichedAt, isRunning }` from controller
  - **Tests**: `describe('enrichment handlers')` — status relay

- [ ] 6.10 [TASK-050] Wire `catalog:ingestion-complete` event → enrichment trigger (type: wiring, ~15 LOC)
  - **Files**: `src/main/services/ingest-orchestrator.ts`, `src/renderer/services/enrichment-controller.ts`
  - **Depends on**: TASK-029, TASK-048
  - **Acceptance**:
    - [ ] Worker DONE → `mainWindow.webContents.send('catalog:ingestion-complete', counts)`
    - [ ] Renderer `on('catalog:ingestion-complete')` → `controller.startEnrichment()`
  - **Tests**: E2E test covers the full event chain

---

## Phase 7: UI Features

- [x] 7.1 [TASK-051] Create atoms: `Button`, `Input`, `TextField`, `PasswordField`, `IconButton`, `Spinner`, `Badge`, `Focusable` (type: component, ~200 LOC)
  - **Files**: `src/renderer/components/atoms/{Button,Input,TextField,PasswordField,IconButton,Spinner,Badge,Focusable}.tsx`
  - **Depends on**: TASK-001
  - **Acceptance**:
    - [x] All atoms accept `className` prop for extension
    - [x] `Focusable` wraps D-Pad focus with `react-tv-space-navigation`
    - [x] PasswordField has show/hide toggle
    - [x] Atoms are presentational (no hooks, no API calls)
  - **Tests**: `describe('atoms')` — render without crashing + key prop tests

- [x] 7.2 [TASK-052] Create molecules: `ChannelCard`, `MoviePosterCard`, `SeriesPosterCard`, `EpisodeCard`, `HeroMetadata`, `CredentialFormTabs`, `ProgressOverlay`, `SidebarNavItem`, `SeasonTab` (type: component, ~300 LOC)
  - **Files**: `src/renderer/components/molecules/*.tsx`
  - **Depends on**: TASK-051
  - **Acceptance**:
    - [x] All molecules are presentational (receive data via props)
    - [x] Cards scale 1.05x on focus with blue border
    - [x] `ProgressOverlay` shows live/movies/series counts with animated progress bar
  - **Tests**: `describe('molecules')` — render with sample props

- [x] 7.3 [TASK-053] Create organisms: `HeroBanner`, `ContentCarousel` (react-window), `Sidebar`, `DetailHeader`, `EpisodeGrid` (type: component, ~350 LOC)
  - **Files**: `src/renderer/components/organisms/*.tsx`
  - **Depends on**: TASK-051, TASK-052
  - **Acceptance**:
    - [x] `HeroBanner` — fanart background with gradient overlay, title/year/genre/synopsis, Play + More Info buttons
    - [x] `ContentCarousel` — `react-window` `InfiniteGrid`, lazy loads ~10 cards at a time
    - [x] `Sidebar` — collapsible 80px↔260px with D-Pad focus
    - [x] All organisms are presentational
  - **Tests**: `describe('organisms')` — render + virtualization DOM check

- [x] 7.4 [TASK-054] Create `src/renderer/queries/use-catalog.ts` (TanStack Query hooks) (type: query, ~60 LOC)
  - **Files**: `src/renderer/queries/use-catalog.ts`
  - **Depends on**: TASK-018
  - **Acceptance**:
    - [x] `useCatalogList(type, params)` → query key `['catalog', type, params]`
    - [x] `useContentById(type, id)` → query key `['content', type, id]`
    - [x] Polling via `refetchInterval` where appropriate
  - **Tests**: `describe('use-catalog')` — mock API + query key inspection

- [x] 7.5 [TASK-055] Create `src/renderer/queries/use-ingest.ts` (mutations) (type: query, ~50 LOC)
  - **Files**: `src/renderer/queries/use-ingest.ts`
  - **Depends on**: TASK-018
  - **Acceptance**:
    - [x] `useStartIngest()` → optimistic update on `['ingest', 'currentJob']`
    - [x] `useCancelIngest()`
    - [x] `useIngestProgress()` → polls with `refetchInterval: 500`
  - **Tests**: `describe('use-ingest')` — mutation triggers + optimistic update

- [x] 7.6 [TASK-056] Create `src/renderer/queries/use-enrichment.ts` and `use-tmdb-key.ts` (type: query, ~40 LOC)
  - **Files**: `src/renderer/queries/use-enrichment.ts`, `src/renderer/queries/use-tmdb-key.ts`
  - **Depends on**: TASK-018
  - **Acceptance**:
    - [x] `useEnrichmentStatus()` → polls with `refetchInterval: (data) => data?.isRunning ? 2000 : false`
    - [x] `useTmdbKey()`, `useSetTmdbKey()`, `useClearTmdbKey()`
  - **Tests**: `describe('use-enrichment')` — polling interval logic

- [x] 7.7 [TASK-057] Build `features/ingest/IngestPage.tsx` + `CredentialsForm` + `IngestOverlay` (type: feature, ~200 LOC)
  - **Files**: `src/renderer/features/ingest/{IngestPage,CredentialsForm,IngestOverlay}.tsx`
  - **Depends on**: TASK-051, TASK-052, TASK-054, TASK-055
  - **Acceptance**:
    - [x] Tab switch: Xtream (4 fields) / M3U (URL + local file)
    - [x] URL validation: must start with `http://` or `https://`
    - [x] `IngestOverlay` appears on start, shows real-time counts, auto-transitions to dashboard on DONE
    - [x] Error state: red message + Retry button
  - **Tests**: `describe('IngestPage')` — tab switch, validation, overlay states

- [x] 7.8 [TASK-058] Build `features/dashboard/DashboardPage.tsx` (type: feature, ~250 LOC)
  - **Files**: `src/renderer/features/dashboard/DashboardPage.tsx`, `src/renderer/features/dashboard/useDashboardData.ts`
  - **Depends on**: TASK-051, TASK-052, TASK-053, TASK-054
  - **Acceptance**:
    - [x] Sidebar with Home/Live TV/Movies/Series/Favorites/Settings
    - [x] Hero banner (top 45%) with featured content
    - [x] Carousels: Continue Watching, Live Channels, Recent Movies, Recent Series
    - [x] Empty carousels hidden
    - [x] Degraded mode: fallback gradient if no enrichment
  - **Tests**: `describe('DashboardPage')` — renders with mock data + degraded fallback

- [x] 7.9 [TASK-059] Build `features/detail/DetailPage.tsx` + `MovieDetail` + `SeriesDetail` (type: feature, ~200 LOC)
  - **Files**: `src/renderer/features/detail/{DetailPage,MovieDetail,SeriesDetail}.tsx`
  - **Depends on**: TASK-051, TASK-052, TASK-053, TASK-054
  - **Acceptance**:
    - [x] Movie: two-panel (poster left, metadata right), Play + Favorites buttons
    - [x] Series: poster left, info + Season tabs + Episode grid right
    - [x] Backdrop background with blur + overlay
    - [x] Degraded: placeholder poster, raw name as title, "No enriched metadata" indicator
  - **Tests**: `describe('DetailPage')` — movie + series layouts, degraded fallback

- [x] 7.10 [TASK-060] Add routes `/`, `/ingest`, `/content/:id` to `App.tsx` (type: wiring, ~15 LOC)
  - **Files**: `src/renderer/App.tsx`
  - **Depends on**: TASK-057, TASK-058, TASK-059
  - **Acceptance**:
    - [x] `/` → `<DashboardPage />`
    - [x] `/ingest` → `<IngestPage />`
    - [x] `/content/:id` → `<DetailPage />`
  - **Tests**: None (routing smoke test in E2E)

---

## Phase 8: E2E + Polish

- [x] 8.1 [TASK-061] E2E: `ingest-to-dashboard.spec.ts` (type: e2e, ~120 LOC)
  - **Files**: `tests/e2e/ingest-to-dashboard.spec.ts`
  - **Depends on**: TASK-060
  - **Acceptance**:
    - [x] Launch app → navigate to `/ingest`
    - [x] Submit valid M3U URL → overlay appears
    - [x] Wait for DONE → redirected to dashboard
    - [x] Dashboard shows content carousels
    - [ ] FPS ≥ 55 during 20k item ingestion (REQ-INGEST-1, TEST-01) — requires Electron E2E runner
  - **Tests**: Playwright `test('ingest-to-dashboard')`

- [x] 8.2 [TASK-062] E2E: `detail-view.spec.ts` (type: e2e, ~80 LOC)
  - **Files**: `tests/e2e/detail-view.spec.ts`
  - **Depends on**: TASK-059, TASK-061
  - **Acceptance**:
    - [x] Dashboard → click movie card → detail view renders
    - [x] Detail → click More Info → series detail shows season tabs + episodes
    - [x] Backdrop renders or fallback gradient used
  - **Tests**: Playwright `test('detail-view')`

- [x] 8.3 [TASK-063] E2E: `degraded-mode.spec.ts` (type: e2e, ~80 LOC)
  - **Files**: `tests/e2e/degraded-mode.spec.ts`
  - **Depends on**: TASK-058, TASK-059
  - **Acceptance**:
    - [x] App without TMDB key → dashboard renders with placeholders
    - [x] Movie detail → raw name as title, no poster, "No enriched metadata" shown
    - [x] Series detail → season tabs work even without enrichment
  - **Tests**: Playwright `test('degraded-mode')`

- [x] 8.4 [TASK-064] E2E: Cancel ingestion test (type: e2e, ~60 LOC)
  - **Files**: `tests/e2e/cancel-ingest.spec.ts`
  - **Depends on**: TASK-057
  - **Acceptance**:
    - [x] Start ingestion → at 50% click cancel → overlay returns to form
    - [x] Catalog does not include partial results from cancelled run
  - **Tests**: Playwright `test('cancel-ingest')`

- [ ] 8.5 [TASK-065] Manual QA verification (type: polish, ~0 LOC)
  - **Files**: None
  - **Depends on**: TASK-061, TASK-062, TASK-063
  - **Acceptance**:
    - [ ] DevTools Performance: 55 FPS during ingestion of 20k items
    - [ ] No console errors on cold start
    - [ ] `electron-rebuild` produces working `better-sqlite3` native module
  - **Tests**: Manual verification checklist (not automated)

---

## Threat Matrix RED Tests (mandatory before production code)

- [ ] RED-001: `m3u-client.test.ts` — local file path outside userData → `INVALID_INPUT`
- [ ] RED-002: `xtream-client.test.ts` — network timeout → `CONNECTION_ERROR`
- [ ] RED-003: `ipc-handlers.test.ts` — Zod invalid input → `INVALID_INPUT` error code
- [ ] RED-004: `encryption.test.ts` — tamper ciphertext → throws/detects auth failure
- [ ] RED-005: `tmdb-key.test.ts` — invalid key 401 → `{ valid: false }`, NOT persisted
- [ ] RED-006: `enrichment-worker.test.ts` — vote_count < 5 → status stays `pending`
