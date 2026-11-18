# ADR-0012 — Ship API and 3D World State model

**Status:** Accepted (2026-11-05)
**Decides:** [Decide Ship API and 3D world state model](https://github.com/soubarnak/satyaki-site/issues/42), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)

## Context

One pure, deterministic TypeScript Ship simulation runs inside the
language worker for both Python (`snake_case`) and Cadet Java
(`camelCase`). Mission content (ADR-0011) supplies `shipStart` and a
declarative entity list; Pass checks read World State at `final` or
`intermediate` timing. The trace is capped at 500 events.

## Decisions so far

- **Coordinate and movement model: discrete grid.** World State uses
  integer `x, y, z` cells. Heading is one of 4 compass directions.
  `move()`, `turn_left()` / `turnLeft()`, `turn_right()` /
  `turnRight()`, `ascend()`, and `descend()` each count as 1 step.
  Continuous float positions and degree headings are rejected:
  determinism, collision, seed generation, grading, and replay must
  stay simple and identical in both languages.
- **Axes and bounds.** `x` = east, `z` = north, `y` = up. Heading is
  one of `north` (+z), `east` (+x), `south` (−z), `west` (−x) in
  World State (`ship.x`, `ship.y`, `ship.z`, `ship.heading`). Default
  bounds are `x 0–11, z 0–11, y 0–4` (12×12×5); a layout may shrink
  them, never exceed 16×16×6.

- **Entity vocabulary: closed set.** Content `type` is one of
  `asteroid_cracked` (blocks; laser destroys; state `present`),
  `asteroid_titanium` (blocks; laser-proof; state `present`, never
  changes), `crystal` (collectible; state `collected`), `switch`
  (state `on`), `gate` (blocks until open; state `open`), `wormhole`
  (teleport pair by shared `pairId`; no mutable state), `drone`
  (moving blocker; state `x, y, z, heading, active`). Every entity
  exposes `id, type, x, y, z` plus its type state. No free-form entity
  types or props in v1; a new type needs a new decision.

- **Blocked moves.** A move into a wall (out of bounds), closed gate,
  asteroid, or drone leaves the Ship in place; the step and energy are
  still spent, the trace event records `blocked: true`, and the
  program continues. Blocked moves are never a fatal error, and never
  free. Crystals, switches, and wormholes never block.

- **Interactions.** Crystal requires explicit `harvest()` on its
  cell. Entering a switch cell toggles it; a gate sharing the
  switch's `linkId` is open exactly while the switch is `on`.
  Entering a wormhole cell teleports the Ship to the paired wormhole
  cell within the same step, with no chain teleport on that move.
  Drones patrol 1 cell per Ship step along their authored axis,
  reversing at bounds or blockers; a drone blocks like a wall and
  deals no damage in v1.
- **Energy.** Starting energy comes from `shipStart.energy`. Costs:
  move/ascend/descend 1, turn 1, laser 2, harvest 1, sensors and log
  0; shield cost settled with its semantics (next decision). At 0
  energy, paid actions are blocked (`blocked: true`, reason
  `energy`), the program continues, and free actions still work.
  World State exposes `ship.energy`.
- **Actions beyond movement.** `laser()` (cost 2, 1 step) destroys a
  cracked asteroid 1 cell ahead at the same `y`; titanium, drones,
  and gates are unaffected. `shield()` (cost 1, 1 step) toggles
  `ship.shield`; no passive drain, no damage model in v1, so shield
  is Pass-checkable state only. `harvest()` (cost 1, 1 step) on a
  crystal cell sets `collected=true` and increments
  `ship.crystals`; elsewhere it is a spent no-op (`blocked: true`,
  reason `nothing_here`). `log(value)` costs 0, is not a step,
  appends to the run log in the trace, and is never graded.
- **Sensors.** Free, 0 steps, plain JSON scalars only (no objects or
  lists in v1): `scan_ahead()` / `scanAhead()` returns one of
  `empty`, `wall`, `asteroid_cracked`, `asteroid_titanium`,
  `gate_closed`, `gate_open`, `drone`, `crystal`, `switch`,
  `wormhole` for the cell ahead; `distance_ahead()` /
  `distanceAhead()` returns the count of empty cells before the
  first blocker ahead; `energy()`, `get_x()`, `get_y()`, `get_z()`,
  `crystals()` return ints; `heading()` returns the heading string;
  `is_shield_on()` / `isShieldOn()` and `on_crystal()` /
  `onCrystal()` return bools. Python names are `snake_case`, Java
  names `camelCase`, same meaning and argument order (here: none).
- **Step, trace, and World State snapshot.** A step is one Ship
  action call (move, turn, ascend, descend, laser, harvest, shield);
  sensors and `log()` are 0 steps. The trace emits one event per
  executed learner line as locked by the runtime research:
  `{step, line, kind, locals, shipDelta}`, with `shipDelta` null on
  non-Ship lines. `shipDelta` is `{action, blocked, reason?, ship:
  {x, y, z, heading, energy, shield, crystals}, changed: [...]}` —
  full Ship state plus only the entities changed by that action.
  The grader-readable World State snapshot is `{ship: {x, y, z,
  heading, energy, shield, crystals, stepsUsed}, entities: {<id>:
  {type, x, y, z, ...type state}}, bounds: {maxX, maxY, maxZ}}`;
  `statePath` reads paths such as `ship.x`, `ship.crystals`,
  `entities.crystal-1.collected`, `entities.gate-1.open`.
  `intermediate` checks evaluate after every Ship action; `final`
  checks evaluate after the program ends. Playback/scrub semantics
  belong to the debugger ticket; check/star semantics to the grader
  ticket.
- **Seed variation.** One deterministic PRNG in the single TS sim,
  keyed by the seed integer. The practice seed (first in the pool)
  uses the authored layout unchanged. Other seeds relocate only
  crystals, cracked asteroids, and drone start cells (patrol axis
  kept) to random empty cells in bounds; Ship start, gates,
  switches, wormholes, titanium asteroids, bounds, entity counts,
  and `linkId` / `pairId` links never move. The generator guarantees
  no spawn on the Ship start cell, no shared cells, and no crystal
  enclosed by titanium on all 6 sides; it resamples at most 100
  times, then falls back to the authored layout, which a build test
  flags. Reference solutions must Pass every seed (ADR-0011).
- **Errors and the full Ship name table.** All Ship actions and
  sensors take no arguments except `log(value)`. An unknown Ship
  name, wrong argument count, or a sensor/action mix-up is a learner
  code error: the run stops, the trace ends with
  `{kind: "error", line, excType, message}` for the shared kid-error
  translator, and World State at the stop remains readable. Normal
  program end triggers `final` checks; hitting the 500-event or
  3-second cap stops the run with a kid timeout message (Pass effect
  owned by the grader ticket). The complete v1 name table, Python to
  Java, is: `move`→`move`, `turn_left`→`turnLeft`,
  `turn_right`→`turnRight`, `ascend`→`ascend`, `descend`→`descend`,
  `laser`→`laser`, `harvest`→`harvest`, `shield`→`shield`,
  `log`→`log`, `scan_ahead`→`scanAhead`,
  `distance_ahead`→`distanceAhead`, `energy`→`energy`,
  `get_x`→`getX`, `get_y`→`getY`, `get_z`→`getZ`,
  `heading`→`heading`, `crystals`→`crystals`,
  `is_shield_on`→`isShieldOn`, `on_crystal`→`onCrystal`. No other
  Ship names exist in v1. Turns are never blocked; ascend/descend
  follow the blocked-move rule; a drone treats the Ship's cell as a
  blocker and never moves into it.

## Consequences

- The sim is one deterministic TypeScript module with synchronous
  JSON-shaped methods, instantiable in either language worker; the
  grader, debugger, and seed generator all read the one World State
  snapshot shape above.
- Cadet Java subset scope, kid-error wording, playback semantics,
  and Pass/Star check semantics stay with their owning tickets;
  this ADR fixes only the Ship API and World State contract they
  build on.

## Rejected alternatives

- Continuous float flight, rich radar objects, fatal blocked moves,
  free blocked moves, all-explicit interactions, and per-seed
  authored layouts: each breaks determinism, parity, par meaning,
  or authoring cost for ages 10–13 (see Decisions).
