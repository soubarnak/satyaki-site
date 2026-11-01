# ADR-0006 — Progress record: derived total, per-field sanitization

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Amends:** SRS DR-003 (stored total points); implements DR-004, DR-006,
DR-007 under CR-003 (browser storage only)

## Context

One progress record per browser holds passed levels, total points, earned
badges, and streak dates. DR-003 as written stores total points and resets
an out-of-range stored value to 0 with a warning. Combined with FR-008
(points awarded exactly once per level), a reset total beside intact passes
can never be re-earned: the points are permanently lost while the levels
stay passed. A stored total can also drift from the passed list after any
write bug. Browser storage is user-editable, so every field must survive
hostile or corrupt values on load (threat TH-005).

## Decision

One `localStorage` key holds one JSON record:

```json
{ "version": 1, "passedLevelIds": [1, 2], "badges": ["first-print"], "streakDates": ["2026-11-01"] }
```

- **Total points is derived, never stored:** the sum of point values of the
  passed levels, computed on read. FR-008 award-once holds by construction.
  DR-003 is amended to this wording; its 0 to 5000 range becomes a check on
  the computed value (10 levels at DR-002's 500 maximum).
- **One-key writes:** a pass, its points effect, badge, and streak updates
  land in a single record write, satisfying the WF-002/WF-004
  together-or-not-at-all rule and DR-008 same-device read-after-write.
- **Sanitization on load, per field:** level ids outside 1 to 10 or
  duplicated are dropped; badge names outside the known set are dropped;
  streak dates are deduplicated, sorted ascending, and malformed entries
  dropped (DR-004 unchanged). Unparseable JSON or an unknown `version` is
  treated as no progress; the next legitimate write overwrites it.
- **Streak count is computed** from the stored dates under the FR-015
  forgiving rule, never stored.

Badge earning events are content decisions deferred to the level content
pack (map fog); this record only stores earned badge names. Exact badge id
strings are fixed with that pack.

## Consequences

- A hand-edited record can forge passes only on the editor's own device
  (TH-005 residual, already accepted in the SRS threat model); it cannot
  produce a points value inconsistent with the passed list.
- Changing a level's point value in a later content revision recomputes all
  totals consistently, with no migration.
- Sanitization is a pure function from stored text to progress value,
  unit-testable from the DR-003/DR-004 seed cases (ADR-0007).
- Version field reserves the migration path: a future `version: 2` record
  converts or discards v1 explicitly, never misreads it.

## Rejected alternatives

- Stored total with reset-to-0 (DR-003 literal): unrecoverable points loss
  beside intact passes, plus drift risk.
- Stored total reconciled to the derived sum on load: two sources of truth
  where one never wins.
