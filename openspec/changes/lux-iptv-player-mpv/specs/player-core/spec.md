# Delta for player-core

## ADDED Requirements

### Requirement: In-Process libmpv Engine

The player MUST play with in-process libmpv in one Lux window using the catalog origin URL plus item headers. It MUST NOT spawn `mpv.exe`, use Chromium `--wid`, or use VLC. Live MUST cache ~20s and reconnect; VOD MUST keep origin quality.

#### Scenario: mkv plays in Lux window

- GIVEN libmpv is loaded and a movie URL ends `.mkv`
- WHEN the user opens that movie
- THEN libmpv MUST play it in the same Lux window

#### Scenario: Origin URL is the happy path

- GIVEN origin URL and `http_headers`
- WHEN playback starts
- THEN libmpv MUST load that origin with those headers
- AND a proxied `127.0.0.1` src MUST NOT be the happy path

### Requirement: libmpv Load Failure Diagnosis

If libmpv fails to load, the player MUST show diagnosis UI. It MUST NOT fall back to hls.js, mpegts.js, or native `<video>`.

#### Scenario: Missing libmpv shows diagnosis

- GIVEN libmpv cannot load
- WHEN playback starts
- THEN diagnosis UI MUST show and zero Chromium probe MUST run

### Requirement: Tracks Fullscreen And OSD

The player MUST use libmpv `track-list`, include subtitle Off, allow `.srt`/`.ass` load, use exclusive fullscreen covering the taskbar (Escape exits), and give every OSD control a `title` tooltip. Live −10s MUST be disabled.

#### Scenario: Audio track and subs

- GIVEN two audio tracks
- WHEN the user selects track 2, THEN audible audio MUST switch
- WHEN the user selects Off, THEN no subtitle MUST show
- WHEN the user loads `.srt`/`.ass`, THEN it MUST be selectable

#### Scenario: Fullscreen and live OSD

- GIVEN playback in the Lux window
- WHEN the user enters fullscreen, THEN it MUST cover the taskbar and Escape MUST exit
- WHEN live OSD appears, THEN −10s MUST be disabled and controls MUST have `title` tooltips

### Requirement: Watch Route Resolves Series To First Episode

`/watch/series/:id` MUST start libmpv playback of the first episode.

#### Scenario: Series resolves first episode

- GIVEN series 7 with episodes 101 then 102
- WHEN `/watch/series/7` opens
- THEN libmpv MUST play episode 101

## MODIFIED Requirements

### Requirement: VideoPlayer Organism

The VideoPlayer MUST host the in-process libmpv surface in the Lux window. It MUST NOT attach hls.js, mpegts.js, or a native `<video>` playback engine.

(Previously: fullscreen `<video>` with hls.js lifecycle and proxied `src`.)

#### Scenario: VideoPlayer renders fullscreen

- GIVEN VideoPlayer is mounted with a valid catalog item
- WHEN the component renders
- THEN the libmpv surface MUST fill the container

#### Scenario: VideoPlayer cleans up on unmount

- GIVEN VideoPlayer is mounted
- WHEN the component unmounts
- THEN libmpv MUST stop and release the surface

### Requirement: SeekBar Interactive

The SeekBar MUST support pointer drag, D-Pad left/right, and a buffered range. Seek MUST change libmpv playback position.

(Previously: SeekBar updated `video.currentTime`.)

#### Scenario: Pointer drag seeks

- GIVEN the user clicks at 50% of the SeekBar width
- WHEN they drag to 75% and release
- THEN playback position MUST update to 75% of duration

#### Scenario: D-Pad right seeks forward

- GIVEN the SeekBar is focused
- WHEN D-Pad right is pressed
- THEN playback position MUST advance (e.g., +10s)

#### Scenario: Buffered range displayed

- GIVEN 60% of duration is buffered
- WHEN the SeekBar renders
- THEN the buffered range MUST indicate up to 60%

## REMOVED Requirements

### Requirement: hls.js Engine with Resilience

(Reason: D-10/D-14 replace Chromium hls.js with in-process libmpv.)
(Migration: In-Process libmpv Engine)

### Requirement: Native video Fallback for MP4/MKV

(Reason: Native `<video>` cannot play origin mkv/HEVC/AC3.)
(Migration: In-Process libmpv Engine)

### Requirement: Proxied Playback And Series Resolve

(Reason: Proxied `src` is not the happy path.)
(Migration: Origin URL play; Watch Route Resolves Series To First Episode)

### Requirement: HLS Abr And Latency Policy

(Reason: hls.js ABR is not the product engine.)
(Migration: In-Process libmpv Engine)
