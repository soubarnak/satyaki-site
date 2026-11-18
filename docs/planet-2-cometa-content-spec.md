# Planet 2 — Cometa content spec

Status: confirmed spec for [Author Planet 2 content spec](https://github.com/soubarnak/satyaki-site/issues/53).
Human review accepted all six open points below on 2026-11-05. This document is the build-ready Planet 2 content spec; the ticket resolution comment carries the decision gist.

Destination input decisions, not reopened here:

- Concept spine: [Decide concept spine for 25 Missions and 5 Planets](https://github.com/soubarnak/satyaki-site/issues/49)
- Planet identities and story arc: [Decide Planet identities and story arc](https://github.com/soubarnak/satyaki-site/issues/50)
- Par formula and tier rules: [Decide Par formula and tier override rules](https://github.com/soubarnak/satyaki-site/issues/51)
- Schema, Ship API, grader: ADR-0011, ADR-0012, ADR-0013 in `docs/adr/`.

## Planet record

| Field | Value |
|---|---|
| `id` | `planet-2` |
| `slug` | `cometa` |
| `name` | `Cometa` |
| `themeId` | `cometa-stormgate` |
| `planetConceptId` | `conditional` |
| Mission slugs, in order | `p2-m1`, `p2-m2`, `p2-m3`, `p2-m4`, `p2-m5` |
| Boss Gate title | Cometa Gate |
| Restored Ship system | Shield routing |
| Java Training Wheels | `full-scaffold` on every Mission and on Boss Gate Part B (Planets 1–2 default, ADR-0011; no per-Mission override) |

## Authoring rules applied to every Mission below

1. **Pass is World State only** (ADR-0013). Code text never gates Star 1. Each reference solution uses the Mission `conceptId` in the editable region and the Planet concept where Star 3 is later replayed. Star 3 for `conditional` is an `if` construct that executes on the practice Seed (ADR-0013; Java also `switch` / ternary, unused here).
2. **Seed invariance.** Hidden Seeds relocate only crystals, cracked asteroids, and drone start cells (ADR-0012). Every Pass check below anchors on Ship state, a `switch`, a `gate`, or a titanium asteroid: none of those ever move. Each layout carries one crystal off the reference route as visible Seed variation; crystals never block, so a relocated crystal cannot block a route. No cracked asteroid and no drone appears on Planet 2, so no relocatable blocker can land on a reference route on a hidden Seed.
3. **Conditionals steer the Ship.** Unlike Planet 1 variables, a Planet 2 conditional earns its place by choosing a Ship action: raise the shield, turn off a blocked lane, or pick a lane. The branch condition reads a sensor (`distance_ahead()`, `energy()`, `is_shield_on()`) whose practice-Seed value is fixed by non-moving world features, so the same branch runs on every Seed. Scaffold code never calls Ship actions and never reads Cadet variables.
4. **One new construct per Mission.** Missions 1–4 teach one construct each (`comparison`, `if_statement`, `if_else`, `else_if_chain`); `p2-m5` is the Planet-concept climax (`boolean_decision`) and combines the earlier constructs with `and` / `or` / `not`. No loop or function construct appears before its Planet.
5. **Par** (from the Par decision): `maxSteps = ceil(1.5 × refSteps) + 2`, `maxEnergy = ceil(1.5 × refEnergy) + 2`, shared across languages, practice Seed only. Python and Java references post identical steps and energy on every Mission below, so `refSteps` / `refEnergy` are those shared values. No Par exception and no tier override is used on Planet 2.
6. **Reference solutions** live outside shipped content at `content/references/planet-2/<slug>.py` and `content/references/planet-2/<slug>.java`, plus `cometa-gate-part-b.py` / `.java` for the Boss Gate. The build test runs each on every Seed in the pool; each must Pass (Boss Gate Part B: pass its checks, no Stars). The full solution text for each Mission is the reference route listed in its **Reference route** line; the Planet spec is the source the builder transcribes from.
7. Story text is second-person narrator voice, at most 280 characters, no Mission Control character, no dialogue. Static is a phenomenon only. Briefing is one sentence. Objectives are Cadet-facing and map to check ids.

## Mission p2-m1 — Reach the Storm Gate

- `conceptId`: `comparison` · `tier`: `intro` (position default, no override) · Seed pool: 2 (`2101`, `2102`; first is practice)
- **Story (137 chars):** "Ice storms lash Cometa, and the shield gate ahead hangs dark and still. The Ship rolls in with shields down. Reach the storm gate, Cadet."
- **Briefing:** "Compare what the Ship senses, log the answer, then fly east to the storm switch."
- **Objectives:** 1. Fly onto the storm switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 7, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# A comparison asks a yes-no question, like distance_ahead() > 3.
# Store its True or False answer, log it, then fly east. move() flies one cell.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`):

```java
public class Main {
    public static void main(String[] args) {
        // A comparison asks a yes-no question, like distanceAhead() > 3.
        // Store its true or false answer, log it, then fly east. move() flies one cell.
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the storm switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the storm switch | `ship.x` | `eq` | `5` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `boolean clear = distanceAhead() > 3;`):

```python
clear = distance_ahead() > 3
log(clear)
```

Then `move()` five times onto the switch. Totals: 5 steps, 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "`>` asks if the left side is bigger. The answer is yes or no."
2. Stronger: "Store a check that the cells ahead are more than 3, log it, then count `move()` calls east to the switch."
3. Near-solution: "Set `clear` to that check, log `clear`, then call `move()` five times."

### Rosetta Pair (Planet concept: `conditional`, revealed after Pass)

Python:

```python
if distance_ahead() > 3:
    log("clear")
```

Java:

```java
if (distanceAhead() > 3) {
    log("clear");
}
```

Shared note: "A comparison answers yes or no, and `if` runs its block only when the answer is yes."

## Mission p2-m2 — Shields Up at the Gate

- `conceptId`: `if_statement` · `tier`: `core` (position default, no override) · Seed pool: 3 (`2201`, `2202`, `2203`)
- **Story (135 chars):** "Storm ice rattles the hull at the Cometa storm gate, and the shield routing still sleeps. Raise the shield before the gate lane, Cadet."
- **Briefing:** "If the shield is down, raise it, then fly east through the storm gate lane to the switch."
- **Objectives:** 1. Raise the shield. → `shield-up` 2. Fly onto the storm switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 7, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 24`.
- Entities: `switch-1` (`switch`, x 4, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 5, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# if runs its block only when the answer is True. is_shield_on() asks about the shield.
# If the shield is down, call shield(). Then fly east onto the switch.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, `isShieldOn()` spelling, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `shield-up` | Raise the shield | `ship.shield` | `eq` | `true` | `final` | 1 |
| `hit-switch` | Switch the storm switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 2 |
| `reach-switch` | Reach the storm switch | `ship.x` | `eq` | `4` | `final` | 2 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `if (isShieldOn() == false) { shield(); }`):

```python
if is_shield_on() == False:
    shield()
```

Then `move()` four times onto the switch. Totals: 5 steps (1 `shield()`, 4 `move()`), 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "`if` runs the block under it only when its check says yes. Use it while the shield is down."
2. Stronger: "Inside the `if` block, call `shield()` once. Then fly 4 cells east onto the switch."
3. Near-solution: "Write the `if` check, call `shield()` inside it, then call `move()` four times."

### Rosetta Pair

Python:

```python
if is_shield_on() == False:
    shield()
```

Java:

```java
if (isShieldOn() == false) {
    shield();
}
```

Shared note: "An `if` block runs only when its check says yes."

## Mission p2-m3 — Pick the Clear Lane

- `conceptId`: `if_else` · `tier`: `core` (position default, no override) · Seed pool: 3 (`2301`, `2302`, `2303`)
- **Story (134 chars):** "A grey ice spire blocks the north lane over Cometa, but the east lane runs clear toward the beacon switch. Pick the clear lane, Cadet."
- **Briefing:** "If the way north is blocked, turn east instead, then fly to the beacon switch."
- **Objectives:** 1. Fly onto the beacon switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 2`. `shipStart`: `x 1, y 0, z 0, heading north, energy 24`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 1, y 0, z 1); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 3, y 0, z 2).
- Design note: the titanium asteroid sits one cell ahead of the Ship start and never moves, so `distance_ahead()` reads 0 on every Seed.

### Starter code

Python:

```python
# distance_ahead() counts clear cells ahead: 0 means blocked. else runs when the if answer is False.
# If the way north is blocked, turn right to face east. Else fly north.
# Then fly east onto the switch.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, `distanceAhead()` spelling, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the beacon switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the beacon switch | `ship.x` | `eq` | `5` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `distanceAhead()` and braces):

```python
if distance_ahead() == 0:
    turn_right()
else:
    move()
```

Then `move()` four times east onto the switch. Totals: 5 steps (1 `turn_right()`, 4 `move()`), 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "`if` picks the first block, `else` picks the other. One of them always runs."
2. Stronger: "Test whether the cells ahead are 0. Turn right in the `if` block, then fly east."
3. Near-solution: "If the cells ahead are 0, turn right; else call `move()`. Then call `move()` four times."

### Rosetta Pair

Python:

```python
if distance_ahead() == 0:
    turn_right()
else:
    move()
```

Java:

```java
if (distanceAhead() == 0) {
    turnRight();
} else {
    move();
}
```

Shared note: "`if` / `else` picks one path. The answer chooses which."

## Mission p2-m4 — Three Ways Through the Storm

- `conceptId`: `else_if_chain` · `tier`: `core` (position default, no override) · Seed pool: 3 (`2401`, `2402`, `2403`)
- **Story (145 chars):** "Three lanes cross the Cometa storm front: one for crystals, one past grey ice, one clear. The grey ice lane is yours today. Read the lane, Cadet."
- **Briefing:** "Read the cell ahead and let an if / else-if / else chain pick the Ship's first action, then fly to the relay switch."
- **Objectives:** 1. Fly onto the relay switch. → `hit-switch`, `reach-switch`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 2`. `shipStart`: `x 1, y 0, z 0, heading north, energy 24`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 1, y 0, z 1); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `crystal-1` (`crystal`, x 3, y 0, z 2).
- Design note: same fixed storm-front shape as `p2-m3`, deliberately: the new work is the three-way chain, not a new route. `distance_ahead()` reads 0 on every Seed, so the `elif` branch is the executing branch in both languages.

### Starter code

Python:

```python
# elif means else-if: the chain tests each answer in order and runs the first True block.
# The count ahead could be far, blocked, or short. Turn right when it is blocked.
# Then fly east onto the switch.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, `distanceAhead()` spelling and `else if`, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `hit-switch` | Switch the relay switch on | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `reach-switch` | Reach the relay switch | `ship.x` | `eq` | `5` | `final` | 1 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `else if` and `distanceAhead()`):

```python
if distance_ahead() > 3:
    move()
elif distance_ahead() == 0:
    turn_right()
else:
    move()
```

Then `move()` four times east onto the switch. Totals: 5 steps (1 `turn_right()`, 4 `move()`), 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10`. No exception.

### Hints

1. Nudge: "A chain tests in order: first `if`, then each else-if, and `else` only if none matched."
2. Stronger: "Put the far test first, the blocked test second with else-if, and `move()` in `else`. Then fly east."
3. Near-solution: "If the count is over 3, call `move()`; else if it is 0, turn right; else call `move()`. Then call `move()` four times."

### Rosetta Pair

Python:

```python
if distance_ahead() > 3:
    move()
elif distance_ahead() == 0:
    turn_right()
else:
    move()
```

Java:

```java
if (distanceAhead() > 3) {
    move();
} else if (distanceAhead() == 0) {
    turnRight();
} else {
    move();
}
```

Shared note: "An else-if chain tries each check in order. The first yes runs, and the rest are skipped."

## Mission p2-m5 — The Final Safe Lane

- `conceptId`: `boolean_decision` · `tier`: `stretch` (position default, no override) · Seed pool: 4 (`2501`, `2502`, `2503`, `2504`)
- **Story (141 chars):** "The last storm lane twists past grey ice, and shield routing flickers back to life beyond the gate. Pick the safe lane and restore it, Cadet."
- **Briefing:** "Combine two checks to raise the shield, turn onto the safe lane, then fly through the storm gate."
- **Objectives:** 1. Raise the shield. → `shield-up` 2. Open the storm gate. → `gate-open` 3. Fly through the storm gate. → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading north, energy 30`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 0, y 0, z 1); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-2` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 3, y 0, z 2).
- Design note: titanium asteroids, switch, and gate never move, so both boolean decisions read the same on every Seed.

### Starter code

Python:

```python
# and needs both answers True. or needs at least one True. not flips an answer.
# If the shield is down and energy is high, raise it. If the lane ahead is blocked, turn east.
# Then fly east: switch, gate, stop.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`full-scaffold`): same comments with `//`, `isShieldOn()` / `distanceAhead()` spellings and `&&` / `||` / `!`, inside `public class Main` / `main`, markers `// YOUR CODE BELOW` / `// YOUR CODE ABOVE`.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `shield-up` | Raise the shield | `ship.shield` | `eq` | `true` | `final` | 1 |
| `gate-open` | Open the storm gate | `entities.gate-1.open` | `eq` | `true` | `final` | 2 |
| `through-gate` | Fly through the storm gate | `ship.x` | `eq` | `6` | `final` | 3 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `&&`, `||`, `isShieldOn()`, `distanceAhead()`):

```python
if is_shield_on() == False and energy() > 10:
    shield()
if distance_ahead() == 0 or distance_ahead() > 5:
    turn_right()
else:
    move()
```

Then `move()` six times: five onto the switch (gate opens), one through the gate onto its cell, stopping before the second titanium asteroid. Totals: 8 steps (1 `shield()`, 1 `turn_right()`, 6 `move()`), 8 energy in both languages.
`refSteps 8`, `refEnergy 8` → Par `maxSteps 14`, `maxEnergy 14`. No exception.

### Hints

1. Nudge: "You can join two checks so both must be yes. The block runs only then."
2. Stronger: "Raise the shield only when it is down and energy is over 10. Turn east when the count ahead is 0."
3. Near-solution: "Join the shield checks so both must be yes. Join the lane checks so either one is enough. Then call `move()` six times."

### Rosetta Pair

Python:

```python
if is_shield_on() == False and energy() > 10:
    shield()
if distance_ahead() == 0:
    turn_right()
```

Java:

```java
if (isShieldOn() == false && energy() > 10) {
    shield();
}
if (distanceAhead() == 0) {
    turnRight();
}
```

Shared note: "Python `and`, `or`, and `not` match Java `&&`, `||`, and `!`: stricter, looser, and flip."

## Boss Gate — Cometa Gate

Boss Gate record: title `Cometa Gate`, no `tier`, no Par, no Star 3 concept, no Rosetta Pair (ADR-0011). Part A must pass 4 of 5 before Part B unlocks; unlimited retries, no cooldown (ADR-0013).

### Part A — five quiz items, fixed order

1. `choice` — Prompt: "What does a comparison like `energy() > 10` give?" Options: A "Yes or no" (correct), B "A number of cells", C "A Ship action", D "A crystal". Explanation: "A comparison answers a yes-no question."
2. `spot-bug` — Prompt: "This code should raise the shield only when it is down. Tap the bug." Code shown: `if` the shield is down, then `move()` on the next line, under the `if`. Options: A "The block flies instead of raising the shield" (correct), B "`if` needs a number here", C "The shield check needs quotes". Explanation: "The guarded block must call `shield()`; this one calls `move()`."
3. `predict-state` — Prompt: "The Ship faces north with a grey asteroid one cell ahead, so the cells ahead are 0. Code: `if` the cells ahead are 0, turn right, then `move()`. Which way does the Ship end facing?" Options: A "East" (correct), B "North", C "West", D "South". Explanation: "The count is 0, so the block runs and turns the Ship east before it moves."
4. `choice` — Prompt: "In an if / else-if / else chain, how many blocks run?" Options: A "Exactly one: the first yes, or else" (correct), B "Every True one", C "Only the else", D "None". Explanation: "The chain stops at the first yes; later blocks are skipped."
5. `predict-state` — Prompt: "Shield is down and `energy()` is 20. Code: `if` the shield is down and `energy()` is over 10, call `shield()`. Is the shield up at the end?" Options: A "Yes" (correct), B "No", C "Only on hidden layouts". Explanation: "Both checks are yes, so the block raises the shield."

Authoring note: `choice` and `predict-state` items carry 3–4 options, correct index as marked, one-line explanation each, per ADR-0011. Item 2's bugged code is display text only; it is never starter code and never runs.

### Part B — Through the Shield Gate

One coding challenge reusing Mission fields (ADR-0011): layout, Pass checks, both starter codes, three hints, Seed pool. Seed pool: 3 (`2601`, `2602`, `2603`), Boss Gate Part B count per ADR-0013. No Par, no Stars.

- **Briefing:** "Raise the shield if it is down, turn onto the safe lane, then fly east through the storm gate."
- **Objectives:** 1. Raise the shield. → `shield-up` 2. Open the storm gate. → `gate-open` 3. Fly through the storm gate. → `through-gate`

Layout:

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading north, energy 30`.
- Entities: `asteroid-1` (`asteroid_titanium`, x 0, y 0, z 1); `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-2` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

Starter code: same shape as `p2-m5` starters, with the briefing line as the lead comment. Java `full-scaffold`.

Pass checks:

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `shield-up` | Raise the shield | `ship.shield` | `eq` | `true` | `final` | 1 |
| `gate-open` | Open the storm gate | `entities.gate-1.open` | `eq` | `true` | `final` | 2 |
| `through-gate` | Fly through the storm gate | `ship.x` | `eq` | `6` | `final` | 3 |

Reference route (both languages; concept use is review only here, Part B awards no Stars): `if` shield is down, `shield()`; `if` lane ahead is blocked, `turn_right()`; then `move()` six times through the gate. Totals: 8 steps, 8 energy. No Par applies.

Hints:

1. Nudge: "Two decisions guard this route: one for the shield, one for the blocked lane."
2. Stronger: "Raise the shield while it is down, turn east when the count ahead is 0, then count 6 moves."
3. Near-solution: "Shield inside its `if`, turn inside its `if`, then call `move()` six times and stop."

## Summary tables for the builder

### Tiers, Seeds, Par

| Mission | `conceptId` | `tier` | Seeds | ref steps / energy (Py = Java) | Par `maxSteps` / `maxEnergy` | Override / exception |
|---|---|---|---|---|---|---|
| `p2-m1` | `comparison` | `intro` | 2 | 5 / 5 | 10 / 10 | none |
| `p2-m2` | `if_statement` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p2-m3` | `if_else` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p2-m4` | `else_if_chain` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p2-m5` | `boolean_decision` | `stretch` | 4 | 8 / 8 | 14 / 14 | none |
| Cometa Gate Part B | — | — | 3 | 8 / 8 | — | no Par by design |

Par check, per the Par decision: `ceil(1.5 × 5) + 2 = 10`; `ceil(1.5 × 8) + 2 = 14`. The later build test reruns both reference solutions on the practice Seed, recomputes this formula, and fails on any mismatch with the table.

### Check-label rule check

Every check label reads without coordinates, per ADR-0013 feedback rules: labels name the goal ("Fly through the storm gate"), never a cell. Hidden-Seed failures surface only these labels plus the fixed anti-hardcoding line.

## Confirmed authoring choices

Accepted at human review, 2026-11-05:

1. Conditional pattern: conditionals steer the Ship (shield / turn / lane choice) based on numeric and boolean sensors only (`distance_ahead()`, `energy()`, `is_shield_on()`). No string sensor comparison (`scan_ahead()` names) is used, because Cadet Java string equality is not yet pinned by any ADR or spec in this repo.
2. Seed invariance: Pass checks anchored only on non-moving world features; one decorative crystal per layout; no cracked asteroid and no drone on Planet 2.
3. No tier override and no Par exception on Planet 2; both quotas stay untouched for later Planets.
4. Reference solutions at `content/references/planet-2/`, named `<slug>.py` / `<slug>.java` plus `cometa-gate-part-b.py` / `.java`.
5. Mission titles and story text as written above, and Seed pools `2101`–`2603` (Planet-prefixed).
6. `p2-m4` reuses the `p2-m3` route shape so the only new load is the three-way chain.

