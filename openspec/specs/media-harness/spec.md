# Delta for media-harness

## ADDED Requirements

### Requirement: HTMLMediaElement Mock

The test harness MUST provide a mock `HTMLMediaElement` that implements: `play()`, `pause()`, `seek(time)`, `currentTime` (get/set), `duration` (get), and `buffered` (TimeRanges mock).

#### Scenario: Mock play resolves

- GIVEN the HTMLMediaElement mock is instantiated
- WHEN `play()` is called
- THEN it MUST return a resolved Promise and set `paused = false`

#### Scenario: Mock seek updates currentTime

- GIVEN the mock has `duration = 100`
- WHEN `seek(50)` is called
- THEN `currentTime` MUST equal 50

#### Scenario: Mock buffered returns TimeRanges

- GIVEN the mock is configured with buffered range [0, 60]
- WHEN `buffered` is accessed
- THEN it MUST return a TimeRanges-like object with `length = 1`, `start(0) = 0`, `end(0) = 60`

### Requirement: hls.js Mock

The test harness MUST provide an hls.js mock that implements: `loadSource(url)`, `attachMedia(videoElement)`, `on(event, handler)`, and `destroy()`.

#### Scenario: Mock loadSource stores URL

- GIVEN the hls.js mock is instantiated
- WHEN `loadSource('test.m3u8')` is called
- THEN the mock MUST store the URL and emit `MANIFEST_PARSED` event

#### Scenario: Mock on/off event handling

- GIVEN a handler registered via `on('ERROR', handler)`
- WHEN the mock triggers an error event
- THEN the handler MUST be called with the error data

#### Scenario: Mock destroy cleans up

- GIVEN the mock has registered event handlers
- WHEN `destroy()` is called
- THEN all handlers MUST be removed and the mock MUST be inert

### Requirement: MediaSource/SourceBuffer Mock

The test harness MUST provide mocks for `MediaSource` and `SourceBuffer` APIs, supporting `addSourceBuffer()`, `appendBuffer()`, and `remove()`.

#### Scenario: Mock MediaSource readyState

- GIVEN the MediaSource mock is created
- WHEN `addSourceBuffer('video/mp4')` is called
- THEN it MUST return a SourceBuffer mock with `appendBuffer()` method

#### Scenario: Mock SourceBuffer appendBuffer

- GIVEN a SourceBuffer mock
- WHEN `appendBuffer(data)` is called
- THEN it MUST accept the data without throwing

### Requirement: Playwright E2E Fixture with Local .m3u8 Server

The E2E test setup MUST include a Playwright fixture that starts a local HTTP server serving `.m3u8` manifest and `.ts` segment files. The fixture MUST provide the server URL to tests.

#### Scenario: Fixture serves manifest

- GIVEN the Playwright fixture is active
- WHEN a test requests `{serverUrl}/test.m3u8`
- THEN it MUST receive a valid HLS manifest response

#### Scenario: Fixture serves segments

- GIVEN the fixture is active
- WHEN a test requests `{serverUrl}/segment0.ts`
- THEN it MUST receive a binary segment response

### Requirement: Vitest Per-File Environment Override

Player tests MUST be able to override the Vitest environment (e.g., use `happy-dom` or a custom media environment) on a per-file basis via `@vitest-environment` docblock.

#### Scenario: Player test uses custom environment

- GIVEN a test file with `// @vitest-environment happy-dom` docblock
- WHEN vitest runs that file
- THEN it MUST use the happy-dom environment (not the default)

#### Scenario: Non-player tests use default environment

- GIVEN a test file without a docblock override
- WHEN vitest runs that file
- THEN it MUST use the default environment
