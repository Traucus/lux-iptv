# Delta for player-core

## ADDED Requirements

### Requirement: Proxied Playback And Series Resolve

Media `src` MUST come only from `player:getProxiedUrl`.

#### Scenario: No origin URL in renderer

- GIVEN item 42 origin `https://origin.example/stream.m3u8`
- WHEN PlayerPage starts playback
- THEN `src` MUST be the `player:getProxiedUrl` result

#### Scenario: getProxiedUrl error has no origin fallback

- GIVEN `player:getProxiedUrl` fails
- WHEN PlayerPage starts playback
- THEN error UI MUST show and origin MUST NOT be `src`

#### Scenario: Live channel plays via proxy (FL-03)

- GIVEN live channel 9
- WHEN location is `/watch/live/9`
- THEN proxied `src` MUST be used and SeekBar MUST be hidden

#### Scenario: Series resolves first episode

- GIVEN series 7 with episodes 101 then 102
- WHEN `/watch/series/7` opens
- THEN `player:getProxiedUrl` MUST run for episode 101

### Requirement: HLS Abr And Latency Policy

HLS MUST use `capLevelToPlayerSize`, mid `startLevel` after `MANIFEST_PARSED`, and `lowLatencyMode` live-only (T-03).

#### Scenario: ABR mid plus cap

- GIVEN HLS with 5 levels
- WHEN the manifest is parsed
- THEN `capLevelToPlayerSize` MUST be true and `startLevel` MUST not be highest

#### Scenario: Live-only lowLatencyMode

- GIVEN live HLS and movie HLS
- WHEN hls.js is created for each
- THEN live MUST set `lowLatencyMode` true and VOD false

### Requirement: Hero Play Navigates To Movie Watch

Hero Play MUST navigate to `/watch/movie/:id`, not `/content/:id` (FL-04).

#### Scenario: Hero Play to watch movie

- GIVEN hero movie 42
- WHEN Play is activated
- THEN the router MUST navigate to `/watch/movie/42`
