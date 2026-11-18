# Planet 3 — Lumina content spec

Status: confirmed spec for [Author Planet 3 content spec](https://github.com/soubarnak/satyaki-site/issues/54).
Human review accepted all nine authoring choices below on 2026-11-05. This document is the build-ready Planet 3 content spec; the ticket resolution comment carries the decision gist.

Destination input decisions, not reopened here:

- Concept spine: [Decide concept spine for 25 Missions and 5 Planets](https://github.com/soubarnak/satyaki-site/issues/49)
- Planet identities and story arc: [Decide Planet identities and story arc](https://github.com/soubarnak/satyaki-site/issues/50)
- Par formula and tier rules: [Decide Par formula and tier override rules](https://github.com/soubarnak/satyaki-site/issues/51)
- Schema, Ship API, grader: ADR-0011, ADR-0012, ADR-0013 in `docs/adr/`.

## Planet record

| Field | Value |
|---|---|
| `id` | `planet-3` |
| `slug` | `lumina` |
| `name` | `Lumina` |
| `themeId` | `lumina-lightgrid` |
| `planetConceptId` | `loop` |
| Mission slugs, in order | `p3-m1`, `p3-m2`, `p3-m3`, `p3-m4`, `p3-m5` |
| Boss Gate title | Lumina Gate |
| Restored Ship system | Beacon cycles |
| Java Training Wheels | `partial` on every Mission and on Boss Gate Part B (Planets 3–4 default, ADR-0011; no per-Mission override) |

## Authoring rules applied to every Mission below

1. **Pass is World State only** (ADR-0013). Code text never gates Star 1. Each reference solution uses the Mission `conceptId` in the editable region and the Planet concept where Star 3 is later replayed. Star 3 for `loop` is a `for` or `while` construct that executes on the practice Seed (ADR-0013; Java also enhanced `for`, unused here).
2. **Seed invariance.** Hidden Seeds relocate only crystals, cracked asteroids, and drone start cells (ADR-0012). Every Pass check below anchors on Ship state, a `switch`, a `gate`, or a titanium asteroid: none of those ever move. Each layout carries one crystal off the reference route as visible Seed variation; crystals never block, so a relocated crystal cannot block a route. No cracked asteroid and no drone appears on Planet 3, so no relocatable blocker can land on a reference route on a hidden Seed.
3. **Loops drive the Ship.** Unlike Planet 1 variables (named memory read back with `log()`) and Planet 2 conditionals (a branch chooses one Ship action), a Planet 3 loop earns its place by repeating a Ship action: the loop body calls `move()`, `turn_left()` / `turnRight()`, or `shield()`, and the repeat count or exit test is fixed by non-moving world features, so the same loop runs on every Seed. Scaffold code never calls Ship actions and never reads Cadet variables.
4. **One new construct per Mission.** Missions 1–4 teach one construct each (`for_loop`, `loop_counter`, `while_loop`, `nested_loop`); `p3-m5` is the Planet-concept climax (`loop_with_conditional`) and combines a loop with the Planet 2 conditional constructs. No function or list construct appears before its Planet.
5. **Par** (from the Par decision): `maxSteps = ceil(1.5 × refSteps) + 2`, `maxEnergy = ceil(1.5 × refEnergy) + 2`, shared across languages, practice Seed only. Python and Java references post identical steps and energy on every Mission below, so `refSteps` / `refEnergy` are those shared values. No Par exception and no tier override is used on Planet 3.
6. **Reference solutions** live outside shipped content at `content/references/planet-3/<slug>.py` and `content/references/planet-3/<slug>.java`, plus `lumina-gate-part-b.py` / `.java` for the Boss Gate. The build test runs each on every Seed in the pool; each must Pass (Boss Gate Part B: pass its checks, no Stars). The full solution text for each Mission is the reference route listed in its **Reference route** line; the Planet spec is the source the builder transcribes from.
7. Story text is second-person narrator voice, at most 280 characters, no Mission Control character, no dialogue. Static is a phenomenon only. Briefing is one sentence. Objectives are Cadet-facing and map to check ids.

## Mission p3-m1 — Light the First Tower

- `conceptId`: `for_loop` · `tier`: `intro` (position default, no override) · Seed pool: 2 (`3101`, `3102`; first is practice)
- **Story (142 chars):** "Dark beacon towers rise over Lumina's Trina sector, their cycles stilled by Static. The first tower waits down the east lane. Light it, Cadet."
- **Briefing:** "Use a for loop to fly east onto the first beacon switch."
- **Objectives:** 1. Fly onto the beacon switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `switch-1` (`switch`, x 4, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 5, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# A for loop repeats its block a set number of times. range(4) counts 0, 1, 2, 3.
# Loop move() to fly east onto the beacon switch. move() flies one cell.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // A for loop repeats its block a set number of times.
    // Write main below. Inside it, loop move() east onto the switch.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

`partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region. Full reference Java for this Mission is `public class Main` wrapping `main` whose body is `for (int i = 0; i < 4; i++) { move(); }`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the beacon switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the beacon switch | `ship.x` | `eq` | `4` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `for (int i = 0; i < 4; i++) { move(); }`):

```python
for i in range(4):
    move()
```

Totals: 4 steps, 4 energy in both languages.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "A counted loop runs its block 4 times. Put one `move()` inside it."
2. Stronger: "Write a counted loop of 4 and indent `move()` under it. The switch sits 4 cells east."
3. Near-solution: "Loop `move()` four times with a counted `for` loop of 4, then press Run."

### Rosetta Pair (Planet concept: `loop`, revealed after Pass)

Python:

```python
for i in range(3):
    move()
```

Java:

```java
for (int i = 0; i < 3; i++) {
    move();
}
```

Shared note: "A `for` loop runs its block once for each count, then stops on its own."

## Mission p3-m2 — Count the Beacon Steps

- `conceptId`: `loop_counter` · `tier`: `core` (position default, no override) · Seed pool: 3 (`3201`, `3202`, `3203`)
- **Story (127 chars):** "The second beacon tower counts its own lighting steps, one glow for each cell crossed. Count each step aloud as you fly, Cadet."
- **Briefing:** "Fly east to the beacon switch with a for loop, logging the loop counter on every step."
- **Objectives:** 1. Fly onto the beacon switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 7, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 3, y 0, z 2).

### Starter code

Python:

```python
# The loop counter is the count the loop is on: range(5) gives 0, 1, 2, 3, 4.
# Loop move() east, and log the counter each time so the tower can count with you.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`): same comments with `//`, class wrapper given and Cadet-written `main` inside the markers. Full reference Java body is `for (int step = 0; step < 5; step++) { move(); log(step); }`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the beacon switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the beacon switch | `ship.x` | `eq` | `5` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors as above; `log()` is free and is not a step, ADR-0012):

```python
for step in range(5):
    move()
    log(step)
```

Totals: 5 steps, 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "The counter changes each run through the loop: first 0, then 1, then 2."
2. Stronger: "Name the counter `step`. Inside the loop, call `move()` then `log(step)`."
3. Near-solution: "Loop a count of 5. In the block, call `move()` and log the counter, five steps in all."

### Rosetta Pair

Python:

```python
for step in range(3):
    log(step)
    move()
```

Java:

```java
for (int step = 0; step < 3; step++) {
    log(step);
    move();
}
```

Shared note: "The counter is a value the loop hands you each round: read it like any variable."

## Mission p3-m3 — Fly Until the Dark Tower

- `conceptId`: `while_loop` · `tier`: `core` (position default, no override) · Seed pool: 3 (`3301`, `3302`, `3303`)
- **Story (127 chars):** "No count marks the way to the third tower, only the grey dead tower looming past its switch. Fly until the way runs out, Cadet."
- **Briefing:** "Use a while loop on what the Ship senses to fly east onto the beacon switch."
- **Objectives:** 1. Fly onto the beacon switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 7, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 5, y 0, z 2, `linkId gate-1`); `crystal-1` (`crystal`, x 2, y 0, z 2).
- Design note: the titanium asteroid sits one cell past the switch and never moves, so `distance_ahead()` reads 5 at the start and 0 on the switch, on every Seed. The gate stands off the route at z 2 as the switch's visual pair; entering its cell is never required.

### Starter code

Python:

```python
# A while loop repeats while its answer stays True. distance_ahead() counts clear cells.
# While clear cells remain ahead, move(). The grey tower ahead ends the count at 0.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`): same comments with `//` and `distanceAhead()` spelling, class wrapper given and Cadet-written `main` inside the markers. Full reference Java body is `while (distanceAhead() > 0) { move(); }`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the beacon switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the beacon switch | `ship.x` | `eq` | `5` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors as above):

```python
while distance_ahead() > 0:
    move()
```

The loop moves five times and stops on the switch, one cell before the titanium asteroid. Totals: 5 steps, 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "`while` asks its question before every round. When the answer turns no, the loop stops."
2. Stronger: "Test whether any clear cells are ahead. Call `move()` inside the loop, and let the grey tower end it."
3. Near-solution: "Write a `while` loop that moves while clear cells are ahead, then press Run."

### Rosetta Pair

Python:

```python
while distance_ahead() > 0:
    move()
```

Java:

```java
while (distanceAhead() > 0) {
    move();
}
```

Shared note: "A `while` loop has no set count: its sensor answer decides when to stop."

## Mission p3-m4 — Relight the Beacon Rows

- `conceptId`: `nested_loop` · `tier`: `core` (position default, no override) · Seed pool: 3 (`3401`, `3402`, `3403`)
- **Story (139 chars):** "Two beacon rows climb the Trina ridge, two lights to a row, each row turning a corner. Trace both rows with one loop inside another, Cadet."
- **Briefing:** "Use a loop inside a loop to climb both beacon rows onto the ridge switch."
- **Objectives:** 1. Fly onto the ridge switch. → `hit-switch`, `reach-switch-x`, `reach-switch-z`

### Layout

- Bounds: `maxX 4, maxY 0, maxZ 4`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `switch-1` (`switch`, x 2, y 0, z 2, `linkId gate-1`); `gate-1` (`gate`, x 2, y 0, z 3, `linkId gate-1`); `crystal-1` (`crystal`, x 4, y 0, z 4).
- Design note: the reference route is a two-step staircase: east two cells, turn north, north two cells onto the switch. The switch, gate, and bounds never move, so the route reads the same on every Seed.

### Starter code

Python:

```python
# A loop inside a loop runs its whole inner count for each outer count.
# Each row here is 2 moves, then one turn left. Two rows climb to the switch.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`): same comments with `//` and `turnLeft()` spelling, class wrapper given and Cadet-written `main` inside the markers. Full reference Java body is `for (int row = 0; row < 2; row++) { for (int cell = 0; cell < 2; cell++) { move(); } turnLeft(); }`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the ridge switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch-x` | Reach the ridge switch row | `ship.x` | `eq` | `2` | `final` | 1 |
| `reach-switch-z` | Reach the ridge switch | `ship.z` | `eq` | `2` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors as above):

```python
for row in range(2):
    for cell in range(2):
        move()
    turn_left()
```

Trace: outer round 1 flies east to x 2 and turns north; outer round 2 flies north to z 2, onto the switch, and turns west. Totals: 6 steps (4 `move()`, 2 `turn_left()`), 6 energy in both languages.
`refSteps 6`, `refEnergy 6` → Par `maxSteps 11`, `maxEnergy 11`. No exception.

### Hints

1. Nudge: "The inner loop finishes all its rounds before the outer loop counts again."
2. Stronger: "Inner loop: `move()` twice. After it, one turn left. Wrap both in an outer loop of 2."
3. Near-solution: "Loop `row` for a count of 2; inside it, loop `cell` for a count of 2 with `move()`, then turn left."

### Rosetta Pair

Python:

```python
for row in range(2):
    for cell in range(2):
        move()
    turn_left()
```

Java:

```java
for (int row = 0; row < 2; row++) {
    for (int cell = 0; cell < 2; cell++) {
        move();
    }
    turnLeft();
}
```

Shared note: "Loops nest like boxes in boxes: the inner loop empties before the outer loop moves on."

## Mission p3-m5 — Relight the Beacon Grid

- `conceptId`: `loop_with_conditional` · `tier`: `stretch` (position default, no override) · Seed pool: 4 (`3501`, `3502`, `3503`, `3504`)
- **Story (144 chars):** "The full Trina beacon grid waits past two grey dead towers, and beacon cycles flicker back to life beyond the gate. Skip the dead towers, Cadet."
- **Briefing:** "Loop along the beacon lane, turning off the blocked lane inside the loop, then fly through the beacon gate."
- **Objectives:** 1. Raise the shield. → `shield-up` 2. Open the beacon gate. → `gate-open` 3. Fly through the beacon gate. → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading north, energy 30`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 0, y 0, z 1); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-2` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 3, y 0, z 2).
- Design note: the two titanium asteroids are the dead towers: one blocks the north lane at the start, one caps the lane past the gate. Titanium asteroids, switch, and gate never move, so the in-loop decision reads the same on every Seed.

### Starter code

Python:

```python
# A loop can hold a decision. Each round, ask if the way ahead is blocked.
# First raise the shield if it is down. Then loop: turn east if blocked, else move.
# Fly east: switch, gate, stop.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`): same comments with `//`, `isShieldOn()` / `distanceAhead()` / `turnRight()` spellings and `&&`, class wrapper given and Cadet-written `main` inside the markers.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `shield-up` | Raise the shield | `ship.shield` | `eq` | `true` | `final` | 1 |
| `gate-open` | Open the beacon gate | `entities.gate-1.open` | `eq` | `true` | `final` | 2 |
| `through-gate` | Fly through the beacon gate | `ship.x` | `eq` | `6` | `final` | 3 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `if (isShieldOn() == false && energy() > 10) { shield(); }` then `for (int cell = 0; cell < 7; cell++) { if (distanceAhead() == 0) { turnRight(); } else { move(); } }`):

```python
if is_shield_on() == False and energy() > 10:
    shield()
for cell in range(7):
    if distance_ahead() == 0:
        turn_right()
    else:
        move()
```

Trace: `shield()` raises the shield; loop round 1 faces the dead tower north (`distance_ahead()` is 0) and turns east; rounds 2–6 fly east onto the switch, opening the gate; round 7 flies through the gate onto its cell, stopping before the second dead tower. Totals: 8 steps (1 `shield()`, 1 `turn_right()`, 6 `move()`), 8 energy in both languages.
`refSteps 8`, `refEnergy 8` → Par `maxSteps 14`, `maxEnergy 14`. No exception.

### Hints

1. Nudge: "The `if` lives inside the loop, so its question is asked again on every round."
2. Stronger: "Shield first, while it is down and energy is high. In the loop, turn right when the count ahead is 0, else move."
3. Near-solution: "Raise the shield in its `if`. Loop 7 rounds: if blocked, turn right; else `move()`. Stop past the gate."

### Rosetta Pair

Python:

```python
for cell in range(4):
    if distance_ahead() == 0:
        turn_right()
    else:
        move()
```

Java:

```java
for (int cell = 0; cell < 4; cell++) {
    if (distanceAhead() == 0) {
        turnRight();
    } else {
        move();
    }
}
```

Shared note: "A decision inside a loop is asked fresh each round, so one loop can steer, not just repeat."

## Boss Gate — Lumina Gate

Boss Gate record: title `Lumina Gate`, no `tier`, no Par, no Star 3 concept, no Rosetta Pair (ADR-0011). Part A must pass 4 of 5 before Part B unlocks; unlimited retries, no cooldown (ADR-0013).

### Part A — five quiz items, fixed order

1. `choice` — Prompt: "What does a `for` loop do?" Options: A "Repeats its block a set number of times" (correct), B "Asks one yes-no question once", C "Stores a value under a name", D "Flies the Ship once". Explanation: "A `for` loop runs its block once for each count, then stops."
2. `spot-bug` — Prompt: "This code should fly east until the way runs out. Tap the bug." Code shown: `while` the cells ahead are more than 0, then `log` of that count on the next line, under the `while`. Options: A "The block logs instead of moving, so the loop never ends" (correct), B "Calling `log()` ends the loop", C "The cells-ahead check needs a number passed into it". Explanation: "The guarded block must call `move()`; logging changes nothing, so the answer never turns no."
3. `predict-state` — Prompt: "The Ship starts at x 0 facing east. Code: a counted `for` loop of 3 that calls `move()` each round. Where is the Ship?" Options: A "x 3" (correct), B "x 2", C "x 0", D "z 3". Explanation: "The loop runs `move()` three times, so the Ship flies three cells east."
4. `choice` — Prompt: "In a loop inside a loop over 2 rows and 3 cells, how many times does the inner block run?" Options: A "6 times" (correct), B "5 times", C "3 times", D "2 times". Explanation: "The inner loop runs all 3 of its rounds for each of the 2 outer rounds: 2 × 3 = 6."
5. `predict-state` — Prompt: "The Ship faces north with a grey tower one cell ahead, so the cells ahead are 0. Code: a counted `for` loop of 2. Each round, `if` the cells ahead are 0, turn right, and no other Ship call. Which way does the Ship end facing?" Options: A "East" (correct), B "North", C "West", D "South". Explanation: "Round 1 turns the Ship east; facing east the tower is no longer ahead, so round 2 does not turn."

Authoring note: `choice` and `predict-state` items carry 3–4 options, correct index as marked, one-line explanation each, per ADR-0011. Item 2's bugged code is display text only; it is never starter code and never runs.

### Part B — Relight the Beacon Row

One coding challenge reusing Mission fields (ADR-0011): layout, Pass checks, both starter codes, three hints, Seed pool. Seed pool: 3 (`3601`, `3602`, `3603`), Boss Gate Part B count per ADR-0013. No Par, no Stars.

- **Briefing:** "Loop east through the beacon gate, turning off the blocked lane inside the loop."
- **Objectives:** 1. Open the beacon gate. → `gate-open` 2. Fly through the beacon gate. → `through-gate`

Layout:

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading north, energy 30`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 0, y 0, z 1); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-2` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

Starter code: same shape as `p3-m5` starters, with the briefing line as the lead comment and no shield instruction. Java `partial`.

Pass checks:

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `gate-open` | Open the beacon gate | `entities.gate-1.open` | `eq` | `true` | `final` | 1 |
| `through-gate` | Fly through the beacon gate | `ship.x` | `eq` | `6` | `final` | 2 |

Reference route (both languages; concept use is review only here, Part B awards no Stars): `for cell in range(7): if distance_ahead() == 0: turn_right() else: move()` — round 1 turns east off the blocked north lane, rounds 2–6 fly east onto the switch, round 7 flies through the gate. Totals: 7 steps (1 `turn_right()`, 6 `move()`), 7 energy. No Par applies.

Hints:

1. Nudge: "One loop does the whole row: it asks about the way ahead on every round."
2. Stronger: "Inside a loop of 7, turn right when the count ahead is 0. Otherwise move east."
3. Near-solution: "Loop 7 rounds: if the cells ahead are 0, turn right; else `move()`. Stop past the gate."

## Summary tables for the builder

### Tiers, Seeds, Par

| Mission | `conceptId` | `tier` | Seeds | ref steps / energy (Py = Java) | Par `maxSteps` / `maxEnergy` | Override / exception |
|---|---|---|---|---|---|---|
| `p3-m1` | `for_loop` | `intro` | 2 | 4 / 4 | 8 / 8 | none |
| `p3-m2` | `loop_counter` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p3-m3` | `while_loop` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p3-m4` | `nested_loop` | `core` | 3 | 6 / 6 | 11 / 11 | none |
| `p3-m5` | `loop_with_conditional` | `stretch` | 4 | 8 / 8 | 14 / 14 | none |
| Lumina Gate Part B | — | — | 3 | 7 / 7 | — | no Par by design |

Par check, per the Par decision: `ceil(1.5 × 4) + 2 = 8`; `ceil(1.5 × 5) + 2 = 10`; `ceil(1.5 × 6) + 2 = 11`; `ceil(1.5 × 8) + 2 = 14`. The later build test reruns both reference solutions on the practice Seed, recomputes this formula, and fails on any mismatch with the table.

### Check-label rule check

Every check label reads without coordinates, per ADR-0013 feedback rules: labels name the goal ("Fly through the beacon gate"), never a cell. Hidden-Seed failures surface only these labels plus the fixed anti-hardcoding line.

## Confirmed authoring choices

Accepted at human review, 2026-11-05:

1. Training Wheels `partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region. This reading governs Planet 3 Java starters and the marker-exactly-once build check (ADR-0011).
2. Loop pattern: loops drive the Ship directly; the loop body calls Ship actions, and the repeat count or exit test is fixed by non-moving world features.
3. Seed invariance: Pass checks anchored only on non-moving world features; one decorative crystal per layout; no cracked asteroid and no drone on Planet 3.
4. No tier override and no Par exception on Planet 3; both quotas stay untouched for later Planets.
5. Reference solutions at `content/references/planet-3/`, named `<slug>.py` / `<slug>.java` plus `lumina-gate-part-b.py` / `.java`.
6. Mission titles and story text as written above, and Seed pools `3101`–`3603`, Planet-prefixed.
7. `p3-m5` and Lumina Gate Part B reuse the Planet 2 climax lane shape, so the only new load at the climax is the loop carrying the decision. Part B is the same lane without the shield step.
8. Boss Gate Part A item 5 stands as written: the loop does not turn twice, because after round 1 the tower is no longer ahead.
9. `p3-m4` staircase route stands: the nested reference ends with a second `turn_left()` on the switch, with no Pass check on heading.

**Verification note:** the Ship sim is not built yet, so reference steps/energy and Par were counted by hand from the authored routes in this document. The later build test recomputes Par from live reference runs and fails on mismatch, per the Par decision.
