# Delta for desktop-shell

## MODIFIED Requirements

### Requirement: Player IPC Channels

Player preload MUST expose `getSource`, `getProxiedUrl`, `reportError`, and `reportProgress`. `getSource` MUST return format and live/VOD metadata only, not a playback URL.

(Previously: getSource returned the proxied stream URL.)

#### Scenario: getSource returns format metadata

- GIVEN a live HLS id
- WHEN `getSource(id)` is called
- THEN it MUST return format and live/VOD metadata, not a media `src`

#### Scenario: reportError logs error

- GIVEN a player error
- WHEN `reportError({code, message})` is called
- THEN main MUST log it

#### Scenario: getProxiedUrl returns playback URL

- GIVEN a catalog id
- WHEN `getProxiedUrl(id)` is called
- THEN it MUST return the local proxy URL

### Requirement: Hardware Acceleration Configuration

HW accel MUST be configurable: Linux off by default unless `LUX_HW_ACCEL=true`, Windows/macOS on by default, applied before `app.ready` (T-03).

(Previously: Linux GPU env switch restated.)

#### Scenario: Linux disables HW accel by default

- GIVEN Linux, no override
- WHEN the app starts
- THEN `app.disableHardwareAcceleration()` MUST run before `app.ready`

#### Scenario: Override enables HW accel on Linux

- GIVEN Linux and `LUX_HW_ACCEL=true`
- WHEN the app starts
- THEN HW accel MUST stay on
