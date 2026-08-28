# Spec Note: lux-iptv-f4-close

## Product delta

None. Proposal Capabilities: New = None, Modified = None.

This change MUST NOT add, modify, remove, or rename requirements. F4 archive already merged product truth into main specs.

## Archived source of truth (unchanged)

| Domain | Requirement | Behavior |
|--------|-------------|----------|
| renderer-quality | Player Placeholder Route | `/watch/:type/:id` MUST mount `PlayerPage`. It MUST NOT render `PlayerPlaceholder`. |
| player-core | Proxied Playback And Series Resolve | Media `src` MUST come only from `player:getProxiedUrl`. Origin MUST NOT be fallback. |
| stream-proxy | player:getProxiedUrl IPC | Catalog id MUST return a local proxy URL. |
| desktop-shell | Player IPC Channels | Preload MUST expose `getProxiedUrl`. `getSource` MUST return format/live metadata only. |

## Test-truth is not a spec gap

Lying suites contradict archived behavior. That is verification debt, not missing product requirements.

Do NOT add a requirement such as "tests MUST NOT assert PlayerPlaceholder". `renderer-quality` already forbids `PlayerPlaceholder` on `/watch`. `player-core` already forbids origin `src`.

## Work this change covers (design/tasks input)

| File | Action |
|------|--------|
| `tests/unit/routing.test.tsx` | Delete local `PlayerPlaceholder`, `TestApp`/`NavTarget`, `describe('HashRouter routing')`. Keep App router + `/watch` mounts PlayerPage. |
| `tests/unit/player/player-page.test.tsx` | Delete stub origin-m3u8 `PlayerPage` suite. Keep `PlayerPage proxied playback`. |
| `tests/e2e/routing.spec.ts` | Stop asserting `player-placeholder`. Mock `player.getProxiedUrl`. Assert video-player, loading, or error. |
| `PlayerPlaceholder.tsx` | Optional delete if authored lines stay well under 400. |
| `video-player.test.tsx` | Untouched. |

## Archive instruction

No domain files under `openspec/changes/lux-iptv-f4-close/specs/{domain}/`. Archive MUST NOT merge any delta into main specs.
