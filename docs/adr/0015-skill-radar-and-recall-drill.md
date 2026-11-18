# ADR-0015 — Skill radar scoring and daily recall drill

**Status:** Accepted (2026-11-05)
**Decides:** [Decide skill radar scoring and daily recall drill selection](https://github.com/soubarnak/satyaki-site/issues/47), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)

## Context

The progress record (ADR-0010) stores, per Mission, best Stars per
language, run and Pass counts, hints used, first and last Pass
times, and last language used. Those aggregates are the only stored
skill-radar input; there is no raw event log. The content model
(ADR-0011) gives each Mission one new concept plus its Planet
concept, but the concept spine itself is not yet settled, so
per-concept axes would block on another map. The state grader
(ADR-0013) records hints for the skill radar only and never lets
hints reduce Stars. `Skill Radar` and `Daily Recall Drill` are
added to `GLOSSARY.md` with this decision.

## Decision

### Skill Radar axes and scoring (Q1, Q6, Q9)

- The Skill Radar has five axes, one per Planet, each scored
  0–100. All five axes always render; a locked or unstarted Planet
  scores 0 and carries a locked mark.
- A Mission contributes its best Stars across Python and Java
  (Mission Stars, ADR-0010) divided by 3. A Planet score is the
  mean of its five Mission values, times 100, rounded. An unpassed
  Mission contributes 0.
- Run and Pass counts, hints used, and Pass times never change a
  Planet score. A Cadet can predict the radar: more Stars, higher
  axis, and no penalty for experimenting or using hints.

### Decay and derivation (Q4, Q7, Q17)

- Scores never decay. Staleness is a drill-selection signal only,
  so a school break never erases achievement; this matches the
  never-downgrade rule for Passes and Stars in ADR-0010.
- The radar is derived from the stored aggregates on read and is
  never stored, mirroring total Stars and unlock state. The same
  math applies to the server record, the local record, and a Save
  Code.
- First Pass time has no radar or drill role. Last Pass time alone
  measures staleness.

### Daily Recall Drill pool (Q2, Q10, Q12, Q14)

- One optional drill per local calendar day. Skipping costs
  nothing, there is no catch-up queue, and the drill never blocks
  Mission, Boss Gate, Playground, or Arena play.
- The pool is Passed Missions only. Boss Gates, Playground, and
  Arena are excluded: they award no Stars and do not fit the
  per-Mission aggregates.
- A Mission enters the pool on the local day after its Pass. If
  every Passed Mission was passed today, no drill is offered for
  the rest of today. A Cadet with no Pass sees no drill card and
  is pointed at the first open Mission.
- A Mission with 3 Stars stays eligible at lowest priority. A
  one-Mission pool may repeat on later days until the pool grows.

### Drill selection (Q11, Q18)

- Eligible Missions sort by: lowest Planet score; fewest Mission
  Stars; longest since last Pass; most hints used; lowest
  passes-to-runs ratio; then a hash of local date plus Mission
  slug as the daily tie-break. The Cadet-facing reason is only
  that the Planet needs practice and the Mission has not been
  visited lately; no formula is shown.
- The pick is frozen for the day. First load each local day
  stores the date plus Mission slug in local state outside the
  progress record, Save Code, and sync, so runs and Passes during
  the day never shift the pick. Any Pass on the picked slug that
  day completes the drill, whether entered from the drill card or
  normal Mission play.

### Drill session (Q3, Q5, Q8, Q13, Q15, Q16)

- The drill awards no separate reward: no bonus Stars, no new
  currency, no Hangar credit. A replay Pass can still raise best
  Stars under the normal grader rules, and the day counts toward
  the streak under the normal Mission-run rule.
- The drill language is the one with lower best Stars on the
  Mission. A tie goes to the language not used last on that
  Mission; a further tie is the Cadet's pick. Switching language
  is always free.
- The drill opens the Mission starter code in the drill language.
  Drill edits are scratch only: they never autosave over the
  Mission draft, and closing the drill or switching language
  discards them and restarts from that language's starter. A Pass
  still updates Stars and passing code by the normal ADR-0010
  rules.
- All three hint tiers are available in order, recorded in hints
  used as normal. Hints never block drill completion and never
  cut Stars.
- A Run without a Pass leaves the same drill in place for
  unlimited same-day retries. Completion is held in the same
  local date-plus-slug state as the frozen pick, outside the
  progress record; a new device may therefore offer one extra
  drill on the same day. That cost is accepted to keep the
  ADR-0010 record fixed.
