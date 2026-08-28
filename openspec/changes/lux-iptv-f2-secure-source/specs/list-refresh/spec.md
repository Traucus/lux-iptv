# List Refresh Specification

Chrome refresh on S1/S3/S4/S5 using the vault; stay on current list. Trace: FL-02, T-02.

## Requirements

### Requirement: Refresh Chrome on List Screens

S1/S3/S4/S5 MUST show Actualizar listas only when a source exists and MUST NOT open S2.

#### Scenario: Visible with source (FL-02)

- GIVEN a saved source
- WHEN on Home, Live, Movies, or Series
- THEN Actualizar listas is visible and does not navigate to S2

#### Scenario: Hidden without source (FL-02)

- GIVEN no saved source
- WHEN on Home, Live, Movies, or Series
- THEN Actualizar listas is not shown

### Requirement: Vault-Backed Refresh in Main

`ingest:refresh` MUST run in main using stored credentials. Renderer MUST NOT supply secrets. No source MUST return a typed error. Persist MUST upsert by URL.

#### Scenario: Refresh uses stored credentials (FL-02)

- GIVEN a saved source
- WHEN Actualizar listas is activated
- THEN main starts ingest from the vault and no secret fields appear on screen

#### Scenario: Refresh with no source errors

- GIVEN no saved source
- WHEN `ingest:refresh` is invoked
- THEN the result is a typed error and ingest does not start

### Requirement: Stay On Current List

Refresh MUST overlay and remain on the current route. First-run S2 DONE MUST navigate Home (FL-01).

#### Scenario: Movies stay on Movies (T-02)

- GIVEN `/movies` with a saved source
- WHEN refresh completes with DONE
- THEN the route remains `/movies` and S2 is not opened

### Requirement: Grouped Catalog Invalidation After Reload

On ingest DONE, queries MUST be invalidated only after `db.reload()`. Invalidation MUST include `catalog-grouped`.

#### Scenario: Movies rows update after DONE (T-02)

- GIVEN `/movies` showing grouped rows
- WHEN refresh reaches DONE after `db.reload()`
- THEN `catalog-grouped` queries refetch and visible rows match the updated catalog

#### Scenario: Rows not required until DONE

- GIVEN refresh started but not DONE
- WHEN progress is in-flight
- THEN rows need not match the new catalog
