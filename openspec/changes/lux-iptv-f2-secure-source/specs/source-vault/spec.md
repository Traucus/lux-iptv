# Source Vault Specification

S2 two-state vault; saved secrets never in UI or F2 renderer path. Trace: FL-01, D-2.

## Requirements

### Requirement: Two-State Vault Screen

Configured S2 MUST show `listName` and source type only. Empty or replace MUST show a blank form. New password MUST have show/hide.

#### Scenario: Configured after first ingest (FL-01)

- GIVEN ingest DONE persisted a source
- WHEN S2 opens
- THEN listName and source type are shown and server, username, and password are not

#### Scenario: Empty first run (FL-01)

- GIVEN no saved source
- WHEN S2 opens
- THEN a blank Xtream or M3U form is shown and new password is masked with show/hide

### Requirement: Saved Secrets Never Displayed

F2 renderer MUST NOT load or display saved secrets. `config:hasSource` MUST return `{ configured: boolean }`. `config:sourceSummary` MUST return `{ configured, listName, source }` with no server, username, password, or URL.

#### Scenario: Summary has no secrets (D-2)

- GIVEN a saved Xtream source with password
- WHEN `config:sourceSummary` is invoked
- THEN payload has listName and source type and no server, username, password, or URL

#### Scenario: Renderer does not load credentials (D-2)

- GIVEN F2 vault or list chrome is mounted
- WHEN those screens resolve source presence
- THEN they use `config:hasSource` or `config:sourceSummary` and MUST NOT call `config:loadCredentials`

### Requirement: Replace Requires Retype

Replace MUST open a blank form. Saved values MUST NOT auto-fill. First-run and replace MUST submit retyped credentials via `ingest:start`. Credentials MUST persist only after DONE.

#### Scenario: Replace does not prefill (D-2)

- GIVEN a configured vault
- WHEN Replace source is chosen
- THEN the form is empty and submit requires newly typed credentials

#### Scenario: First-run DONE navigates Home (FL-01)

- GIVEN empty S2 and a valid Xtream or M3U submit
- WHEN ingest reaches DONE
- THEN Home shows catalog rows and S2 shows the configured card without secrets
