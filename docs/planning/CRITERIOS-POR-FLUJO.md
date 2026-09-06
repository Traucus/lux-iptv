# CRITERIOS-POR-FLUJO — Lux IPTV

Pass/fail as written. Isolated unit tests do not close a flow.

Freeze 2026-08-30: **12 flows**, **9 screens**, **50 checklist items**, **F1–F7 Windows** + **F8–F10 platforms** + **F11–F14 backlog**.

Role: **Usuario**.

## Permission matrix

| Action | No source | Source saved | TMDB key |
| --- | --- | --- | --- |
| Add source | Yes | Replace only, retype | — |
| Refresh lists | Hidden | Chrome on S1/S3/S4/S5 | — |
| Browse rich rows | Empty / raw | Yes | Required for product look; outage → temporary placeholders |
| Play | No | Yes (libmpv on Windows) | Not required to decode |
| See saved password | Never | Never | — |
| See hostname | — | Host only (no user/password) | — |
| Select audio / subs | — | Yes on S7 when tracks exist | — |
| Exclusive fullscreen | — | Yes on S7 | — |
| EPG | No | Yes (F6) | — |

## FL-01 — Alta de fuente (S2) — F3

- [ ] Xtream vs M3U; overlay with counts; DONE → Home with rows.
- [ ] After DONE, S2 may show **host only**. Username and password are never shown.
- [ ] New password is masked with show/hide.

## FL-02 — Actualizar listas — F3

- [ ] Actualizar listas on Home, Live, Movies, Series without opening S2.
- [ ] Uses stored credentials; no secret fields on screen.
- [ ] Absent if no source. Upsert by URL.

## FL-03 — Live play — F1+F2

- [ ] `/live` category rows. Channel → `/watch/live/{id}` **libmpv**, no SeekBar.
- [ ] See-all (S8) for a live group shows the full grid; select still plays on S7.
- [ ] Live profile: ~20s cache, reconnect, `hwdec=auto-safe`. Picture does not freeze on a late segment.
- [ ] OSD 4s; Back to Live.

## FL-04 — Movies play + resume — F1+F2+F5

- [ ] Rows → detail → Play → `/watch/movie/{id}` via libmpv.
- [ ] See-all (S8) for a movie group shows the full grid; poster → S6.
- [ ] Hero Play same rule. Resume clock is real, not `0:00`.

## FL-05 — Series episode + next — F1+F2+F5

- [ ] Open series hydrates episodes (`get_series_info`). Episode → `/watch/episode/{id}`.
- [ ] See-all (S8) for a series group shows the full grid; card → S6.
- [ ] mkv / HEVC / AC3 play at origin quality (honest URL, not fake `.mp4`).
- [ ] 95%: overlay, 10s countdown, Watch Now / auto-advance.

## FL-06 — Capa visual TMDB — F4

- [ ] Product onboarding includes TMDB key (or explicit later provider). App is not “done” with empty art as the intended look.
- [ ] Home hero, list rows, and detail show poster/fanart/synopsis/rating when TMDB resolves.
- [ ] Runtime TMDB failure: placeholders, **no crash**, lists and Play still work.
- [ ] Key stored encrypted, never logged.

## FL-07 — EPG — F6

- [ ] S9 guide for live: channels × time (or now/next list at minimum).
- [ ] Live cards show current program when EPG data exists.
- [ ] Select a current/next program → S7 live play.

## FL-08 — Player chrome — F2

- [ ] Audio list is the real tracks from libmpv; selecting one **changes** the audible track.
- [ ] Subtitle list is real; Off works; user can load an external `.srt` / `.ass`.
- [ ] Exclusive fullscreen covers the Windows taskbar (`BrowserWindow.setFullScreen(true)`). Esc exits.
- [ ] Every OSD control has a tooltip. Icons match the action. Disabled when N/A (e.g. −10s on live).

## FL-09 — Honest URL / all formats — F2

- [ ] Catalog stores real `container_extension` and `direct_source`.
- [ ] Playback URL is not rewritten to `.mp4` when the source is mkv/ts/avi.
- [ ] Same list item that plays in VLC/mpv desktop plays in Lux Windows.

## T-01 — First run to first play — F3+F4+F2

- [ ] Add source → Home with art (if TMDB key set) → play a channel in libmpv. No password visible after DONE.

## T-02 — Refresh on Movies — F3

- [ ] From `/movies`, refresh, stay in movies IA, rows update.

## T-03 — Continuous quality — F2

- [ ] High-bitrate / 4K: UI not frozen >2s; libmpv uses `hwdec=auto-safe`; decode fail → player error, not black window or Chromium probe cascade.

## Mapping

| Flow | Screens | Phase |
| --- | --- | --- |
| FL-01 | S2, S1 | F3 |
| FL-02 | S1, S3, S4, S5 | F3 |
| FL-03 | S3, S7, S8 | F1+F2 |
| FL-04 | S1, S4, S6, S7, S8 | F1+F2+F5 |
| FL-05 | S5, S6, S7, S8 | F1+F2+F5 |
| FL-06 | S1, S3, S4, S5, S6 | F4 |
| FL-07 | S3, S9, S7 | F6 |
| FL-08 | S7 | F2 |
| FL-09 | S6, S7 | F2 |
| T-01 | S2, S1, S3, S7 | F3+F4+F2 |
| T-02 | S4 | F3 |
| T-03 | S7 | F2 |

F8–F10 have no Windows flows in this freeze (other runtimes). F11–F14 have no flows (backlog).

## Consistency

| Axis | Value |
| --- | --- |
| Screens | 9 |
| Flows | 12 |
| Checklist items | 50 |
| Windows develop | F1–F7 |
| Platforms | F8–F10 |
| Backlog | F11–F14 |
