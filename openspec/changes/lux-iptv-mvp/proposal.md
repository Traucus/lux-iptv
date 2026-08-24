# Proposal: Lux IPTV MVP — Content Ingestion and Enrichment

## Why

Existe un gap entre la arquitectura documentada en DOC-2, DOC-3 y DOC-8 y el código ejecutable: la aplicación todavía no puede ingerir contenido, persistir un catálogo local ni mostrar información enriquecida. Este slice implementa el núcleo funcional del MVP sobre el que dependerán el reproductor, EPG y las funciones posteriores.

## What Changes

- Implementar un Web Worker para ingerir y parsear listas Xtream Codes API/M3U en background.
- Persistir el catálogo local con **SQLite via `better-sqlite3`** en el proceso main de Electron, con tablas para `live_channels`, `vod_movies`, `series` y `episodes`.
- Exponer el catálogo al renderer mediante la arquitectura Electron main/preload/renderer con **TanStack Query** como capa de data fetching (caching, invalidación, optimistic updates).
- Implementar una cola de enriquecimiento TMDB con:
  - concurrency máxima de 5;
  - búsqueda en cascada con estrategia IMDb-first;
  - exponential backoff de 1000, 2000 y 4000 ms;
  - negative cache de 30 días para `not_found`.
- Crear una tabla IndexedDB `ContentEnrichment` separada del catálogo principal.
- Encriptar localmente la API key de TMDB.
- Garantizar modo degradado: el catálogo continúa funcionando aunque TMDB falle.
- Implementar la UI mínima de ingesta, dashboard/catalogue y detail view correspondientes a las pantallas 2, 3 y 4 de Stitch.
- Aplicar strict TDD con Vitest para lógica y Playwright para el flujo principal.

## Impact

- **DOC-2 — Xtream/M3U ingestion:** se implementa el pipeline de ingesta en background.
- **DOC-3 — Catalogación:** se materializa el modelo persistente de canales, películas, series y episodios.
- **DOC-8 — TMDB enrichment:** se implementan sanitización, búsqueda, hidratación, retry, caching y degraded mode.
- **UI Stitch:** se implementan las pantallas 2, 3 y 4 del design system "Cinematic Glass".
- **Design/tasks:** deberán cubrir IPC seguro, persistencia, worker lifecycle, cola de enriquecimiento y pruebas end-to-end.

## Non-goals

- Reproductor de video — slice 2.
- EPG — slice 3.
- Control parental — slice 4.
- Settings y licensing UI para usuarios — slice 5.
- Deploy a Hostinger, PM2, nginx o Let's Encrypt.
- Funcionalidades avanzadas de administración.

## Acceptance Criteria

- [ ] Una fuente Xtream/M3U puede ingerirse sin bloquear el renderer.
- [ ] Los cuatro tipos de contenido se persisten y sobreviven al reinicio de la aplicación.
- [ ] El dashboard muestra contenido ingerido y permite abrir el detail view.
- [ ] TMDB enriquece contenido válido respetando concurrency, backoff y negative cache.
- [ ] `ContentEnrichment` permanece separado del catálogo.
- [ ] La aplicación funciona sin posters ni metadata TMDB cuando el servicio falla.
- [ ] La API key de TMDB no se almacena en texto plano.
- [ ] Vitest y Playwright cubren los flujos críticos.

## Open Questions

1. ✅ **Catálogo local:** RESUELTO — SQLite con `better-sqlite3` en proceso main.
2. ✅ **Data fetching del renderer:** RESUELTO — TanStack Query (`@tanstack/react-query`).
3. **Identidad del contenido:** ¿el matching debe priorizar siempre IMDb ID cuando exista y usar título/año únicamente como fallback?
4. **Frecuencia de sincronización:** ¿la ingesta será manual en este slice o debe soportar refresh programado desde el inicio?
