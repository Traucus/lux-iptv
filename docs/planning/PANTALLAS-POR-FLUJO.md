# PANTALLAS-POR-FLUJO — Lux IPTV

Freeze 2026-08-30: **9 screens**, **12 flows**, **F1–F7 Windows** + **F8–F10 platforms** + **F11–F14 backlog**.

Reconciliation **2026-09-14**: **9 remaining Windows checklist items**. FA-17/FA-18 code is PARCIAL pending Windows proof.

Role on every screen: **Usuario**.

## S1 — Home `/`

| Field | Content |
| --- | --- |
| Purpose | Land after ingest. Hero + Netflix rows. Entry to play and lists. |
| Layout | Sidebar · chrome refresh · hero · Continue Watching · category carousels |
| Components | `Sidebar`, hero, `CategoryRow`, `MoviePosterCard` |
| Visible states | Empty (no source) · ingest overlay · rows · TMDB placeholders on outage |
| Actions | Refresh (F3) · Play hero → S7 (F2) · poster → S6 · Continue → S7 (F5) |
| Broadcasts | `ingest:onProgress` |
| Phase | F1 layout; F3 refresh; F4 art; F2 Play; F5 continue |
| Flows | FL-01, FL-02, FL-04, FL-06, T-01 |

## S2 — Source vault `/ingest`

| Field | Content |
| --- | --- |
| Purpose | Add or replace Xtream/M3U. Configured: host only; never username/password. |
| Layout | Form (empty/replace) or configured summary (no password) · overlay |
| Components | `CredentialsForm`, progress overlay, `TmdbKeyOnboarding` |
| Visible states | Empty · ingesting (counts) · configured (host only) · TMDB key missing/saved · error |
| Actions | Start ingest · cancel · replace source (retype) · save TMDB key |
| Broadcasts | `ingest:start`, `ingest:getProgress` |
| Phase | F3; TMDB key slot F4 |
| Flows | FL-01, T-01 |

## S3 — Live `/live`

| Field | Content |
| --- | --- |
| Purpose | Browse live categories; zap to player; now/next when EPG exists. |
| Layout | Sidebar · refresh · category rows · now/next on cards (F6) |
| Components | `Sidebar`, `CategoryRow`, live cards |
| Visible states | Loading · rows · empty group · EPG missing |
| Actions | Refresh · channel → S7 · see-all → S8 · guide → S9 |
| Broadcasts | catalog grouped live |
| Phase | F1/F3/F4/F2/F6 |
| Flows | FL-02, FL-03, FL-06, FL-07, T-01 |

## S4 — Movies `/movies`

| Field | Content |
| --- | --- |
| Purpose | Browse movies by group with TMDB posters. |
| Layout | Sidebar · refresh · poster rows |
| Components | `Sidebar`, `CategoryRow`, `MoviePosterCard` |
| Visible states | Loading · rows · empty |
| Actions | Refresh · poster → S6 · see-all → S8 |
| Broadcasts | catalog grouped movie |
| Phase | F1/F3/F4/F5 |
| Flows | FL-02, FL-04, FL-06, T-02 |

## S5 — Series `/series`

| Field | Content |
| --- | --- |
| Purpose | Browse series by group. |
| Layout | Same as S4 for series |
| Components | `Sidebar`, `CategoryRow`, series cards |
| Visible states | Loading · rows · empty |
| Actions | Refresh · card → S6 · see-all → S8 |
| Broadcasts | catalog grouped series |
| Phase | F1/F3/F4/F5 |
| Flows | FL-02, FL-05, FL-06 |

## S6 — Detail `/content/:type/:id`

| Field | Content |
| --- | --- |
| Purpose | Movie or series detail. Type in URL (sqlite ids are per-table). |
| Layout | Fanart header · metadata · Play · seasons/episodes (series) |
| Components | `DetailHeader`, `MovieDetail` / `SeriesDetail` |
| Visible states | Loading · hydrated · series episodes empty→fetch `get_series_info` |
| Actions | Play movie → `/watch/movie/:id` · episode → `/watch/episode/:id` |
| Broadcasts | `catalog:getById`, series info hydrate |
| Phase | F1/F4/F2 |
| Flows | FL-04, FL-05, FL-06, FL-09 |

## S7 — Player `/watch/:type/:id`

| Field | Content |
| --- | --- |
| Purpose | Windows product player: **libmpv**, not Chromium happy path. |
| Layout | libmpv child HWND with Chromium OSD in 88/168 inset bands · seek (VOD only) |
| Components | In-process libmpv surface + visible load-subtitle OSD. Remaining: Windows click-test (FA-17); Windows subtitle file path (FA-03) |
| Visible states | Loading · playing · recovering (>1s stall) · error · resume dialog (VOD) · next-episode card |
| Actions | Play/pause · ±10s (VOD) · audio · subs · load `.srt` · aspect · **exclusive fullscreen** · back |
| Broadcasts | engine events; `setFullScreen`; resume throttle |
| Phase | F2 / F5 resume+next / F6 from EPG |
| Flows | FL-03, FL-04, FL-05, FL-07, FL-08, FL-09, T-01, T-03 |

## S8 — See-all `?group=`

| Field | Content |
| --- | --- |
| Purpose | Full grid of one category. |
| Layout | Title · filter · poster/channel grid |
| Components | grid of the same cards as the parent list |
| Visible states | Loading · grid · empty |
| Actions | Back to parent list · open S6 or S7 |
| Broadcasts | `catalog:list` with `groupTitle` |
| Phase | F5 |
| Flows | FL-03, FL-04, FL-05 |

## S9 — EPG `/epg` (or Live guide mode)

| Field | Content |
| --- | --- |
| Purpose | Live guide. Select current/next → play. |
| Layout | Channels × time **or** now/next list (minimum) |
| Components | guide grid / now-next list |
| Visible states | Loading · data · no EPG |
| Actions | Select program → S7 live |
| Broadcasts | EPG fetch |
| Phase | F6 |
| Flows | FL-07 |

## Phase matrix

| Screen | F1 | F2 | F3 | F4 | F5 | F6 | F7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1 | layout | Play | refresh | art | continue | — | — |
| S2 | — | — | vault | TMDB key | — | — | — |
| S3 | rows | play | refresh | art | S8 | now/next | — |
| S4 | rows | — | refresh | art | S8 | — | — |
| S5 | rows | — | refresh | art | S8 | — | — |
| S6 | layout | Play→watch | — | fanart | — | — | — |
| S7 | — | libmpv+tracks+FS+OSD | — | — | resume/next | from EPG | — |
| S8 | — | — | — | — | new | — | — |
| S9 | — | — | — | — | — | new | — |

F7 is installer (no new screen). F8–F10 are other apps. F11–F14 backlog.

## Consistency

| Axis | Value |
| --- | --- |
| Screens | 9 |
| Flows | 12 |
| Checklist remaining (Windows) | 9 |
| Windows develop | F1–F7 |
| Platforms | F8–F10 |
| Backlog | F11–F14 |
