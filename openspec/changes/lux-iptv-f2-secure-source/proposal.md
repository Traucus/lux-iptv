# Proposal: F2 Secure Source (Vault + Refresh)

## Intent

Renderer auto-fills saved IPTV secrets. Refresh exists only on Home and opens S2. F2 closes D-2 plus FL-01, FL-02, T-02: never display saved secrets; chrome refresh on S1/S3/S4/S5; stay on current list.

## Scope

### In Scope

- Two-state S2 vault: configured card (`listName` + source type) vs empty/replace form; retype; never auto-fill
- `ListScreenChrome` on S1/S3/S4/S5; Actualizar listas hidden if no source
- `IngestProgressHost`: refresh stays on route; first-run S2 navigates Home on DONE
- IPC `config:hasSource`, `config:sourceSummary`, `ingest:refresh`; invalidate `catalog-grouped` on DONE after `db.reload()`
- PasswordField show/hide for new typing; vault/chrome/T-02 tests

### Out of Scope

- Player, TMDB, EPG, see-all, continue watching, 4K
- Encrypting `config.json`; worker persist rewrite; wiping stale rows on replace

## Capabilities

> Main specs lack vault/refresh (SPEC-HEALTH MISSING).

### New Capabilities

- `source-vault`: two-state S2; no saved secrets in UI or F2 renderer path; `config:hasSource` / `config:sourceSummary`
- `list-refresh`: chrome on S1/S3/S4/S5; vault-backed `ingest:refresh`; stay-on-page overlay; grouped invalidation on DONE

### Modified Capabilities

- None

## Approach

Adopt exploration recs (D-2 aligned): `ListScreenChrome` + `IngestProgressHost` + two-state vault. F2 renderer MUST NOT call `config:loadCredentials`. Keep `ingest:start` for first-run/replace (retyped); persist after DONE. Chain if >400 lines: vault+IPC then chrome+host.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/renderer/App.tsx` | Modified | `IngestProgressHost` beside Routes |
| `src/renderer/features/{dashboard,live,movies,series}` | Modified | Shell chrome; no secret load |
| `src/renderer/features/ingest/IngestPage.tsx` | Modified | Two-state vault; no auto-fill |
| `src/renderer/queries/use-ingest.ts` | Modified | Invalidate grouped keys on DONE |
| `src/main/ipc/handlers/{config,ingest}.ts` | Modified | hasSource, sourceSummary, refresh |
| `src/preload/index.ts` | Modified | Expose new channels |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `['catalog']` miss on `catalog-grouped` | High | Invalidate grouped keys after `db.reload()` |
| Chrome still calls `loadCredentials` | Med | F2 uses hasSource/refresh only |
| First-run Home vs refresh stay conflated | Med | Two explicit DONE rules |
| Review >400 lines | High | Chain vault+IPC then chrome+host |

## Rollback Plan

Revert F2 PRs. No migration. `config.json` unchanged. Overlay returns to IngestPage.

## Dependencies

- Worker URL upsert; ConfigService; F1 list + `/ingest` routes

## Success Criteria

Pass/fail as written in `docs/planning/CRITERIOS-POR-FLUJO.md`:

- [ ] **FL-01**: Xtream vs M3U; overlay counts; DONE → Home with rows; S2 hides server/username/password; new password show/hide
- [ ] **FL-02**: Actualizar listas on Home/Live/Movies/Series without opening S2; stored credentials; no secret fields; hidden if no source; upsert by URL
- [ ] **T-02**: From `/movies`, refresh, stay in movies IA, rows update
- [ ] **D-2**: never display saved server/username/password; replace requires retype; F2 renderer does not load saved password
