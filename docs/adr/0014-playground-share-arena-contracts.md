# ADR-0014 — Playground, share-link, and Arena contracts

**Status:** Accepted (2026-11-05)
**Decides:** [Decide playground, share links, and arena contracts](https://github.com/soubarnak/satyaki-site/issues/45), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)

## Context

The glossary (ADR-0009) defines Playground as an ungated free-coding
space with no Pass and no Stars, and Arena as a challenge space
outside the 25-Mission path, and defers both contracts to this
decision. The Ship API and World State model (ADR-0012) locks a
closed 7-entity vocabulary, scalar sensors, and one deterministic
TypeScript simulation for Python and Cadet Java. The state grader
(ADR-0013) locks the declarative check shape and the 500-step /
500-event / 3-second caps. The progress record (ADR-0010) stores
per-Mission drafts and aggregates and is extended here, not
replaced. The v1 printed-command Arena (`lib/arena.ts`) and text
Playground (`lib/playground.ts`) are prior art only; neither
contract carries over.

## Decision

### Scope split (Q1)

- Playground holds the world builder, the challenge designer,
  starter templates, and share links. Arena holds only `on_tick`
  battles. There is no Arena authoring in v1.

### World builder (Q2, Q3, Q9, Q10)

- The builder is a code API, not a drag-drop visual editor. Cadet
  code calls builder calls once at the top of the program to spawn
  entities, set the Ship start, and set the Ship colour; the run
  then plays in that world. A visual editor returns only under a
  redrawn destination.
- The builder reuses the closed 7-entity vocabulary of ADR-0012.
  `spawn_portal` is sugar for a wormhole pair. A ring course is an
  arrangement helper that places crystals in a ring; it is not a
  new entity. Any new entity type needs a new decision.
- Builder calls run in a setup phase before step 1: 0 steps, 0
  energy, no trace events. A builder call after the first Ship
  action is a learner code error; the run stops and the kid message
  names the line. Defaults: Ship start cell `0,0,0`, heading east,
  energy 50, bounds 12×12×5.
- Ship colour is a closed basic palette: red, blue, green, gold,
  violet, white. Colour is cosmetic only, never graded, and never
  appears in Pass checks. Hangar cosmetics (hull, trim, thruster,
  laser colour, unlocked by total Stars per ADR-0010) are a
  separate layer the builder never sets. An unknown colour is a
  learner code error.

### Challenge designer and goals (Q4, Q11)

- A shared challenge goal reuses the ADR-0013 check shape
  (`statePath`, comparator, scalar expected value, timing). The
  designer picks from a goal menu: reach a cell, collect N
  crystals, open a gate, flip a switch, survive N steps. No
  code-text goals and no custom expressions.
- The designer sets 1 to 3 goals; all must hold (AND only, no OR,
  no NOT). Each goal judges `final`, except the survive goal,
  which judges `intermediate`. A shared challenge has one authored
  layout and no hidden Seeds. The result names each goal met or
  not met. Playground itself stays Pass-free per the glossary:
  goals judge only the shared challenge copy and award no Stars
  and no Par.

### Share links (Q5, Q12)

- A share link is a URL fragment `#c=` plus
  base64url(deflate(JSON)). The payload carries the world layout,
  the goal set, starter code, and a title. The fragment never
  reaches the server; no Account is needed to open a link, and
  there is no server storage in v1. Total link cap: 2,000
  characters. Over the cap is a clear kid error; nothing imports
  truncated.
- The payload carries a `v: 1` version field. Import rejects an
  unknown version, an unknown entity type, an out-of-bounds cell,
  a duplicate-cell spawn, or an over-cap world: the whole import
  fails with one kid error and nothing half-loads. Title max 40
  characters; starter code max 4,000 characters. There is no
  checksum or signature in v1; the link holder trusts the sender,
  and imported code runs under the same caps as the Cadet's own
  code.

### Starter templates (Q6)

- Six starter templates: Empty World, Ring Course, Crystal
  Harvest, Switch and Gate, Wormhole Maze, Drone Patrol. Each
  ships a world plus matching Python and Java starter code. The
  Cadet edits a copy; the original template never mutates.

### Creation storage (Q13)

- Playground creations extend the ADR-0010 v2 progress record:
  per Cadet, max 20 creations, each holding title, world, goal
  set, per-language draft code, and updated time. Creations made
  logged-out live device-only under the same caps and merge on
  login, newest update wins per creation. Delete and rename are
  allowed. There is no public gallery in v1.

### Arena (Q7, Q14, Q15, Q16)

- The Cadet defines one tick function: Python
  `def on_tick(ship, radar):`, Java `onTick(ship, radar)` with the
  same meaning. It is called once per tick and returns exactly one
  action string: `move`, `turn_left`, `turn_right`, `ascend`,
  `descend`, `laser`, `harvest`, `shield`, or `wait`. An invalid
  return wastes the tick; it does not stop the run. The tick
  return is the only control in Arena; there are no other Ship
  calls.
- `ship` and `radar` are read-only snapshots. `ship` carries
  `x, y, z, heading, energy, shield, crystals`. `radar` carries
  `drone_distance`, `drone_direction`, `wave`, `drones_left`
  (camelCase field names in Java). Field names mirror World State
  names (ADR-0012).
- Waves: 5 waves. Wave `n` fields `n + 1` drones at patrol speed
  1 cell per `max(1, 4 - n)` ticks. A drone reaching the Ship cell
  ends the run in a loss, unless shield is on, in which case the
  drone is destroyed and the shield drops. Laser destroys a drone
  1 cell ahead at Mission cost. Win is clearing wave 5. The tick
  cap is 200 total, not per wave. Energy refills to 50 each wave.
  The old printed-command Arena contract is deleted.
- Arena requires an Account (auth decision, ticket #35) and has
  no Planet unlock gate. Its record extends ADR-0010: battles
  played, battles won, best wave reached, last language used. No
  Stars, no Hangar effect, and no leaderboard in v1. A logged-out
  Cadet sees a sign-in prompt, not a guest battle.

### Safety limits (Q8)

- Playground and Arena reuse the Mission caps of ADR-0013: 500
  Ship steps, 500 trace events, 3 seconds per run. The builder
  adds: max 40 spawned entities, bounds never above 16×16×6, and
  no spawn on the Ship start cell. A breach stops the run with a
  kid message and no Pass anywhere.

### Builder name table (Q17)

- Python uses `snake_case`, Java `camelCase`, same meaning and
  argument order, mirroring the Ship API parity rule (ADR-0012).
  No builder call returns a value. A duplicate or blocked spawn
  cell is a learner code error naming the line.
- Spawning: `spawn_crystal(x, y, z)`,
  `spawn_asteroid_cracked(x, y, z)`,
  `spawn_asteroid_titanium(x, y, z)`,
  `spawn_switch(x, y, z, link)`, `spawn_gate(x, y, z, link)`
  (the shared string `link` pairs a gate with its switch, per
  ADR-0012), `spawn_portal(x1, y1, z1, x2, y2, z2)`,
  `spawn_drone(x, y, z, axis)` with axis `"x"`, `"y"`, or `"z"`,
  and `spawn_crystal_ring(x, y, z, radius)`, which places 8
  crystals at the compass and diagonal cells around the centre.
- Setup: `set_ship_start(x, y, z, heading)`,
  `set_ship_colour(colour)` (Java `setShipColour`),
  `set_bounds(max_x, max_y, max_z)`.

### Template worlds (Q21)

- Each template teaches one builder idea and one Ship idea. Its
  starter shows the template's builder calls in editable code,
  plus a short Ship program under `YOUR CODE BELOW` (ADR-0011).
  Exact coordinates land in the build-handoff spec; the layouts
  here are fixed.
- Empty World: no entities, log starter. Ring Course: crystal
  ring at radius 3, starter flies the ring. Crystal Harvest: 5
  crystals and 2 cracked asteroids, laser starter. Switch and
  Gate: a switch, its linked gate, and a crystal behind the gate.
  Wormhole Maze: titanium walls, one portal pair, crystal on the
  exit side. Drone Patrol: 1 drone on an x patrol and 3 crystals.

### Arena snapshots and battle flow (Q18, Q22)

- Field access is one shape in both languages: Python
  `ship.x`, `radar.drone_distance`; Java `ship.x`,
  `radar.droneDistance`. The Cadet Java subset must support
  read-only host snapshot fields for Arena; the build owns that
  support and there is no scalar-parameter fallback.
- The Java Arena starter is always full-scaffold (class,
  `onTick` signature, and return line given); Training Wheels
  stages (ADR-0011) do not apply in Arena. The starter `on_tick`
  body returns `wait`, with a radar example in comments.
- Drones spawn at the east edge in spaced rows, heading west.
  Battles play through the Mission cockpit replay model (ticket
  #44), with no Arena-only player. The battle record writes once
  at battle end (win, loss, or cap); an abandoned battle writes
  nothing.

### Share landing (Q19)

- A share link opens `/playground#c=...`. The page shows an
  import preview first (title, goal list, world size, starter
  language) and nothing auto-runs. Start Challenge loads the
  starter code in the editor and saves a copy as a Creation
  under the original title; a name clash adds ` copy`. A
  logged-out Start saves a device-only copy. At the 20-Creation
  cap, Start is blocked with a delete-first message.

### Creation identity (Q20)

- A Creation id is minted at first save: `c_` plus 12 random
  base36 characters. The id never changes on rename. Save Code
  carries Creations too, under the same 20 cap, so logged-out
  device moves keep Creations. The merge key is the id and the
  newest `updatedAt` wins the whole Creation; two Creations
  sharing a title stay separate.

### Error wording

- Builder and run failures use the shared kid-error translator
  (ADR-0012): the kid line names the builder call and the line.
  A failed import shows one Playground banner line, not a run
  error: the link is broken and the Cadet should ask for a fresh
  link. Exact translator wording stays with the translator's
  owning build work; the classes and surfaces here are fixed.

## Consequences

- One builder surface and one battle surface: the spec and the
  build each pay for one of each, and both read the ADR-0012
  World State and the ADR-0013 caps without new machinery.
- Share links need no backend, no moderation queue, and work
  logged-out; the cost is a hard size cap and no revocation.
- ADR-0010 gains two extensions (creations, Arena record); the
  sync merge it locks must cover both before build.
- A stakes-bearing Arena (prizes, public ranking) reopens the
  trust model exactly as in ADR-0013.

## Rejected alternatives

- Drag-drop visual world editor in v1: a separate product surface
  that teaches no Ship API skill and doubles the builder spec.
- New Playground entity types (portal, ring as entities): breaks
  the closed ADR-0012 vocabulary the grader, Seeds, and replay
  already speak; both are sugar over existing entities.
- Server-stored short share codes and a public gallery: adds
  storage, abuse handling, and moderation that v1 stakes do not
  justify.
- Free-form goal expressions or code-text goals: breaks safety,
  Python/Java parity, and the ADR-0013 declarative check shape.
- Printed-command Arena (v1 contract): no per-tick decision, no
  radar, and no wave play; superseded by the tick function.
