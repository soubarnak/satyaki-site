# ADR-0010 — Progress record v2: derived totals, per-field merge

**Status:** Accepted (2026-11-04)
**Decides:** [Decide progress, stars, and save-code sync model](https://github.com/soubarnak/satyaki-site/issues/36), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)
**Supersedes:** ADR-0006 for the Space Coder record. ADR-0006 stays as the v1 record.

## Context

Space Coder progress lives in three places: an account on the server
(source of truth when logged in, per the auth ticket), `localStorage`
for logged-out play and device cache, and a Save Code string for
export/import and device moves. One Cadet can play logged out, on
several devices, and in both Python and Java. Whole-record
last-write-wins would let an older device erase newer Stars; a stored
total can drift from the passes behind it (the ADR-0006 problem).

## Decision

One v2 progress shape is shared by server, localStorage, and Save Code.

Stored, per Cadet:

- Per Mission, per language: the autosaved draft (max 32,768
  characters) with an `updatedAt` time, and the passing code. Passing
  code is replaced only by a Pass with more Stars; on equal Stars the
  newer Pass wins.
- Per Mission: best Stars per language, run and Pass counts, hints
  used, first and last Pass times, last language used.
- Per Planet: Boss Gate passed flag, attempt count, last attempt time.
  Boss Gates award no Stars and have no retry cooldown.
- Streak dates (local calendar days with at least one Mission run,
  newest 400 kept) and the equipped Hangar cosmetics (hull, trim,
  thruster, laser colour).
- An owner tag on the local record only: `guest`, or one account id.

Derived, never stored: Mission Stars (best across languages), total
Stars (max 75), Planet and Mission unlock state (linear: a Mission
opens after the previous Mission's Pass; a Boss Gate after all five
Planet Missions pass; the next Planet after the Boss Gate), Hangar
unlocks (total-Star thresholds, never spent), and current streak
(a day with a run counts; the streak survives until one full day is
missed).

Merge is one per-field rule used by login merge, Save Code import,
and multi-device sync: Passes, Stars, Boss Gates, and streak dates
union with the higher Stars winning and no downgrade ever; code
drafts resolve per Mission and language by `updatedAt`. Login merges
local progress only when the local owner is `guest` or the same
account; a different account replaces the local record (the old
account is intact on the server).

Save Code format: `SSC2.` plus base64url of gzipped versioned JSON,
with a short checksum. Import shows a preview (Missions gained, Stars
gained, code replaced), rejects an unknown version or a decoded
payload over 2 MiB, drops single malformed entries, and applies
nothing until confirmed. QR export is offered only when the payload
fits; text or file export always works.

Sync timing: drafts autosave locally after 800 ms idle; when logged
in they sync after 3 s idle and on Run, Pass, and page leave; offline
changes queue and merge on reconnect. No raw event log is kept:
per-Mission aggregates are the only stored input for a future skill
radar. v1 JavaQuest passes do not convert to Missions (new content,
no mapping); v1 streak dates carry over and retired badges drop.

## Consequences

- An old or offline device can add progress but can never remove
  Stars, passes, or Boss Gate clears from a newer one.
- Account deletion (auth ticket) deletes this record with the
  account; exported Save Codes stay in the Cadet's hands and cannot
  be revoked server-side.
- The skill radar ticket gets fixed inputs (the aggregates above)
  without any telemetry store for children.
- ADR-0006's derived-total and per-field sanitization principles
  carry forward; its v1 record shape does not.

## Rejected alternatives

- Whole-record max-progress or last-write-wins: one stale device
  erases newer work, and "max" is undefined across unlike fields.
- Separate progression per language: doubles the 25-Mission journey
  into 50 passes and splits the Planet concept story.
- Spendable Stars for the Hangar: spending would punish cosmetic
  choice with lost progress standing, so thresholds unlock instead.
- A raw run-event log for the radar: stores child telemetry the
  aggregates already cover, with retention cost and no v1 consumer.
