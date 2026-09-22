# FA-08 docs alignment — 2026-09-21

Lecciones: Engram #711 `lessons/lux-iptv`. Alcance: `docs/planning/CHECKLIST.md` (prosa FA-08). No `src/`.

- [x] Abrir `.harness/policies/current.yml` con `docs/planning/CHECKLIST.md`
- [x] Corregir FA-08: worker TMDB sí arranca (`tmdb.getKey()` + `startEnrichment`)
- [x] `npx vitest run` — 83 files, 767 passed
- [x] Commit exclusivo `docs(planning): corregir especificación FA-08 reflejando arranque activo del worker TMDB`
- [x] Restaurar `current.yml` a arnés exclusivo

---

# Auditoría funcional (solo lectura) — 2026-09-21

Lecciones leídas: Engram #711 `lessons/lux-iptv`.
Fuentes: 8 specs canónicas + `00-initial-spec` (SUPERSEDED) + archive SDD (4) + changes vivos (`lux-iptv-mvp`, `lux-iptv-f2-secure-source`, `lux-iptv-player`) + `docs/planning/*`.
Rondas: 2 (ronda 2 no sumó módulos nuevos; sí corrigió FA-08 stale).
No se abrió `current.yml`. No se tocó `src/`.

## Módulos

| Módulo | Estado | Evidencia | Pruebas |
| --- | --- | --- | --- |
| Ingesta Xtream/M3U + categorías | FUNCIONA (Linux/CI) | `IngestStartInput` xtream\|m3u; `fetchXtreamLive/Vod`; sql.js catalog | unit ingest + e2e M3U (`ingest-to-dashboard`, `cancel-ingest`). **Sin e2e Xtream** |
| EPG | PARCIAL | `epg:nowNext`; `EpgPage` `/epg`; Live/Home titles. No XMLTV. Grid canales×hora fuera de mínimo | unit `epg*.test.ts`, `EpgPage.test.tsx`. **Sin e2e guía/zap** |
| stream-proxy / HLS rewrite | PARCIAL (código vivo, no es el play path) | `StreamProxyService`; `player:play` usa `row.url` origen, no proxy | unit `tests/unit/stream-proxy/**`. Play no lo ejercita |
| Transcodificación | FALTA (fuera de diseño F2) | 0 matches `transcod`/`ffmpeg` en `src/` | — |
| Reproductor libmpv + OSD | PARCIAL Windows | `player:play` origen; HWND inset 88/168; `sub-add`; GPU off | unit VideoPlayer/OSD/libmpv; e2e `player-playback` **skipea sin DLL** |
| Navegación TV / 10-foot | FUNCIONA | `Focusable` + shim; Favorites/Search omitidos | unit Sidebar/Focusable |
| Catálogo live/movie/series/episode | FUNCIONA | mappers; `catalog:getById` episode | integration catalog. **LivePage/SeriesPage 0 tests dedicados** |
| TMDB + posters | PARCIAL runtime | `EnrichmentHost` llama `tmdb.getKey()` y `startEnrichment`; `useEnrichedPosters` | `MoviesPage.test.tsx` (1). Worker sin tests de hop |
| Vault / refresh / TMDB onboarding | FUNCIONA código | Settings → `/ingest`; host-only | unit IngestPage, Tmdb onboarding |
| licensing-api | FALTA en desktop | Fastify aislado; no hay IPC de licencia en `LuxAPI` | 0% cobertura API |
| Perfiles / parental / búsqueda | FALTA | PLAN F11–F14; Search no está en Sidebar | — |
| Radio | PARCIAL | counts en overlay; no hay browse UI | — |
| F8–F10 Android/Tizen/webOS | FALTA | CHECKLIST FA-14/15/16 | — |

## Windows remaining (CHECKLIST, 9 PARCIAL)

FA-17, FA-18, FA-03, PA-06, FA-08, FA-09, FA-11, FA-12, FA-13 — código en árbol; falta prueba en Windows (NSIS para FA-13).

## Contradicciones spec↔spec / spec↔código

1. `openspec/specs/00-initial-spec.md` describe hls.js — marcado SUPERSEDED; verdad = `player-core` libmpv.
  2. CHECKLIST FA-08 alineado 2026-09-21: el worker sí arranca desde `EnrichmentHost` (`tmdb.getKey()` + `startEnrichment`). Sigue PARCIAL por prueba Windows de posters (PA-06).
3. Comentario en `player.ts` getProxiedUrl (“G5 not yet”) vs proxy implementado. Play path no lo usa (intencional).
4. Changes SDD sin archivar: `lux-iptv-mvp`, `lux-iptv-f2-secure-source`, `lux-iptv-player` (AJ-03/AJ-04).

## Huecos de verificación automática

- E2E cubre: M3U→Home, cancel ingest, detail, degraded TMDB, HashRouter watch. No cubre Xtream, Live, EPG zap, resume episodio, posters TMDB reales, NSIS.
- `player-playback` real se salta sin `LUX_LIBMPV_DIR`.
- `catalog:list.search` existe en schema; no hay UI de búsqueda.

## P0 sugerido (no implementar en esta auditoría)

1. Prueba Windows de play/OSD/subs (FA-17/18/03) — único ROTO-risk de producto.
  2. ~~Actualizar prosa FA-08 en `docs/planning/CHECKLIST.md` (stale).~~ Hecho.
3. E2E o unit de LivePage + SeriesPage.
4. NSIS FA-13 cuando toque F7.
