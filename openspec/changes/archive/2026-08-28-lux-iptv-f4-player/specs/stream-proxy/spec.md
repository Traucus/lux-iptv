# Delta for stream-proxy

## MODIFIED Requirements

### Requirement: Stream Proxy via Electron net Module

The proxy MUST intercept streams with Electron `net`. Segments MUST stream unchanged. HLS playlists MUST rewrite relative URIs onto the proxy.

(Previously: unchanged playlists.)

#### Scenario: Proxy intercepts stream request

- GIVEN the player requests a stream
- WHEN routed through the proxy
- THEN the proxy MUST fetch via Electron `net.request()`

#### Scenario: Proxy forwards response body

- GIVEN origin returns an HLS segment
- WHEN the proxy receives it
- THEN it MUST stream unchanged

#### Scenario: HLS relative segments via proxy

- GIVEN a playlist with relative URIs (`seg0.ts`)
- WHEN the proxy serves it
- THEN relative URIs MUST become proxy URLs and fetches MUST hit the proxy
