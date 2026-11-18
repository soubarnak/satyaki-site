# Planet 1 — Volta content spec

Status: confirmed spec for [Author Planet 1 content spec](https://github.com/soubarnak/satyaki-site/issues/52).
Human review accepted all five open points below on 2026-11-05. This document is the build-ready Planet 1 content spec; the ticket resolution comment carries the decision gist.

Destination input decisions, not reopened here:

- Concept spine: [Decide concept spine for 25 Missions and 5 Planets](https://github.com/soubarnak/satyaki-site/issues/49)
- Planet identities and story arc: [Decide Planet identities and story arc](https://github.com/soubarnak/satyaki-site/issues/50)
- Par formula and tier rules: [Decide Par formula and tier override rules](https://github.com/soubarnak/satyaki-site/issues/51)
- Schema, Ship API, grader: ADR-0011, ADR-0012, ADR-0013 in `docs/adr/`.

## Planet record

| Field | Value |
|---|---|
| `id` | `planet-1` |
| `slug` | `volta` |
| `name` | `Volta` |
| `themeId` | `volta-launchpad` |
| `planetConceptId` | `variable` |
| Mission slugs, in order | `p1-m1`, `p1-m2`, `p1-m3`, `p1-m4`, `p1-m5` |
| Boss Gate title | Volta Gate |
| Restored Ship system | Power core |
| Java Training Wheels | `full-scaffold` on every Mission and on Boss Gate Part B (Planet 1 default, ADR-0011; no per-Mission override) |

## Authoring rules applied to every Mission below

1. **Pass is World State only** (ADR-0013). Code text never gates Star 1. Each reference solution uses the Mission `conceptId` in the editable region (`sequence` excepted on `p1-m1`) and the Planet concept where Star 3 is later replayed.
2. **Seed invariance.** Hidden Seeds relocate only crystals, cracked asteroids, and drone start cells (ADR-0012). Every Pass check below anchors on Ship state, a `switch`, a `gate`, or a titanium asteroid: none of those ever move. Each layout carries one crystal off the reference route as visible Seed variation. No crystal, cracked asteroid, or drone is Pass-critical on Planet 1.
3. **Variables before loops and branches.** Planet 1 has no loop or conditional construct yet. A variable earns its place as named memory: the Cadet assigns or updates it, reads it back with `log()`, and flies the counted route by hand. Scaffold code never calls Ship actions and never reads Cadet variables.
4. **Par** (from the Par decision): `maxSteps = ceil(1.5 × refSteps) + 2`, `maxEnergy = ceil(1.5 × refEnergy) + 2`, shared across languages, practice Seed only. Python and Java references post identical steps and energy on every Mission below, so `refSteps` / `refEnergy` are those shared values. No Par exception and no tier override is used on Planet 1.
5. **Reference solutions** live outside shipped content at `content/references/planet-1/<slug>.py` and `content/references/planet-1/<slug>.java`, plus `volta-gate-part-b.py` / `.java` for the Boss Gate. The build test runs each on every Seed in the pool; each must Pass (Boss Gate Part B: pass its checks, no Stars). The full solution text for each Mission is the reference route listed in its **Reference route** line, written in the Mission `conceptId` as shown in the Rosetta-style snippets in the authoring notes; the Planet spec is the source the builder transcribes from.
6. Story text is second-person narrator voice, at most 280 characters, no Mission Control character, no dialogue. Static is a phenomenon only. Briefing is one sentence. Objectives are Cadet-facing and map to check ids.

## Mission p1-m1 — Wake the Ship

- `conceptId`: `sequence` · `tier`: `intro` (position default, no override) · Seed pool: 2 (`101`, `102`; first is practice)
- **Story (124 chars):** "Dawn lights the Volta launch pad. The Ship sleeps with a dead power core, and Haven Station is silent. Wake the Ship, Cadet."
- **Briefing:** "Fly the Ship east onto the glowing launch pad."
- **Objectives:** 1. Reach the launch pad. → `reach-pad`

### Layout

- Bounds: `maxX 5, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 20`.
- Entities: `crystal-1` (`crystal`, x 1, y 0, z 2). No other entities.

### Starter code

Python:

```python
# Wake the Ship. move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`):

```java
public class Main {
    public static void main(String[] args) {
        // Wake the Ship. move() flies one cell the way the Ship faces.
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `reach-pad` | Reach the launch pad | `ship.x` | `eq` | `3` | `final` | 1 |
| `reach-pad-lane` | Stay in the launch lane | `ship.z` | `eq` | `0` | `final` | 1 |

### Reference route and Par

Reference (both languages): `move(); move(); move()` — 3 steps, 3 energy. Python and Java identical.
`refSteps 3`, `refEnergy 3` → Par `maxSteps 7`, `maxEnergy 7`. No exception.

### Hints

1. Nudge: "The Ship faces east. One `move()` flies one cell east."
2. Stronger: "Count the pad cells east of the Ship. Call `move()` once for each cell."
3. Near-solution: "Call `move()` three times, one after another, then press Run."

### Rosetta Pair (Planet concept: `variable`, revealed after Pass)

Python:

```python
power = 0
power = 3
log(power)
```

Java:

```java
int power = 0;
power = 3;
log(power);
```

Shared note: "A variable is a named box: put a value in, and the name reads it back."

## Mission p1-m2 — Count the Power Cells

- `conceptId`: `arithmetic_expression` · `tier`: `core` (position default, no override) · Seed pool: 3 (`201`, `202`, `203`)
- **Story (132 chars):** "The power core wakes hungry. Five power cells wait down the east lane, Cadet, and the core switch sleeps at the far end of the lane."
- **Briefing:** "Add the two cell stacks, log the total, then fly to the core switch."
- **Objectives:** 1. Fly onto the core switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 7, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# Two stacks wait: 2 cells, then 3 cells. Add them with + and log the total.
# Then fly east onto the switch. move() flies one cell.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the core switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the core switch | `ship.x` | `eq` | `5` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `int total = 2 + 3;`):

```python
total = 2 + 3
log(total)
```

Then `move()` five times onto the switch. Totals: 5 steps, 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "The `+` sign adds two numbers. `log()` shows the answer."
2. Stronger: "Store `2 + 3` in a variable, log it, and count its answer in `move()` calls east."
3. Near-solution: "Set a variable to `2 + 3`, log it, then call `move()` five times."

### Rosetta Pair

Python:

```python
cells = 2 + 3
log(cells)
```

Java:

```java
int cells = 2 + 3;
log(cells);
```

Shared note: "Code works out `2 + 3` first, then the variable holds the answer: 5."

## Mission p1-m3 — Set Launch Power

- `conceptId`: `variable_assignment` · `tier`: `core` (position default, no override) · Seed pool: 3 (`301`, `302`, `303`)
- **Story (130 chars):** "North of the pad, the launch switch waits above the Zorba moon dust. Set the launch power, Cadet, then fly north and switch it on."
- **Briefing:** "Store the launch power in a variable, log it, then fly north to the launch switch."
- **Objectives:** 1. Fly onto the launch switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 2, maxY 0, maxZ 6`. `shipStart`: `x 0, y 0, z 0, heading north, energy 24`.
- Entities: `switch-1` (`switch`, x 0, y 0, z 4, `linkId gate-1`); `gate-1` (`gate`, x 0, y 0, z 5, `linkId gate-1`); `crystal-1` (`crystal`, x 2, y 0, z 1).

### Starter code

Python:

```python
# Launch power is the count 4. Store it in a variable and log it.
# Then fly north onto the switch. move() flies one cell.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the launch switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the launch switch | `ship.z` | `eq` | `4` | `final` | 1 |

### Reference route and Par

Reference core lines: `power = 4` / `int power = 4;`, `log(power)`, then `move()` four times north onto the switch.
Totals: 4 steps, 4 energy in both languages. `refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "A variable assignment stores a value under a name. Name one power and store 4 in it."
2. Stronger: "Assign `4` to a variable, log the variable, and count its value in `move()` calls north."
3. Near-solution: "Name a variable power, store 4 in it, log it, then call `move()` four times."

### Rosetta Pair

Python:

```python
power = 4
log(power)
```

Java:

```java
int power = 4;
log(power);
```

Shared note: "Assignment puts one value in the box. Java names the box kind: `int` for a counting number."

## Mission p1-m4 — Charge the Core

- `conceptId`: `variable_update` · `tier`: `core` (position default, no override) · Seed pool: 3 (`401`, `402`, `403`)
- **Story (130 chars):** "Two charge pads glow along the east lane, dimmed by Static. Charge the core at both pads, Cadet, then raise the shield to hold it."
- **Briefing:** "Grow a charge counter at each pad, then raise the shield at the far pad."
- **Objectives:** 1. Reach the far charge pad. → `reach-far-pad` 2. Raise the shield. → `shield-up`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `crystal-1` (`crystal`, x 3, y 0, z 2). Charge pads are plain cells: near pad x 2, far pad x 4, both y 0, z 0. No switch or gate on this Mission.

### Starter code

Python:

```python
# Start a charge counter at 0. At each pad, add 1 to it and log it.
# Pads wait 2 cells and 4 cells east. shield() raises the shield.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `reach-far-pad` | Reach the far charge pad | `ship.x` | `eq` | `4` | `final` | 1 |
| `shield-up` | Raise the shield | `ship.shield` | `eq` | `true` | `final` | 2 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors):

```python
charge = 0
move()
move()
charge = charge + 1
log(charge)
move()
move()
charge = charge + 1
log(charge)
shield()
```

Totals: 5 steps (4 `move()`, 1 `shield()`), 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "Updating a variable reads its old value: `charge = charge + 1` grows it by one."
2. Stronger: "Fly 2 cells, grow the counter, fly 2 more, grow it again, then call `shield()`."
3. Near-solution: "Start `charge` at 0. After each pair of `move()` calls, set `charge = charge + 1` and log it. End with `shield()`."

### Rosetta Pair

Python:

```python
charge = 0
charge = charge + 1
charge = charge + 1
log(charge)
```

Java:

```java
int charge = 0;
charge = charge + 1;
charge = charge + 1;
log(charge);
```

Shared note: "An update reads the old value, works out a new one, and stores it under the same name."

## Mission p1-m5 — Zorba Moon Launch

- `conceptId`: `sensor_variable` · `tier`: `stretch` (position default, no override) · Seed pool: 4 (`501`, `502`, `503`, `504`)
- **Story (131 chars):** "Zorba moon sensors blink above the pad. Read them, Cadet, set the launch power from what they say, and fly through the launch gate."
- **Briefing:** "Store a sensor reading in a variable, log it, then fly through the launch gate."
- **Objectives:** 1. Open the launch gate. → `gate-open` 2. Fly through the launch gate. → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 3, y 0, z 2).
- Design note: the titanium asteroid, switch, and gate never move on hidden Seeds, so `distance_ahead()` and the six-cell route read the same on every Seed.

### Starter code

Python:

```python
# Sensors are free questions. distance_ahead() counts clear cells ahead.
# Store its answer in a variable and log it. Then fly east: switch, gate, stop.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, `distanceAhead()` spelling, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `gate-open` | Open the launch gate | `entities.gate-1.open` | `eq` | `true` | `final` | 1 |
| `through-gate` | Fly through the launch gate | `ship.x` | `eq` | `6` | `final` | 2 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `distanceAhead()` / `energy()`):

```python
ahead = distance_ahead()
power = energy()
log(ahead)
log(power)
```

Then `move()` six times: five onto the switch (gate opens), one through the gate onto its cell, stopping before the titanium asteroid.
Totals: 6 steps, 6 energy in both languages. `refSteps 6`, `refEnergy 6` → Par `maxSteps 11`, `maxEnergy 11`. No exception.

### Hints

1. Nudge: "A sensor answer is a value. Catch the cells-ahead count in a variable."
2. Stronger: "Store the cells-ahead count and log it. The switch sits 5 cells east; the gate is 1 cell past it."
3. Near-solution: "Store the sensor reading, log it, then call `move()` six times and stop before the grey asteroid."

### Rosetta Pair

Python:

```python
ahead = distance_ahead()
log(ahead)
```

Java:

```java
int ahead = distanceAhead();
log(ahead);
```

Shared note: "A sensor reading is just a value, so a variable can hold it and `log()` can show it."

## Boss Gate — Volta Gate

Boss Gate record: title `Volta Gate`, no `tier`, no Par, no Star 3 concept, no Rosetta Pair (ADR-0011). Part A must pass 4 of 5 before Part B unlocks; unlimited retries, no cooldown (ADR-0013).

### Part A — five quiz items, fixed order

1. `choice` — Prompt: "What does a variable do?" Options: A "It holds a value under a name" (correct), B "It flies the Ship", C "It deletes a value", D "It blocks an asteroid". Explanation: "A variable stores one value so later code can read it by name."
2. `spot-bug` — Prompt: "This code should store launch power. Tap the bug." Code shown: text for launch power written with only an opening quote, as `"4`, then `log(power)`. Options: A "The value is missing its closing quote" (correct), B "`log` needs brackets", C "`power` needs a capital letter". Explanation: "Text values need both quotes; a counting number needs none."
3. `predict-state` — Prompt: "The Ship starts at x 0 facing east. Code: `move()` then `move()`. Where is the Ship?" Options: A "x 2" (correct), B "x 1", C "x 0", D "z 2". Explanation: "Each `move()` flies one cell east, so two moves reach x 2."
4. `choice` — Prompt: "`charge = charge + 1` does what?" Options: A "Reads charge, adds 1, stores it back" (correct), B "Compares charge to 1", C "Erases charge", D "Flies 1 cell". Explanation: "An update reads the old value, works out a new one, and stores it."
5. `predict-state` — Prompt: "Power starts at 2. Then the code runs `power = power + 3`, then `log(power)`. What shows?" Options: A "5" (correct), B "2", C "3", D "23". Explanation: "The update replaces 2 with 2 + 3, so the log shows 5."

Authoring note: `choice` and `predict-state` items carry 3–4 options, correct index as marked, one-line explanation each, per ADR-0011. Item 2's bugged code is display text only; it is never starter code and never runs.

### Part B — Launch the Ship

One coding challenge reusing Mission fields (ADR-0011): layout, Pass checks, both starter codes, three hints, Seed pool. Seed pool: 3 (`601`, `602`, `603`), Boss Gate Part B count per ADR-0013. No Par, no Stars.

- **Briefing:** "Set launch power from the Ship's energy, fly east through the launch gate, and raise the shield."
- **Objectives:** 1. Open the launch gate. → `gate-open` 2. Fly through the launch gate. → `through-gate` 3. Raise the shield. → `shield-up`

Layout:

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

Starter code: same shape as `p1-m5` starters, with the briefing line as the lead comment and one added line: "Then end with shield()." Java `full-scaffold`.

Pass checks:

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `gate-open` | Open the launch gate | `entities.gate-1.open` | `eq` | `true` | `final` | 1 |
| `through-gate` | Fly through the launch gate | `ship.x` | `eq` | `6` | `final` | 2 |
| `shield-up` | Raise the shield | `ship.shield` | `eq` | `true` | `final` | 3 |

Reference route (both languages; concept use is review only here, Part B awards no Stars): store `energy()` in `power`, log it, `move()` six times through the gate, then `shield()`. Totals: 7 steps, 7 energy. No Par applies.

Hints:

1. Nudge: "`energy()` tells how much energy the Ship holds. A variable can keep its answer."
2. Stronger: "Store `energy()`, log it, fly 5 cells to the switch and 1 more through the gate."
3. Near-solution: "Store and log the energy reading, call `move()` six times, then call `shield()`."

## Summary tables for the builder

### Tiers, Seeds, Par

| Mission | `conceptId` | `tier` | Seeds | ref steps / energy (Py = Java) | Par `maxSteps` / `maxEnergy` | Override / exception |
|---|---|---|---|---|---|---|
| `p1-m1` | `sequence` | `intro` | 2 | 3 / 3 | 7 / 7 | none |
| `p1-m2` | `arithmetic_expression` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p1-m3` | `variable_assignment` | `core` | 3 | 4 / 4 | 8 / 8 | none |
| `p1-m4` | `variable_update` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p1-m5` | `sensor_variable` | `stretch` | 4 | 6 / 6 | 11 / 11 | none |
| Volta Gate Part B | — | — | 3 | 7 / 7 | — | no Par by design |

Par check, per the Par decision: `ceil(1.5 × 3) + 2 = 7`; `ceil(1.5 × 5) + 2 = 10`; `ceil(1.5 × 4) + 2 = 8`; `ceil(1.5 × 6) + 2 = 11`. The later build test reruns both reference solutions on the practice Seed, recomputes this formula, and fails on any mismatch with the table.

### Check-label rule check

Every check label reads without coordinates, per ADR-0013 feedback rules: labels name the goal ("Reach the launch pad"), never a cell. Hidden-Seed failures surface only these labels plus the fixed anti-hardcoding line.

## Confirmed authoring choices

Accepted at human review, 2026-11-05:

1. Variable pattern: variables as named memory read by `log()`, route flown by hand. Scaffold code never consumes a Cadet variable to move the Ship.
2. Seed invariance: Pass checks anchored only on non-moving world features; crystals decorative on Planet 1.
3. No tier override and no Par exception on Planet 1; both quotas stay untouched for later Planets.
4. Reference solutions at `content/references/planet-1/`, named `<slug>.py` / `<slug>.java` plus `volta-gate-part-b.py` / `.java`.
5. Mission titles and story text as written above, within the story rules from the Planet identities decision.
