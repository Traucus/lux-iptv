# player-core

Windows product player. Happy path is **in-process libmpv** in one Lux window (D-10, D-14). Chromium `hls.js`, mpegts.js, native `<video>`, spawned `mpv.exe`, and `--wid` are not the product engine.

## Requirements

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

### Requirement: VideoPlayer Organism

The VideoPlayer MUST host the in-process libmpv surface in the Lux window. It MUST NOT attach hls.js, mpegts.js, or a native `<video>` playback engine.

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

### Requirement: OSD Auto-Hide

The On-Screen Display (OSD) MUST auto-hide after 4 seconds of user inactivity. Any user interaction (mouse move, key press) MUST reset the timer and show the OSD.

#### Scenario: OSD hides after 4s

- GIVEN the OSD is visible
- WHEN 4 seconds pass with no user interaction
- THEN the OSD MUST fade out / hide

#### Scenario: Mouse movement resets timer

- GIVEN the OSD is visible and 3s have elapsed
- WHEN the mouse moves
- THEN the timer MUST reset to 0 and the OSD MUST remain visible

### Requirement: OSD Controls

The OSD MUST include: progress/seek bar (VOD only), audio track selector, subtitle track selector, play/pause that changes libmpv pause state, and aspect ratio toggle (16:9, 4:3, Zoom, Fit).

#### Scenario: Audio track switch

- GIVEN the OSD is visible and the stream has 2 audio tracks
- WHEN the user selects track 2
- THEN the audio MUST switch to track 2

#### Scenario: Aspect ratio toggle

- GIVEN the OSD is visible
- WHEN the user cycles aspect ratio to 4:3
- THEN the video MUST render in 4:3 aspect ratio (letterboxed if needed)

### Requirement: Next Episode Overlay

When playing a series episode, the player MUST show a "Next Episode" overlay when playback reaches 95% of duration. The overlay MUST include a 10-second countdown with a skip button.

#### Scenario: Overlay appears at 95%

- GIVEN a 60-minute episode is playing
- WHEN currentTime reaches 57 minutes (95%)
- THEN the next-episode overlay MUST appear with a 10s countdown

#### Scenario: Countdown expires — auto-advance

- GIVEN the overlay is showing with 10s countdown
- WHEN the countdown reaches 0
- THEN the player MUST navigate to the next episode

#### Scenario: User dismisses overlay

- GIVEN the overlay is showing
- WHEN the user clicks "Dismiss"
- THEN the overlay MUST hide and current episode continues

### Requirement: VOD Resume from IndexedDB

For VOD content (movies, episodes), the player MUST check IndexedDB for a saved playback position on load. If found, it MUST seek to that position and show a "Resume from X?" prompt with a real duration clock (not `0:00`).

#### Scenario: Resume prompt shown

- GIVEN a movie was last watched at 45:00 of a known duration
- WHEN the user opens the movie
- THEN the player MUST show "Resume from 45:00?" and seek to 45:00 on confirm

#### Scenario: No saved position

- GIVEN a movie has no saved position
- WHEN the user opens the movie
- THEN playback MUST start from 00:00

### Requirement: Live TV Mode

For live TV channels, the player MUST operate in live mode: no seek bar, no resume, no next-episode overlay. The SeekBar MUST be hidden or disabled.

#### Scenario: Live channel — no seek

- GIVEN a live channel is playing
- WHEN the OSD appears
- THEN the SeekBar MUST be hidden

#### Scenario: Live channel — no resume

- GIVEN a live channel was previously watched
- WHEN the user opens the channel
- THEN playback MUST start from the live edge (no resume prompt)

### Requirement: onPlay Navigates to /watch

The DetailPage's "Play" button MUST trigger navigation to `/watch/:type/:id` when clicked.

#### Scenario: Play button navigates

- GIVEN the user is on a movie detail page (id=42)
- WHEN they click "Play"
- THEN the router MUST navigate to `/watch/movie/42`

### Requirement: Parental Lock Button Deferred

The parental lock button MUST NOT be mounted in the player UI until F12. No placeholder, no disabled button — completely absent.

#### Scenario: No parental button in foundation

- GIVEN the player UI is rendered
- WHEN the DOM is inspected
- THEN no parental lock button element MUST exist in the DOM

### Requirement: 55 FPS During Playback

The player MUST maintain at least 55 FPS during video playback. Frame drops below 55 FPS for more than 2 consecutive seconds MUST trigger a performance warning.

#### Scenario: 60 FPS maintained

- GIVEN a 1080p video is playing
- WHEN FPS is monitored over 10 seconds
- THEN average FPS MUST be >= 55

#### Scenario: FPS drop warning

- GIVEN a video is playing
- WHEN FPS drops to 40 for 3 consecutive seconds
- THEN a performance warning MUST be logged

### Requirement: Hero Play Navigates To Movie Watch

Hero Play MUST navigate to `/watch/movie/:id`, not `/content/:id` (FL-04).

#### Scenario: Hero Play to watch movie

- GIVEN hero movie 42
- WHEN Play is activated
- THEN the router MUST navigate to `/watch/movie/42`
