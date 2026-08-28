# Delta for stream-proxy

## ADDED Requirements

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

### Requirement: Header Injection from Stored http_headers

The proxy MUST inject HTTP headers from the stored `http_headers` JSON column into outgoing requests. Supported headers: User-Agent, Referer, Cookie, and custom headers.

#### Scenario: User-Agent injected

- GIVEN a catalog item with `http_headers = {"userAgent": "CustomAgent"}`
- WHEN the proxy makes the request
- THEN the outgoing request MUST include `User-Agent: CustomAgent`

#### Scenario: Multiple headers injected

- GIVEN `http_headers = {"userAgent": "A", "referer": "https://x.com", "cookie": "sid=1"}`
- WHEN the proxy makes the request
- THEN all three headers MUST be present in the outgoing request

#### Scenario: Empty headers — no injection

- GIVEN `http_headers = {}`
- WHEN the proxy makes the request
- THEN no extra headers MUST be added

### Requirement: Manifest Caching with Short TTL

The proxy MUST cache manifest responses (`.m3u8` master/media playlists) with a short TTL (configurable, default 30s). Segment requests MUST NOT be cached.

#### Scenario: Manifest cached for TTL

- GIVEN a manifest request for `stream.m3u8`
- WHEN the same manifest is requested again within 30s
- THEN the proxy MUST return the cached response (no origin request)

#### Scenario: Cache expired — fresh fetch

- GIVEN a manifest was cached 31s ago
- WHEN the manifest is requested again
- THEN the proxy MUST fetch fresh content from the origin

#### Scenario: Segment not cached

- GIVEN a segment request for `segment0.ts`
- WHEN the same segment is requested again
- THEN the proxy MUST fetch from origin (no caching)

### Requirement: Error Handling — Redirects, Timeouts, Errors

The proxy MUST handle HTTP redirects (follow up to 5 hops), request timeouts (default 10s), and network errors. Errors MUST be reported to the renderer via IPC.

#### Scenario: Redirect followed

- GIVEN the origin returns 302 with Location header
- WHEN the proxy follows the redirect
- THEN it MUST fetch from the new location and return the final response

#### Scenario: Timeout after 10s

- GIVEN the origin does not respond
- WHEN 10 seconds elapse
- THEN the proxy MUST abort the request and report a timeout error

#### Scenario: Network error reported

- GIVEN the origin is unreachable (ECONNREFUSED)
- WHEN the proxy attempts the request
- THEN it MUST report the error via `player:reportError` IPC

### Requirement: player:getProxiedUrl IPC

The system MUST expose a `player:getProxiedUrl` IPC handler that, given a catalog item ID, returns a proxied URL that the player can use to fetch the stream through the proxy.

#### Scenario: Returns proxied URL

- GIVEN a catalog item with ID 42 and original URL `https://origin.com/stream.m3u8`
- WHEN `player:getProxiedUrl(42)` is called
- THEN it MUST return a local proxy URL like `http://localhost:{port}/proxy/42`

#### Scenario: Unknown ID returns error

- GIVEN no catalog item with ID 999
- WHEN `player:getProxiedUrl(999)` is called
- THEN it MUST return an error

### Requirement: Concurrent Segment Requests

The proxy MUST support multiple concurrent segment requests without blocking or queueing. Each request MUST be handled independently.

#### Scenario: 5 concurrent segments

- GIVEN the player requests 5 segments simultaneously
- WHEN all 5 requests arrive at the proxy
- THEN all 5 MUST be processed concurrently and return independently

#### Scenario: Mixed manifest and segments

- GIVEN a manifest request and 3 segment requests arrive simultaneously
- WHEN the proxy processes them
- THEN the manifest MUST be cached, segments MUST be fetched from origin — all concurrently
