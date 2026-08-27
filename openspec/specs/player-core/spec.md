# Delta for player-core

## ADDED Requirements

### Requirement: hls.js Engine with Resilience

The player MUST use hls.js as the HLS playback engine. It MUST implement a resilience loop: on error, attempt reconnect up to 3 times with exponential backoff (1s, 2s, 4s). After 3 failures, report fatal error.

#### Scenario: Transient error recovers

- GIVEN hls.js encounters a NETWORK_ERROR
- WHEN the resilience loop retries after 1s
- THEN playback MUST resume from the point of failure

#### Scenario: 3 consecutive failures — fatal

- GIVEN 3 consecutive reconnect attempts all fail
- WHEN the 4th error occurs
- THEN the player MUST report a fatal error and show error UI

### Requirement: VideoPlayer Organism

The VideoPlayer component MUST render a fullscreen `<video>` element that fills its container. It MUST accept a `src` prop (proxied URL) and manage the hls.js lifecycle.

#### Scenario: VideoPlayer renders fullscreen

- GIVEN VideoPlayer is mounted with a valid src
- WHEN the component renders
- THEN a `<video>` element MUST fill the container (width: 100%, height: 100%)

#### Scenario: VideoPlayer cleans up on unmount

- GIVEN VideoPlayer is mounted
- WHEN the component unmounts
- THEN hls.js MUST be destroyed and the video element removed

### Requirement: SeekBar Interactive

The SeekBar MUST support pointer drag (mouse/touch), D-Pad left/right navigation, and display a buffered range indicator.

#### Scenario: Pointer drag seeks

- GIVEN the user clicks at 50% of the SeekBar width
- WHEN they drag to 75% and release
- THEN `video.currentTime` MUST update to 75% of duration

#### Scenario: D-Pad right seeks forward

- GIVEN the SeekBar is focused
- WHEN D-Pad right is pressed
- THEN `video.currentTime` MUST advance (e.g., +10s)

#### Scenario: Buffered range displayed

- GIVEN the video has buffered 60% of its duration
- WHEN the SeekBar renders
- THEN the buffered range MUST be visually indicated up to 60%

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

The OSD MUST include: progress/seek bar, audio track selector, subtitle track selector, and aspect ratio toggle (16:9, 4:3, Zoom, Fit).

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

For VOD content (movies, episodes), the player MUST check IndexedDB for a saved playback position on load. If found, it MUST seek to that position and show a "Resume from X?" prompt.

#### Scenario: Resume prompt shown

- GIVEN a movie was last watched at 45:00
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

### Requirement: Native video Fallback for MP4/MKV

For non-HLS formats (MP4, MKV), the player MUST use the native `<video>` element without hls.js. The same OSD and controls MUST apply.

#### Scenario: MP4 plays natively

- GIVEN a catalog item with media_format = 'mp4'
- WHEN playback starts
- THEN the native `<video>` element MUST play the file (no hls.js attached)

### Requirement: onPlay Navigates to /watch

The DetailPage's "Play" button MUST trigger navigation to `/watch/:type/:id` when clicked.

#### Scenario: Play button navigates

- GIVEN the user is on a movie detail page (id=42)
- WHEN they click "Play"
- THEN the router MUST navigate to `/watch/movie/42`

### Requirement: Parental Lock Button Deferred

The parental lock button MUST NOT be mounted in the player UI until Slice 4. No placeholder, no disabled button — completely absent.

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
