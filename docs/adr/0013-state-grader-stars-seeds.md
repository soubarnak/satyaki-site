# ADR-0013 — State grader, Stars, and multi-Seed rules

**Status:** Accepted (2026-11-05)
**Decides:** [Decide state grader, 3-star, and multi-seed rules](https://github.com/soubarnak/satyaki-site/issues/43), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)

## Context

Mission content (ADR-0011) supplies declarative Pass checks, a `par`
(`maxSteps`, `maxEnergy`), a `star3Concept` reference, a tier, and a
Seed pool, and defers all grading semantics to this decision. The Ship
API decision (ADR-0012) supplies the grader-readable World State
snapshot, the trace (one event per executed line, capped at 500
events), step and energy costs, and deterministic Seed variation.
Progress storage (ADR-0010) stores best Stars per language and Run /
Pass aggregates. Grading must let any valid logic pass, never grade
code text for correctness, and run identically for Python and Cadet
Java in the browser workers.

## Decision

- **Star 1 (Pass).** A Run grades every Seed in the pool, practice
  Seed first, then hidden Seeds. Star 1 requires every Pass check to
  pass on every Seed. Code text and stdout never affect Star 1;
  `log()` output is never graded (ADR-0012). Only the Planet-concept
  AST check below reads code, and it can only add a Star.
- **Check timing.** A `final` check is judged only at program end. An
  `intermediate` check is judged on the starting World State (step 0)
  and after every Ship action; failing at any judged point fails that
  check on that Seed. There is no third timing in v1.
- **Comparators.** A check comparator is one of `eq`, `ne`, `gte`,
  `lte`, and the expected value is one JSON scalar (number, boolean,
  or string). No expressions and no per-Mission grading code. If a
  `statePath` does not resolve on a Seed, that check fails on that
  Seed; it is never a grader crash or a Cadet error. Authoring
  mistakes are caught by the reference-solution build test
  (ADR-0011).
- **Seed counts.** Total Seeds per Mission, practice Seed included:
  `intro` 2, `core` 3, `stretch` 4. Boss Gate Part B uses 3. Part B
  reuses the same check, Seed, cap, and feedback rules and awards no
  Stars, so Par and the concept check never apply there.
- **Star 2 (Par).** Star 2 requires Star 1, plus, on the practice
  Seed only: `stepsUsed` at or under `par.maxSteps` AND energy spent
  (starting energy minus remaining energy) at or under
  `par.maxEnergy`. Both caps must hold. Hidden Seeds gate Star 1
  only, never Par.
- **Star 3 (Planet concept).** Star 3 requires Star 1, plus a
  concept check in the language just run, judged on the practice
  Seed: a construct for the Mission's `star3Concept` (the Planet
  concept only, per ADR-0011) exists in Cadet code and at least one
  such construct actually executes, proven by trace line hits. Only
  code inside the `YOUR CODE BELOW` / `YOUR CODE ABOVE` editable
  region counts; starter scaffold, comments, and string literals
  never count. The closed per-concept mapping, identical in meaning
  for the Python AST and the Cadet Java CST, is: loop = `for` /
  `while` (Java also enhanced `for`); conditional = `if` (Java also
  `switch` and ternary); function = a Cadet-defined function or
  method that is called at least once; list = creating a list or
  array and reading or writing an element by index (Python list
  literal plus subscript; Java array or `ArrayList` plus index,
  `get`, or `set`). A Planet concept outside this mapping cannot be
  a `star3Concept` until a new decision extends the mapping. Star 3
  never blocks or removes Star 1 or Star 2.
- **Stars stack.** Stars earned on one Run are a count: 1 for a Pass,
  plus 1 for Par, plus 1 for the concept check. A Pass that uses the
  concept but misses Par earns 2 Stars. Best Stars per language
  (ADR-0010) stores this count.
- **Caps and errors.** Three separate guards apply per Seed run:
  500 Ship steps, 500 trace events, and 3 seconds wall clock.
  Hitting any guard stops that Seed's run, awards no Stars from that
  Run, keeps the World State at the stop readable, and counts as a
  Run, never a Pass. Runtime (learner code) errors have the same
  no-Pass outcome, reported through the shared kid-error translator
  instead of cap feedback. When a Seed stops early, its `final`
  checks are not evaluated; already-failed `intermediate` checks and
  the stop reason are reported. Other Seeds still grade normally.
- **Feedback.** On a failed Run the Cadet sees each failed check by
  its Cadet-facing `label`, grouped by timing, plus the stop reason
  where relevant. For the practice Seed an `intermediate` failure
  may name the step where it first failed. Hidden Seeds contribute
  only a per-check boolean: no Seed identity, coordinates, expected
  values, or layout details. If the practice Seed passes but a
  hidden Seed fails a check, feedback adds one fixed line with the
  failed label: "Works on this layout, but not on every layout.
  Make your code work when crystals and asteroids move." After a
  Pass, missed-Star feedback shows practice-Seed Par numbers (steps
  and energy used against their caps) and names the Planet concept
  for Star 3; no Star section appears on a failed Run. Viewing hints
  never reduces Stars; hints used is recorded for the skill radar
  only (ADR-0010).
- **Counting and snapshot.** One press of Run is one stored Run,
  however many Seeds grade; it becomes one stored Pass only when
  Star 1 is earned. The grader grades the exact code snapshot in
  the editor at Run press, in the active editor's language; a Pass
  stores that snapshot as the passing code under ADR-0010's
  replacement rule.
- **Result shape.** One result per Run: `{pass, stars, parMet,
  conceptMet, stopReason, checks}`, where `stopReason` is one of
  `none`, `error`, `step-cap`, `event-cap`, `time-cap`, and
  `checks` follows author order as `{id, label, timing, passed,
  firstFailStep, hiddenFail}`, with `firstFailStep` set only from
  the practice Seed. Grading runs every Seed to completion even
  after a failure; failed labels are deduplicated; the practice
  Seed's trace is the only trace returned for playback, and hidden
  Seed traces are discarded after grading.
- **Trust model.** Grading runs in the browser workers; the server
  stores reported Pass and Stars without re-grading. Faked progress
  is an accepted v1 risk: there are no prizes, no public
  leaderboard, and Hangar cosmetics have no cash value.

## Consequences

- Any solution logic that reaches the required World State on every
  Seed passes, in either language, satisfying the glossary Pass
  definition (ADR-0009).
- Cadets optimise Par and concept use against the layout they can
  see; hidden Seeds test generalisation only, and their feedback
  teaches anti-hardcoding without leaking layouts.
- Content authors must write check labels that make sense without
  coordinates, and Par values that the practice-Seed reference
  solution meets (already enforced by the build test in ADR-0011).
- A future stakes-bearing feature (prizes, public ranking) must
  reopen the trust model and add server-side verification.

## Rejected alternatives

- Par judged on hidden Seeds or on the worst Seed: punishes Cadets
  for distance changes in layouts they cannot see.
- Concept presence without execution, or counting scaffold code:
  awards Star 3 for dead code, comments, or Training Wheels code
  the Cadet did not write.
- Star 3 gated behind Star 2: contradicts the glossary, where each
  Star grade names its own condition.
- Short-circuit grading at the first failing Seed: saves seconds
  but returns incomplete feedback per Run.
- Server re-grading in v1: needs a second grader, breaks offline
  logged-out play, and defends stakes that do not exist yet.
