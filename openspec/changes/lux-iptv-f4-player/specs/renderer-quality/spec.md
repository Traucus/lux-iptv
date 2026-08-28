# Delta for renderer-quality

## MODIFIED Requirements

### Requirement: Player Placeholder Route

`/watch/:type/:id` MUST always mount `PlayerPage` (D-1). It MUST NOT render `PlayerPlaceholder`.

(Previously: type/id placeholder.)

#### Scenario: App mounts PlayerPage

- GIVEN the app is rendered
- WHEN location is `/watch/movie/42`
- THEN `PlayerPage` MUST render and `PlayerPlaceholder` MUST NOT

#### Scenario: Invalid type parameter

- GIVEN the /watch route exists
- WHEN location is `/watch/invalid/42`
- THEN it MUST 404 or redirect
