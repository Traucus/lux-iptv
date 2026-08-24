# Spec: IPC Bridge

## Purpose

Define the secure communication contract between Electron main process, preload script, and renderer, using `contextBridge` for safety and TanStack Query for data fetching, caching, and invalidation. The user-facing outcome is a responsive UI that fetches catalog data with caching, optimistic updates, and automatic retry without direct access to Node.js APIs.

## Requirements

### REQ-IPC-1: Secure Context Bridge

The system SHALL expose IPC methods via `contextBridge` in the preload script, following the Electron security model (DOC-1 final instructions §3).

#### Scenario: Preload exposes catalog API

- GIVEN the application starts
- WHEN the preload script initializes
- THEN `window.electronAPI` is exposed with methods: `getCatalog`, `searchContent`, `getSeriesDetails`, `getIngestProgress`
- AND no `require` or `ipcRenderer` is directly accessible from the renderer

#### Scenario: Renderer calls catalog API

- GIVEN the renderer needs to fetch movies
- WHEN it calls `window.electronAPI.getCatalog({ type: 'movies', limit: 50, offset: 0 })`
- THEN the call is routed through `ipcRenderer.invoke` to the main process
- AND the main process queries SQLite and returns the result

### REQ-IPC-2: TanStack Query Integration

The system SHALL use `@tanstack/react-query` in the renderer as the data fetching layer, with query keys matching IPC channels and configurable stale times.

#### Scenario: Fetch movies with React Query

- GIVEN the dashboard component mounts
- WHEN it executes `useQuery({ queryKey: ['catalog', 'movies'], queryFn: () => electronAPI.getCatalog({ type: 'movies' }) })`
- THEN TanStack Query caches the result
- AND subsequent calls return cached data until stale time expires
- AND a background refetch occurs if the cache is stale

#### Scenario: Invalidate cache after ingestion

- GIVEN the ingestion process completes
- WHEN the main process emits an `ingestion-complete` event
- THEN the renderer invalidates all `['catalog']` query keys
- AND React Query refetches the catalog data
- AND the UI updates with the newly ingested content

### REQ-IPC-3: Real-Time Progress Streaming

The system SHALL deliver ingest progress from the Web Worker → main process → preload → renderer via IPC events.

#### Scenario: Progress updates during ingestion

- GIVEN the ingest worker is processing 12,000 items
- WHEN it emits a progress message every 500 ms
- THEN the main process forwards it to the renderer via `ipcRenderer.on`
- AND the renderer receives `{ live: N, movies: N, series: N, total: N }`
- AND the UI updates the progress bar reactively

#### Scenario: Ingestion completion notification

- GIVEN the ingest worker finishes processing
- WHEN it emits a `complete` event
- THEN the renderer receives the final counts
- AND React Query invalidates the catalog cache
- AND the UI transitions to the dashboard view

### REQ-IPC-4: Error Propagation

The system SHALL propagate errors from the main process to the renderer with structured error types so TanStack Query can handle retries.

#### Scenario: SQLite query error

- GIVEN the SQLite database is corrupted
- WHEN the renderer requests catalog data
- THEN the main process returns `{ error: true, code: 'DB_CORRUPTED', message: '...' }`
- AND TanStack Query catches the error and can retry per its retry policy

#### Scenario: TMDB API key missing

- GIVEN no TMDB API key is configured
- WHEN the renderer requests enriched data
- THEN the response includes `enrichment_available: false`
- AND the renderer gracefully renders without TMDB data (see degraded-mode spec)

## Out of Scope

- IPC channel encryption (handled by Electron's built-in IPC)
- Bidirectional streaming (main → renderer push beyond progress events)
- WebUSB / hardware access (out of scope for MVP)
