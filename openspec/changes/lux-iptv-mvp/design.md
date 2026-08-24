# Design: Lux IPTV MVP — Slice 1 (Ingestion + Enrichment)

> **Status:** Implementable. Decisiones marcadas como **[DECIDED]** están fijadas por la propuesta/specs y NO se revierten. Las marcadas como **[SUGGESTED]** son recomendaciones que el equipo puede discutir.

---

## Architecture Overview

El slice 1 corre en tres procesos de Electron con un modelo de responsabilidades estricto: el **main process** es la única autoridad sobre el catálogo SQLite; el **renderer** es la única autoridad sobre `ContentEnrichment` (IndexedDB); el bridge IPC es el único canal de comunicación.

```
+--------------------------- ELECTRON MAIN PROCESS ----------------------------+
|                                                                              |
|  src/main/index.ts                                                            |
|       |                                                                       |
|       +-- mainWindow (BrowserWindow)                                          |
|       |       |                                                               |
|       |       v                                                               |
|       +-- IPC Router (ipcMain.handle)  <----- contextBridge ---->  PRELOAD    |
|       |                                                                       |
|       +-- Ingest Orchestrator (src/main/services/ingest-orchestrator.ts)     |
|       |       |                                                               |
|       |       v                                                               |
|       +-- worker_threads: src/main/workers/ingest-worker.ts                   |
|       |       |                                                               |
|       |       +-- Xtream Client ----> https://provider/player_api.php        |
|       |       +-- M3U Parser  -----> iptv-m3u-playlist-parser                |
|       |       +-- Classifier   -----> 6-stage heuristic (DOC-3 §3.2)          |
|       |       +-- Drizzle Repo -------> better-sqlite3 (catalog.db)          |
|       |                                                                       |
|       +-- TMDB Key Vault (src/main/services/tmdb-key.ts)                      |
|       |       |                                                               |
|       |       v                                                               |
|       +-- userData/tmdb-key.enc (AES-256-GCM, scrypt(HWID))                  |
|                                                                              |
+------------------------------------------------------------------------------+
                                      |
                                      | IPC events (progress, completion)
                                      | IPC invoke (catalog queries, key access)
                                      v
+--------------------------- ELECTRON RENDERER --------------------------------+
|                                                                              |
|  src/renderer/main.tsx                                                         |
|       |                                                                       |
|       +-- <QueryClientProvider>  (TanStack Query)                             |
|       |       |                                                               |
|       |       +-- Routes                                                     |
|       |       |    |-- /ingest  --> features/ingest                           |
|       |       |    |-- /         --> features/dashboard                       |
|       |       |    +-- /content/:id --> features/detail                      |
|       |       |                                                               |
|       |       +-- window.luxAPI  (typed wrapper over contextBridge)          |
|       |                                                                       |
|       +-- Web Worker: src/renderer/workers/enrichment.worker.ts              |
|       |       |                                                               |
|       |       +-- TMDB Client  ----> https://api.themoviedb.org/3            |
|       |       +-- Queue  (concurrency=5, backoff=[1k,2k,4k]+jitter)         |
|       |       +-- Preprocessor  (sanitización, IMDb/season/year extract)     |
|       |       |                                                               |
|       |       v                                                               |
|       +-- IndexedDB (idb library)                                              |
|            |-- store: content_enrichment  (PK: content_id)                   |
|            |-- store: tmdb_negative_cache  (TTL 30d)                          |
|            +-- store: tmdb_key  [opcional, ver §TMDB Key Encryption]         |
|                                                                              |
+------------------------------------------------------------------------------+
```

**Reglas de oro (decididas):**
1. La UI nunca espera a TMDB. La ingesta termina cuando el catálogo SQLite tiene `enrichment_status='pending'`.
2. El main nunca escribe a IndexedDB. El renderer nunca escribe a SQLite.
3. La TMDB API key se descifra en main y se entrega al renderer via IPC solo cuando el worker la pide; nunca se persiste en plaintext en el renderer.

---

## Module Breakdown

### Module: Ingest Worker (Node `worker_threads`)

> **[DECIDED]** El ingest worker corre como `worker_threads` de Node en el main process (NO como Web Worker del browser) porque necesita acceso síncrono a `better-sqlite3`. Los Web Workers del renderer no pueden cargar módulos nativos.

- **Ubicación:** `src/main/workers/ingest-worker.ts`
- **Spawn:** desde `src/main/services/ingest-orchestrator.ts` usando `new Worker(path, { workerData })`.
- **Lifecycle:** lazy (se crea en el primer `ingest.start`), se termina con `worker.terminate()` después de `INGEST_DONE` o `INGEST_ERROR`.
- **Mensajes (parentPort):**
  - Recibe: `{ type: 'START', payload: { source: 'xtream'|'m3u', credentials|url, listName } }`
  - Emite: `{ type: 'PROGRESS', live, movies, series, radio, total, phase }`
  - Emite: `{ type: 'DONE', counts: { live, movies, series, radio, total }, durationMs }`
  - Emite: `{ type: 'ERROR', code: 'AUTH_FAILED'|'CONNECTION_ERROR'|'PARSE_ERROR'|'DB_ERROR', message, retryable }`
  - Recibe: `{ type: 'CANCEL' }` → setea `aborted=true`, el worker termina con `{ type: 'DONE', counts: { aborted: true } }`.
- **Fases internas:**
  1. `FETCH_CATEGORIES` — `getLiveCategories`, `getVODCategories`, `getSeriesCategories` (Xtream) o scan del M3U.
  2. `FETCH_ITEMS` — `getLiveStreams`, `getVODStreams`, `getSeriesStreams` por categoría, o parse del M3U completo.
  3. `CLASSIFY` — heurística 6-stage (DOC-3 §3.2).
  4. `PERSIST` — batches de 1,000 (REQ-CATALOG-2) en transacción Drizzle.
  5. `SIGNAL_DONE` — emite `DONE` con counts finales.

### Module: SQLite Schema + Drizzle

- **Ubicación del archivo DB:** `app.getPath('userData') + '/catalog.db'`.
- **Driver:** `better-sqlite3` (instalar dependencia; `drizzle-orm` ya está en `package.json`).
- **Schema:** `src/main/db/schema.ts` (Drizzle). Migraciones generadas en `src/main/db/migrations/` vía `drizzle-kit generate`.
- **Versión:** tabla `schema_version(version INTEGER PRIMARY KEY, applied_at INTEGER)`. Runner: `src/main/db/migrate.ts` ejecutado en `app.whenReady()` antes de instanciar el BrowserWindow.

**Tablas (Drizzle DSL → SQL inferido):**

```ts
// src/main/db/schema.ts (extracto)
export const liveChannels = sqliteTable('live_channels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  xtreamId: integer('xtream_id'),                          // nullable, index
  name: text('name').notNull(),
  url: text('url').notNull().unique(),                     // dedupe key fallback
  groupTitle: text('group_title'),
  tvgId: text('tvg_id'),
  tvgLogo: text('tvg_logo'),
  streamType: text('stream_type').notNull().default('live'),
  addedAt: integer('added_at').notNull(),                  // epoch ms
}, (t) => ({
  byXtreamId: uniqueIndex('live_xtream_id_uq').on(t.xtreamId).where(sql`${t.xtreamId} IS NOT NULL`),
  byName: index('live_name_idx').on(t.name),
  byGroup: index('live_group_idx').on(t.groupTitle),
}));

// vod_movies, series, episodes análogos.
// episodes.seriesId integer('series_id').notNull().references(() => series.id, { onDelete: 'cascade' })
```

- **Dedupe:** `INSERT ... ON CONFLICT(url) DO UPDATE SET name=excluded.name, group_title=excluded.group_title, ...` (REQ-CATALOG-4).
- **Batch insert:** helper `bulkInsert(table, rows: T[])` en `src/main/db/repo.ts` que parte en chunks de 1,000 y envuelve cada chunk en `db.transaction(...)`.

### Module: TMDB Enrichment Queue (renderer-side)

> **[DECIDED]** El enrichment corre en el renderer (Web Worker de browser) porque necesita acceso a IndexedDB. La justificación está en la sección "Arquitectura" arriba.

- **Ubicación:** `src/renderer/workers/enrichment.worker.ts`.
- **Spawn:** lazy desde `src/renderer/services/enrichment-controller.ts` después de recibir el evento IPC `catalog:ingestion-complete` o al montar el dashboard si hay items `pending`.
- **State machine (cada item):**
  ```
  pending → queued → fetching → succeeded (enriched)
                              ↘ failed → retry_backoff → queued (intento N<3)
                                                       ↘ error (intento N==3)
                              ↘ not_found (enriched con tmdb_id=null) → negative_cached (30d)
  ```
- **Constantes (REQ-ENRICH-3):**
  ```ts
  const HYDRATION_CONCURRENCY = 5;
  const RETRY_BACKOFF_MS = [1000, 2000, 4000] as const;
  const NEGATIVE_CACHE_TTL_DAYS = 30;
  const CONFIDENCE_AUTO_PERSIST = 0.85;
  const MIN_VOTE_COUNT = 5;
  ```
- **Concurrencia:** implementación custom de semáforo (5 slots) en `src/renderer/services/queue.ts` — **[SUGGESTED]** agregar `p-limit` como dependencia si se prefiere, pero un semáforo de 30 líneas evita una dep.
- **Backoff:** `RETRY_BACKOFF_MS[attempts] + random(0, 250)` (jitter anti-thundering-herd).
- **Negative cache:** store `tmdb_negative_cache` con `{ contentId, expiresAt }`. Antes de encolar, `enrichment-controller` chequea este store; si `expiresAt > now`, salta.
- **Cascada de búsqueda (REQ-ENRICH-2):**
  1. `imdbId` presente → `GET /find/{imdb_id}?external_source=imdb_id` (matchConfidence 1.0)
  2. `type='movie' && year` → `GET /search/movie?query=...&year=...`
  3. `type='tv' && year` → `GET /search/tv?query=...&first_air_date_year=...`
  4. fallback → `GET /search/multi?query=...`
- **Persistencia:** solo auto-persiste si `vote_count >= 5` AND `matchConfidence >= 0.85` (REQ-ENRICH-4). Si falla, `enrichment_status='pending'` y no escribe el registro.

### Module: TMDB API Key Encryption

> **[DECIDED]** La key se almacena en `userData/tmdb-key.enc` (no en IndexedDB, como proponía DOC-8 §8.7). Razones: (a) simplicidad de filesystem API desde main, (b) sobrevive a un reset de la DB del catálogo.

- **Algoritmo:** AES-256-GCM con `iv` de 12 bytes y `authTag` de 16 bytes.
- **Key derivation:** `scryptSync(passphrase=HWID, salt=STATIC_SALT, N=2^15, r=8, p=1, keylen=32)` — **[SUGGESTED]** `argon2id` si el equipo prefiere memoria-hard contra GPUs; `scrypt` es built-in y suficiente para MVP.
- **HWID:** `node-machine-id` (ya instalado). Cache en memoria, descartable.
- **Static salt:** constante en código (`src/main/services/encryption.ts`) — OK para MVP, no es un secreto. Si el equipo quiere rotarlo: derivar de HWID + `app.getPath('userData')` hash.
- **Formato del archivo:**
  ```
  [12 bytes IV][N bytes ciphertext][16 bytes authTag]
  ```
  Codificado en base64 con prefijo de versión (`v1:`).
- **API pública (`src/main/services/tmdb-key.ts`):**
  ```ts
  export async function setTmdbKey(plain: string): Promise<{ valid: boolean }>;
  export function hasTmdbKey(): boolean;
  export async function getTmdbKeyPlain(): Promise<string | null>; // decrypt on demand, never cached long-lived
  export async function clearTmdbKey(): Promise<void>;
  ```
- **Validación en `setTmdbKey`:** hace `GET https://api.themoviedb.org/3/configuration?api_key=...` con timeout 5s. 200 OK → encrypt + write. 401 → throw `InvalidKeyError`. Network error → throw `KeyValidationNetworkError`.
- **Acceso desde el enrichment worker del renderer:** el renderer pide la key al main via `window.luxAPI.tmdb.getKey()` solo una vez al spawn del worker. El worker la guarda en variable de módulo (memoria, no IndexedDB) y la descarta al terminar. **[SUGGESTED]** Ofuscar con `crypto.subtle.digest('SHA-256', key)` en logs.

### Module: IPC Bridge

- **Exposición:** `contextBridge.exposeInMainWorld('luxAPI', api)` en `src/preload/index.ts`.
- **Namespace:** `window.luxAPI.*` (decidido por el user prompt; el spec decía `electronAPI` pero el user es la autoridad).
- **API completa (con tipos en `src/shared/types/ipc.ts`):**

| Método | Input | Output | Validación Zod |
|---|---|---|---|
| `ingest.start(source)` | `{ source: 'xtream'\|'m3u', credentials?, url?, listName }` | `{ jobId: string }` | `IngestStartInputSchema` |
| `ingest.cancel(jobId)` | `{ jobId: string }` | `void` | — |
| `ingest.getProgress(jobId)` | `{ jobId: string }` | `{ phase, percent, counts }` | `IngestProgressSchema` |
| `ingest.onProgress(cb)` | event listener | unsubscribe fn | — |
| `catalog.list({ type, limit, offset })` | `{ type: 'live'\|'movie'\|'series', limit=50, offset=0, search? }` | `{ items: Item[], total: number }` | `CatalogListInputSchema` |
| `catalog.getById({ type, id })` | `{ type, id: number }` | `Item` (o `{ series, seasons }` si series) | `CatalogGetByIdInputSchema` |
| `enrichment.getStatus()` | — | `{ queueLength, lastEnrichedAt, isRunning }` | — |
| `tmdb.setKey(plain)` | `{ key: string }` | `{ valid: boolean }` | `TmdbKeyInputSchema` |
| `tmdb.hasKey()` | — | `boolean` | — |
| `tmdb.getKey()` | — | `{ key: string } \| null` (solo main→renderer, sin pasar por contextBridge directo) | internal IPC, no exposed |
| `tmdb.clearKey()` | — | `void` | — |

- **Validación en el boundary:** cada `ipcMain.handle('channel', ...)` envuelve el input con el Zod schema correspondiente (`safeParse`). Si falla, retorna `{ error: { code: 'INVALID_INPUT', details: result.error.flatten() } }` (REQ-IPC-4).
- **Errores estructurados:** `ErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'DB_CORRUPTED' | 'INGEST_IN_PROGRESS' | 'AUTH_FAILED' | 'NETWORK' | 'TMDB_RATE_LIMIT' | 'INTERNAL'`. Definido en `src/shared/types/ipc.ts`.
- **`nodeIntegration: false` + `contextIsolation: true`** en la `BrowserWindow` (ya en `src/main/index.ts`).

### Module: TanStack Query Setup

- **Provider:** `<QueryClientProvider client={queryClient}>` en `src/renderer/main.tsx`, envolviendo `<RouterProvider>`.
- **Client config (`src/renderer/lib/query-client.ts`):**
  ```ts
  new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 5 * 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
  ```
- **Query keys:**
  - `['catalog', type, { search, limit, offset }]`
  - `['content', type, id]`
  - `['enrichment', 'status']`
  - `['tmdb', 'hasKey']`
- **Mutations:** `useStartIngest`, `useCancelIngest`, `useSetTmdbKey`, `useClearTmdbKey`.
- **Polling:** `useEnrichmentStatus` con `refetchInterval: (data) => (data?.isRunning ? 2000 : false)`.
- **Invalidations:** cuando el bridge emite `catalog:ingestion-complete`, el controller hace `queryClient.invalidateQueries({ queryKey: ['catalog'] })` y `['content']`.
- **Optimistic updates:** `useStartIngest` aplica un update optimista en `['ingest', 'currentJob']` para mostrar el overlay al instante.

### Module: UI Components (Stitch Cinematic Glass)

> **[SUGGESTED]** Estructura atómica inspirada en la guía Stitch (`iptv-ui-prototypes.md`). El equipo puede ajustar nombres.

**Atoms (`src/renderer/components/atoms/`):**
`Button`, `Input`, `TextField`, `PasswordField`, `IconButton`, `Spinner`, `ProgressBar`, `Badge`, `Focusable` (wrapper de D-Pad focus con `react-tv-space-navigation`).

**Molecules (`src/renderer/components/molecules/`):**
`ChannelCard`, `MoviePosterCard`, `SeriesPosterCard`, `EpisodeCard`, `HeroMetadata`, `CredentialFormTabs`, `ProgressOverlay`, `SidebarNavItem`, `SeasonTab`.

**Organisms (`src/renderer/components/organisms/`):**
`HeroBanner` (Screen 3 hero, top 45%), `ContentCarousel` (virtualizado con `react-window` InfiniteGrid), `Sidebar` (colapsable 80px↔260px), `DetailHeader`, `EpisodeGrid`.

**Features (`src/renderer/features/`):**
- `ingest/` — `IngestPage` (container) + `CredentialsForm` (presentational) + `IngestOverlay` (presentational).
- `dashboard/` — `DashboardPage` (container) + `useDashboardData` hook.
- `detail/` — `DetailPage` (container) + `MovieDetail` + `SeriesDetail` + `useContentData` hook.

**Container/presentational split:** containers son los únicos que importan de `queries/` y `services/`; los presentational reciben todo por props y son testeables con `@testing-library/react` sin mocks.

**Design tokens:** definidos en `tailwind.config.ts` extendiendo el theme (paleta zinc-950, blue-600 focus, amber-500 alternative, glassmorphism utilities). Safe area 5% aplicado via clase `.safe-area` (padding 48px X / 32px Y).

---

## Data Flow

### Flujo 1: Ingesta Xtream

```
[User] click "Iniciar Ingesta"
    │
    ▼
[Renderer] useStartIngest.mutate({ source: 'xtream', credentials })
    │
    ▼
[Preload] window.luxAPI.ingest.start(input)
    │
    ▼ ipcRenderer.invoke('ingest:start', validatedInput)
    │
[Main] ipcMain.handle('ingest:start') → IngestOrchestrator.start()
    │   ├─ jobId = uuid()
    │   ├─ worker = new Worker('ingest-worker.js', { workerData: { jobId, ... } })
    │   └─ worker.postMessage({ type: 'START', payload })
    ▼
[Worker] download categories (Xtream) / fetch M3U
    │   for each batch of 100:
    │     ├─ parse + classify
    │     └─ parentPort.postMessage({ type: 'PROGRESS', live, movies, series, total, phase })
    ▼
[Main] worker.on('message', PROGRESS)
    │   └─ mainWindow.webContents.send('ingest:progress', { jobId, ... })
    ▼
[Renderer] window.luxAPI.ingest.onProgress(cb) → updates Zustand store → ProgressOverlay re-render
    │
    ▼ (eventualmente)
[Worker] last batch persisted → postMessage({ type: 'DONE', counts })
    │
[Main] worker.terminate(); mainWindow.webContents.send('ingest:done', { counts, durationMs })
    │
[Renderer] queryClient.invalidateQueries(['catalog']) + enrichment controller encola pending items
    │
    ▼
[Enrichment Worker] (spawned lazily) fetch TMDB por item, write IndexedDB
    │
    ▼
[Renderer] TanStack Query polling ve nuevos items, UI renderiza
```

### Flujo 2: TMDB Key Setup

```
[User] abre Settings (slice 5) → "Validar y Guardar"
    │
[Renderer] useSetTmdbKey.mutate({ key })
    │
[Preload] window.luxAPI.tmdb.setKey({ key })
    │
[Main] ipcMain.handle('tmdb:setKey')
    │   ├─ zod parse
    │   ├─ fetch('https://api.themoviedb.org/3/configuration?api_key=' + key)  (5s timeout)
    │   ├─ if 200: encrypt(key, hwid) → write userData/tmdb-key.enc; return { valid: true }
    │   └─ if 401: return { valid: false, code: 'INVALID_KEY' }
    ▼
[Renderer] queryClient.invalidateQueries(['tmdb']) → if valid, enrichment controller puede arrancar
```

---

## File Structure

```
/home/traucus/desarrollos_softam/iptv/
├── package.json                              # ADD: better-sqlite3, @types/better-sqlite3, iptv-m3u-playlist-parser, @tanstack/react-query, idb
├── drizzle.config.ts                         # NEW: apunta a src/main/db/schema.ts, out src/main/db/migrations
├── playwright.config.ts                      # EXISTS, agregar proyectos Electron
├── vitest.config.ts                          # EXISTS, OK
│
├── src/
│   ├── main/
│   │   ├── index.ts                          # EXISTS, modificar: app.whenReady → migrate → createWindow
│   │   ├── db/
│   │   │   ├── schema.ts                     # NEW: Drizzle schema
│   │   │   ├── client.ts                     # NEW: better-sqlite3 + drizzle instance
│   │   │   ├── repo.ts                       # NEW: bulkInsert + queries tipadas
│   │   │   ├── migrate.ts                    # NEW: runner manual (drizzle migrate falla en binarios packed; usamos readdir+exec)
│   │   │   └── migrations/                   # NEW: generadas por drizzle-kit
│   │   ├── workers/
│   │   │   └── ingest-worker.ts              # NEW: worker_threads
│   │   ├── services/
│   │   │   ├── ingest-orchestrator.ts        # NEW: spawn/terminate + state machine de jobs
│   │   │   ├── xtream-client.ts              # NEW: player_api.php wrapper
│   │   │   ├── m3u-client.ts                 # NEW: stream download + iptv-m3u-playlist-parser
│   │   │   ├── classifier.ts                 # NEW: 6-stage heuristic
│   │   │   ├── encryption.ts                 # NEW: AES-GCM + scrypt
│   │   │   ├── tmdb-key.ts                   # NEW: vault public API
│   │   │   └── tmdb-validate.ts              # NEW: /configuration ping
│   │   └── ipc/
│   │       ├── index.ts                      # NEW: registerHandlers() invoked from main/index.ts
│   │       └── handlers/
│   │           ├── ingest.ts                 # NEW: ingest:start, ingest:cancel, ingest:progress
│   │           ├── catalog.ts                # NEW: catalog:list, catalog:getById
│   │           ├── enrichment.ts             # NEW: enrichment:getStatus, enrichment:trigger
│   │           └── tmdb.ts                   # NEW: tmdb:setKey, tmdb:hasKey, tmdb:clearKey
│   │
│   ├── preload/
│   │   └── index.ts                          # EXISTS, REWRITE: contextBridge.exposeInMainWorld('luxAPI', api)
│   │
│   ├── shared/
│   │   ├── types/
│   │   │   ├── ipc.ts                        # NEW: LuxAPI interface + ErrorCode enum
│   │   │   ├── catalog.ts                    # NEW: LiveChannel, VodMovie, Series, Episode (sin enriched data)
│   │   │   ├── ingest.ts                     # NEW: IngestSource, IngestJob, Progress
│   │   │   └── tmdb.ts                       # NEW: TmdbMatch, EnrichmentStatus
│   │   └── schemas/
│   │       ├── ingest.ts                     # NEW: Zod schemas
│   │       ├── catalog.ts                    # NEW: Zod schemas
│   │       └── tmdb.ts                       # NEW: Zod schemas
│   │
│   └── renderer/
│       ├── main.tsx                          # EXISTS, modificar: envolver con QueryClientProvider
│       ├── App.tsx                           # EXISTS, modificar: rutas
│       ├── lib/
│       │   ├── query-client.ts               # NEW
│       │   └── api.ts                        # NEW: typed wrapper de window.luxAPI
│       ├── db/
│       │   ├── enrichment.ts                 # NEW: idb wrapper para content_enrichment store
│       │   ├── negative-cache.ts             # NEW: idb wrapper para tmdb_negative_cache
│       │   └── schema.ts                     # NEW: definiciones de stores + upgrade
│       ├── workers/
│       │   └── enrichment.worker.ts          # NEW: Web Worker con queue + tmdb-client
│       ├── services/
│       │   ├── enrichment-controller.ts      # NEW: lifecycle (spawn/pause/cancel) + tmdb key fetch
│       │   ├── tmdb-client.ts                # NEW: fetch wrapper (solo usado desde worker)
│       │   ├── queue.ts                      # NEW: semaphore de 5
│       │   └── preprocessor.ts               # NEW: sanitización IMDb/year/season (4 regex de DOC-8 §8.3)
│       ├── queries/
│       │   ├── use-catalog.ts                # NEW: useCatalogList, useContentById
│       │   ├── use-ingest.ts                 # NEW: useStartIngest, useCancelIngest, useIngestProgress
│       │   ├── use-enrichment.ts             # NEW: useEnrichmentStatus (con polling 2s)
│       │   └── use-tmdb-key.ts               # NEW: useTmdbKey, useSetTmdbKey
│       ├── components/
│       │   ├── atoms/                        # NEW: Button, Input, Focusable, etc.
│       │   ├── molecules/                    # NEW: ChannelCard, MoviePosterCard, etc.
│       │   └── organisms/                    # NEW: HeroBanner, ContentCarousel, Sidebar
│       └── features/
│           ├── ingest/                       # NEW: IngestPage, CredentialsForm, IngestOverlay
│           ├── dashboard/                    # NEW: DashboardPage, useDashboardData
│           └── detail/                       # NEW: DetailPage, MovieDetail, SeriesDetail
│
└── tests/
    ├── unit/                                 # NEW
    │   ├── classifier.test.ts
    │   ├── preprocessor.test.ts
    │   ├── encryption.test.ts
    │   ├── queue.test.ts
    │   └── repo.test.ts
    ├── integration/                          # NEW
    │   ├── ingest-worker.test.ts             # con DB in-memory
    │   ├── ipc-handlers.test.ts              # mock ipcMain.invoke
    │   └── enrichment-worker.test.ts         # mock TMDB API
    └── e2e/                                  # NEW
        ├── ingest-to-dashboard.spec.ts
        ├── detail-view.spec.ts
        └── degraded-mode.spec.ts
```

**Dependencias a agregar en `package.json`:**
- `better-sqlite3` (runtime)
- `@types/better-sqlite3` (dev)
- `iptv-m3u-playlist-parser` (runtime)
- `@tanstack/react-query` (runtime)
- `idb` (runtime, IndexedDB wrapper)
- `react-tv-space-navigation` (runtime, **[SUGGESTED]** para D-Pad)
- `react-window` (runtime, virtualización)
- `electron-rebuild` ya está — verificar postinstall hook para rebuildar `better-sqlite3`.

**Nota sobre `drizzle.config.ts`:** Drizzle-kit se usa solo en dev para `generate` de migraciones. El `migrate` real corre desde código (`drizzle-orm/better-sqlite3/migrator`) para que funcione en la app empaquetada sin CLI.

---

## Testing Strategy

| Layer | What to Test | Approach | Vitest/Playwright |
|---|---|---|---|
| Unit | `preprocessor.ts` regex (4 escenarios DOC-8 §8.3 + fixtures ruidosos) | Fixtures en `tests/fixtures/iptv-names.json` | Vitest |
| Unit | `classifier.ts` 6-stage heuristic | Tabla de pares (input, expectedKind) | Vitest |
| Unit | `encryption.ts` roundtrip + tamper detection | encrypt → decrypt → assert; flip 1 byte → throws | Vitest |
| Unit | `queue.ts` semaphore: 5 paralelos, respeta backoff | Mock timers + promises | Vitest |
| Unit | `tmdb-key.ts` valid path + 401 + network | Mock `fetch` con msw | Vitest |
| Integration | Drizzle repo: bulkInsert 8,000 rows < 50ms/batch | DB in-memory (`new Database(':memory:')`) | Vitest |
| Integration | Ingest worker end-to-end con M3U fixture + DB in-memory | `new Worker(...)` + esperar `DONE` | Vitest (con `--pool=forks`) |
| Integration | IPC handlers con mock context (testea Zod validation) | Mock `ipcMain.handle` y assert payload | Vitest |
| Integration | Enrichment worker: mock TMDB fetch + assert IndexedDB writes | Mock `fetch` + `fake-indexeddb` | Vitest |
| E2E | Flujo completo: launch app → ingest M3U local → dashboard → detail | Playwright `_electron` | Playwright |
| E2E | Modo degradado: app sin TMDB key, dashboard renderiza sin posters | Playwright + no TMDB en stub | Playwright |
| E2E | 55 FPS durante ingesta 20k items (REQ-INGEST-1, TEST-01) | Playwright `page.evaluate(() => performance)` | Playwright |
| E2E | Cancelación: start ingest, cancel a 50%, assert UI vuelve a form | Playwright | Playwright |

**TDD rule:** cada test RED se escribe antes del código de producción que lo satisface. No se commitea código sin su test verde. Coverage objetivo: ≥ 85% en `src/main/services/`, `src/main/db/`, `src/renderer/services/`, `src/renderer/workers/`.

---

## Threat Matrix

> **[SUGGESTED]** Esta sección es relevante porque la ingesta ejecuta shell-comands indirectas (HTTP requests, file reads) y maneja archivos locales.

| Boundary | Applicable? | Safe Behavior | Failure Behavior | RED Test |
|---|---|---|---|---|
| Subprocess execution (shell) | N/A — no hay `child_process` en este slice | — | — | — |
| File reads (M3U local) | **Yes** | `app.getPath('userData')` whitelist + extension check (`.m3u`/`.m3u8`) | Si path fuera de whitelist o extensión inválida → `INVALID_INPUT` | `m3u-client.test.ts` |
| VCS/PR automation | N/A — no se hace automation de git en runtime | — | — | — |
| Executable classification | N/A | — | — | — |
| Process integration | N/A | — | — | — |
| Network egress (Xtream, TMDB) | **Yes** | HTTPS only, timeout 15s, max response 100MB | Abort + retry classification | `xtream-client.test.ts` |
| IPC channel | **Yes** | Zod validation en todo input, no `ipcRenderer` en renderer sin contextBridge | Estructured error code | `ipc-handlers.test.ts` |

---

## Migration / Rollout

- **DB:** primera ejecución crea `catalog.db` con `schema_version=1`. Migraciones futuras: agregar columna `ALTER TABLE ... ADD COLUMN ...` envuelto en try/catch para idempotencia.
- **Feature flags:** no requeridos en MVP slice. El enrichment se activa automáticamente al detectar `tmdb-key.enc`.
- **Rollout:** no aplica (app desktop, no deploy).

---

## Open Questions / Risks

1. **[OPEN]** Race condition entre `cancel` y `DONE`: si el worker termina justo cuando llega `CANCEL`, `worker.terminate()` puede tirar `DONE` o no. Mitigación propuesta: usar `worker.postMessage({type:'CANCEL'})` y dejar que el worker termine limpio; `terminate()` solo si no responde en 2s.
2. **[OPEN]** Imagen caching (DOC-8 §8.9): el spec lo pospone a futuro, pero sin OPFS cache cada render del dashboard hará N fetches a `image.tmdb.org`. Para MVP, dejamos `cache: 'force-cache'` del browser + estrategia de `loading="lazy"`. Si en testing se ve lag, agregar `idb` image blobs (low-risk addition).
3. **[RISK]** El enrichment worker es un Web Worker de browser; si el usuario tiene DevTools abierto + throttling, el enrichment puede tardar horas. Aceptable para MVP; documentar en user-facing copy que el enrichment es "background".
4. **[RISK]** `better-sqlite3` es nativo y requiere rebuild por versión de Electron. Si el CI no corre `electron-rebuild` postinstall, la app crashea al primer `db.open()`. Agregar a `postinstall` script y a CI explícitamente.
5. **[OPEN]** `iptv-m3u-playlist-parser` types: la librería expone tipos pero son permisivos. Habrá que wrappear en `src/shared/types/catalog.ts` con nuestros DTOs más estrictos.
6. **[DECIDED en propuesta, recordatorio]** Refresh programado queda fuera del slice (open question #4). Confirmar que el usuario está de acuerdo antes de cerrar el slice.

---

## Implementation Order

Orden sugerido, maximizando paralelización entre devs:

1. **Fase 0 — Scaffolding (1 dev, ~2h)**
   - Agregar deps a `package.json`, correr `electron-rebuild`.
   - Crear `drizzle.config.ts` y primera migración vacía.
   - Crear `src/main/db/{client,schema,migrate}.ts` con DB en `userData` + tests integration con `:memory:`.
   - Crear `src/main/db/repo.ts` con `bulkInsert` + tests.

2. **Fase 1 — IPC Contract (1 dev, paralelo a Fase 2)**
   - `src/shared/types/ipc.ts` + `src/shared/schemas/*.ts` (Zod).
   - `src/main/ipc/index.ts` + handlers stub que retornan errores `NOT_IMPLEMENTED`.
   - `src/preload/index.ts` reescrito exponiendo `window.luxAPI`.
   - `src/renderer/lib/api.ts` typed wrapper.
   - Tests: `ipc-handlers.test.ts` validando Zod.

3. **Fase 2 — Classifier + Preprocessor (1 dev, paralelo a Fase 1)**
   - `src/main/services/classifier.ts` (6-stage) + tests.
   - `src/renderer/services/preprocessor.ts` (4 regex DOC-8 §8.3) + tests con fixtures.

4. **Fase 3 — Ingest Worker (1 dev, depende de Fase 0+1+2)**
   - `src/main/services/{xtream-client,m3u-client}.ts` + tests con MSW.
   - `src/main/workers/ingest-worker.ts` + `src/main/services/ingest-orchestrator.ts`.
   - Handler `ingest:*` completo.
   - Test integration con M3U fixture (10k items).

5. **Fase 4 — TMDB Key + Encryption (1 dev, depende de Fase 0)**
   - `src/main/services/{encryption,tmdb-key,tmdb-validate}.ts` + tests.
   - Handler `tmdb:*` completo.

6. **Fase 5 — Enrichment Worker (1 dev, depende de Fase 2+4)**
   - `src/renderer/db/{enrichment,negative-cache,schema}.ts` (idb).
   - `src/renderer/services/{queue,tmdb-client,enrichment-controller}.ts` + tests.
   - `src/renderer/workers/enrichment.worker.ts` + test integration con `fake-indexeddb`.

7. **Fase 6 — TanStack Query + IPC events (1 dev, depende de Fase 1+3+5)**
   - `src/renderer/lib/query-client.ts` + Provider.
   - Hooks en `src/renderer/queries/`.
   - Wire de `catalog:ingestion-complete` → invalidate + spawn enrichment.

8. **Fase 7 — UI (2 devs en paralelo, depende de Fase 6)**
   - 7.1: Atoms + Molecules + organisms base (Sidebar, ContentCarousel, HeroBanner, ProgressOverlay).
   - 7.2: Feature `ingest/` (CredentialsForm + IngestOverlay wired a `useStartIngest`).
   - 7.3: Feature `dashboard/` (DashboardPage wired a `useCatalogList`).
   - 7.4: Feature `detail/` (MovieDetail + SeriesDetail wired a `useContentById`).

9. **Fase 8 — E2E + Polish (1 dev, depende de Fase 7)**
   - Tests Playwright `_electron` para los 3 flujos.
   - Manual QA: 55 FPS check con DevTools Performance.
   - Verificar modo degradado (sin TMDB key → dashboard renderiza con placeholders).

**Critical path:** Fase 0 → Fase 1+2 (paralelo) → Fase 3 → Fase 6 → Fase 7 → Fase 8.

---

## Resumen ejecutivo

- **Arquitectura:** 3 procesos (main = SQLite, renderer = IndexedDB+UI, preload = bridge). Ingest worker = `worker_threads` de Node; enrichment worker = Web Worker de browser; ambos terminan con `DONE`.
- **Decisiones clave confirmadas:** `better-sqlite3` (no Postgres — la dep actual `postgres` queda solo para el licensing-api), SQLite en `userData/catalog.db`, AES-256-GCM con `scrypt(HWID)`, key storage en archivo (no IndexedDB), enrichment en renderer (no en main), 5 workers concurrentes, backoff `[1k,2k,4k]+jitter`, negative cache 30d.
- **Bridge:** `window.luxAPI.*` con 10 métodos, validación Zod en cada handler, errores estructurados con `ErrorCode`.
- **UI:** 3 features (Ingest, Dashboard, Detail) con split container/presentational, Atomic Design, D-Pad focus via `react-tv-space-navigation`, virtualización con `react-window`.
- **Testing:** 85% coverage target, Vitest para unit/integration con `better-sqlite3 :memory:` y `fake-indexeddb`, Playwright `_electron` para E2E con asserts de FPS.
- **Riesgos principales:** rebuild de `better-sqlite3` postinstall (CI), imagen TMDB sin cache (mitigado con `loading="lazy"`), race `CANCEL`/`DONE` (mitigado con timeout de 2s).
- **Próximo paso:** implementar Fase 0 (scaffolding) + Fase 1 (IPC contract) en paralelo, luego secuencial según critical path.
