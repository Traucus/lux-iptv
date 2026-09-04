# Delta for desktop-shell

## ADDED Requirements

### Requirement: Preload Remains Sandboxed CommonJS

Player IPC on `window.luxAPI.player` MUST be exposed from the sandboxed preload compiled as CommonJS.

#### Scenario: luxAPI.player is defined

- GIVEN the renderer loads with sandbox and contextIsolation
- WHEN `window.luxAPI.player` is accessed
- THEN it MUST be a defined object with callable player IPC methods

### Requirement: libmpv Player IPC

Main MUST expose player IPC to load, control, and diagnose in-process libmpv, with the Lux `BrowserWindow`. Diagnosis MUST report libmpv load failure, not missing `mpv.exe`.

#### Scenario: Play IPC loads origin in-process

- GIVEN a catalog id with an origin URL
- WHEN the renderer requests play
- THEN main MUST load that URL in-process in the Lux window

#### Scenario: Load failure IPC

- GIVEN libmpv cannot load
- WHEN play is requested
- THEN IPC MUST return a load-failure diagnosis
- AND MUST NOT start hls.js or spawn `mpv.exe`

## MODIFIED Requirements

### Requirement: Player IPC Channels

Player preload MUST expose `getSource`, `getProxiedUrl`, `reportError`, and `reportProgress`. `getSource` MUST return format and live/VOD metadata only, not a playback URL. Product playback MUST use libmpv origin play, not `getProxiedUrl` as the happy path. `getProxiedUrl` MAY remain for non-happy-path proxy use.

(Previously: `getProxiedUrl` was the required playback URL.)

#### Scenario: getSource returns format metadata

- GIVEN a live HLS id
- WHEN `getSource(id)` is called
- THEN it MUST return format and live/VOD metadata, not a media `src`

#### Scenario: reportError logs error

- GIVEN a player error
- WHEN `reportError({code, message})` is called
- THEN main MUST log it

#### Scenario: getProxiedUrl is not the happy path

- GIVEN a catalog id
- WHEN playback starts
- THEN libmpv MUST use the origin URL
- AND `getProxiedUrl` MUST NOT be required for the happy path
