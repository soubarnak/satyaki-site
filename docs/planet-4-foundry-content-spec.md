# Planet 4 — Foundry content spec

Status: build-ready spec draft for [Author Planet 4 content spec](https://github.com/soubarnak/satyaki-site/issues/55). Awaits human review; the ticket resolution comment carries the decision gist.

Destination input decisions, not reopened here:

- Concept spine: [Decide concept spine for 25 Missions and 5 Planets](https://github.com/soubarnak/satyaki-site/issues/49)
- Planet identities and story arc: [Decide Planet identities and story arc](https://github.com/soubarnak/satyaki-site/issues/50)
- Par formula and tier rules: [Decide Par formula and tier override rules](https://github.com/soubarnak/satyaki-site/issues/51)
- Schema, Ship API, grader: ADR-0011, ADR-0012, ADR-0013 in `docs/adr/`.

## Planet record

| Field | Value |
|---|---|
| `id` | `planet-4` |
| `slug` | `foundry` |
| `name` | `Foundry` |
| `themeId` | `foundry-forge` |
| `planetConceptId` | `function` |
| Mission slugs, in order | `p4-m1`, `p4-m2`, `p4-m3`, `p4-m4`, `p4-m5` |
| Boss Gate title | Foundry Gate |
| Restored Ship system | Helper routines (Melodia voice) |
| Java Training Wheels | `partial` on every Mission and on Boss Gate Part B (Planets 3–4 default, ADR-0011; no per-Mission override) |

## Authoring rules applied to every Mission below

1. **Pass is World State only** (ADR-0013). Code text never gates Star 1. Each reference solution uses the Mission `conceptId` in the editable region and the Planet concept where Star 3 is later replayed. Star 3 for `function` is a Cadet-defined function or method that is called at least once and executes on the practice Seed (ADR-0013; only code inside the `YOUR CODE BELOW` / `YOUR CODE ABOVE` editable region counts).
2. **Seed invariance.** Hidden Seeds relocate only crystals, cracked asteroids, and drone start cells (ADR-0012). Every Pass check below anchors on Ship state, a `switch`, a `gate`, or a titanium asteroid: none of those ever move. Each layout carries one crystal off the reference route as visible Seed variation; crystals never block, so a relocated crystal cannot block a route. No cracked asteroid and no drone appears on Planet 4, so no relocatable blocker can land on a reference route on a hidden Seed.
3. **Functions drive the Ship.** Unlike Planet 1 variables (named memory read back with `log()`), Planet 2 conditionals (a branch chooses one Ship action), and Planet 3 loops (a loop repeats a Ship action), a Planet 4 function earns its place by being defined and then called: the function body calls Ship actions, and any count or value it uses is fixed by non-moving world features, so the same helper runs on every Seed. Scaffold code never calls Ship actions and never reads Cadet variables.
4. **One new construct per Mission.** Missions 1–4 teach one construct each (`function_definition`, `function_parameter`, `function_return`, `local_variable`); `p4-m5` is the Planet-concept climax (`function_composition`) and combines the earlier helper routines. No list construct appears before Planet 5.
5. **Par** (from the Par decision): `maxSteps = ceil(1.5 × refSteps) + 2`, `maxEnergy = ceil(1.5 × refEnergy) + 2`, shared across languages, practice Seed only. Python and Java references post identical steps and energy on every Mission below, so `refSteps` / `refEnergy` are those shared values. No Par exception and no tier override is used on Planet 4; tier defaults M1 `intro`, M2–M4 `core`, M5 `stretch`.
6. **Reference solutions** live outside shipped content at `content/references/planet-4/<slug>.py` and `content/references/planet-4/<slug>.java`, plus `foundry-gate-part-b.py` / `.java` for the Boss Gate. The build test runs each on every Seed in the pool; each must Pass (Boss Gate Part B: pass its checks, no Stars). The full solution text for each Mission is the reference route listed in its **Reference route** line; the Planet spec is the source the builder transcribes from.
7. Story text is second-person narrator voice, at most 280 characters, no Mission Control character, no dialogue. Static is a phenomenon only. Briefing is one sentence. Objectives are Cadet-facing and map to check ids.

## Mission p4-m1 — Define the Forge Helper

- `conceptId`: `function_definition` · `tier`: `intro` (position default, no override) · Seed pool: 2 (`4101`, `4102`; first is practice)
- **Story (144 chars):** "The Foundry machine halls are silent. The Ship's forge helpers are offline. Define your first helper routine and call it to open the forge gate."
- **Briefing:** "Define `forge_help()` that moves east four times, then call it to flip the forge switch and open the gate."
- **Objectives:** 1. Flip the forge switch → `switch-on` 2. Open the forge gate → `gate-open` 3. Fly through the forge gate → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 4, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# Define one helper routine that walks the forge lane, then call it.
# move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // Define one helper routine that walks the forge lane, then call it.
    // Write main below. Inside it, define `forge_help` and call it to move east.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

`partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the forge switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `gate-open` | Open the forge gate | `entities.gate-1.open` | `eq` | `true` | `final` | 2 |
| `through-gate` | Fly through the forge gate | `ship.x` | `eq` | `4` | `final` | 3 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `void forge_help() { move(); move(); move(); move(); }` then `forge_help();`):

```python
def forge_help():
    move()
    move()
    move()
    move()

forge_help()
```

Totals: 4 steps, 4 energy in both languages.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "A helper routine does nothing until it is called. Define `forge_help`, then call it."
2. Stronger: "Put four `move()` calls inside `forge_help()`, then write `forge_help()` on its own line."
3. Near-solution: "Define `forge_help()` with four `move()` calls, call it once, and press Run."

### Rosetta Pair (Planet concept: `function`, revealed after Pass)

Python:

```python
def forge_help():
    move()
```

Java:

```java
void forge_help() {
    move();
}
```

Shared note: "A helper routine is defined once, then called whenever the Ship needs it."

## Mission p4-m2 — Feed the Forge Helper

- `conceptId`: `function_parameter` · `tier`: `core` (position default, no override) · Seed pool: 3 (`4201`, `4202`, `4203`)
- **Story (132 chars):** "The forge gate opens only for a counted run. Give your helper a number of steps, then call it to cross the hall and flip the switch."
- **Briefing:** "Define `forge_help(steps)` that moves east `steps` times, then call it with 4 to flip the forge switch and open the gate."
- **Objectives:** 1. Flip the forge switch → `switch-on` 2. Fly through the forge gate → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 4, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# A helper takes a number and moves that many times.
# range(steps) counts 0 up to steps minus one.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // A helper takes a number and moves that many times.
    // Write main below. Inside it, define `forge_help(steps)` with a loop, then call `forge_help(4)`.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

`partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the forge switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `through-gate` | Fly through the forge gate | `ship.x` | `eq` | `4` | `final` | 2 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `void forge_help(int steps) { for (int i = 0; i < steps; i++) { move(); } }` then `forge_help(4);`):

```python
def forge_help(steps):
    for i in range(steps):
        move()

forge_help(4)
```

Totals: 4 steps, 4 energy in both languages.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "The helper takes a number; that number is how many times it moves."
2. Stronger: "Loop `steps` times inside `forge_help(steps)`, moving once each round, then call `forge_help(4)`."
3. Near-solution: "Define `forge_help(steps)` with a counted `for` loop of `steps` calls to `move()`, then call `forge_help(4)`."

### Rosetta Pair (Planet concept: `function`, revealed after Pass)

Python:

```python
def forge_help(steps):
    for i in range(steps):
        move()
```

Java:

```java
void forge_help(int steps) {
    for (int i = 0; i < steps; i++) {
        move();
    }
}
```

Shared note: "A parameter lets one helper run different distances."

## Mission p4-m3 — Return the Forge Reading

- `conceptId`: `function_return` · `tier`: `core` (position default, no override) · Seed pool: 3 (`4301`, `4302`, `4303`)
- **Story (124 chars):** "The forge sensor measured the hall length. Have your helper report it back, then fly that many cells east to the forge gate."
- **Briefing:** "Define `hall_length()` that returns 4, then fly that many cells east to flip the forge switch and open the gate."
- **Objectives:** 1. Flip the forge switch → `switch-on` 2. Fly through the forge gate → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 4, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# A helper can hand back a number the rest of the code uses.
# return 4 gives the hall length to the loop that follows.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // A helper can hand back a number the rest of the code uses.
    // Write main below. Inside it, define `hall_length` returning 4, then loop move() that many times.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

`partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the forge switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `through-gate` | Fly through the forge gate | `ship.x` | `eq` | `4` | `final` | 2 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `int hall_length() { return 4; }` then `for (int i = 0; i < hall_length(); i++) { move(); }`):

```python
def hall_length():
    return 4

for i in range(hall_length()):
    move()
```

Totals: 4 steps, 4 energy in both languages.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "A helper can hand back a number. Let `hall_length()` return the hall length."
2. Stronger: "Make `hall_length()` return 4, then loop `move()` that many times using the return value."
3. Near-solution: "Return 4 from `hall_length()`, then call `move()` inside a loop driven by `hall_length()`."

### Rosetta Pair (Planet concept: `function`, revealed after Pass)

Python:

```python
def hall_length():
    return 4
```

Java:

```java
int hall_length() {
    return 4;
}
```

Shared note: "A helper routine can hand back a result the rest of the code uses."

## Mission p4-m4 — Keep the Forge Count Local

- `conceptId`: `local_variable` · `tier`: `core` (position default, no override) · Seed pool: 3 (`4401`, `4402`, `4403`)
- **Story (99 chars):** "The forge count lives only inside the helper. Keep it local, then run the helper to cross the hall."
- **Briefing:** "Define `forge_help()` that keeps a local count of 4 and moves that many cells east, then call it."
- **Objectives:** 1. Flip the forge switch → `switch-on` 2. Fly through the forge gate → `through-gate`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 4, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# A name made inside a helper belongs only to that helper.
# Use it as the move count, then call the helper.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // A name made inside a helper belongs only to that helper.
    // Write main below. Inside it, define `forge_help` with a local `count` of 4, then call it.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

`partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the forge switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `through-gate` | Fly through the forge gate | `ship.x` | `eq` | `4` | `final` | 2 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `void forge_help() { int count = 4; for (int i = 0; i < count; i++) { move(); } }` then `forge_help();`):

```python
def forge_help():
    count = 4
    for i in range(count):
        move()

forge_help()
```

Totals: 4 steps, 4 energy in both languages.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "A name made inside a helper belongs only to that helper. Use it as the move count."
2. Stronger: "Inside `forge_help()`, set a local `count` to 4, then loop `move()` that many times."
3. Near-solution: "Give `forge_help()` a local `count = 4`, loop `move()` over it, then call the helper."

### Rosetta Pair (Planet concept: `function`, revealed after Pass)

Python:

```python
def forge_help():
    count = 4
    for i in range(count):
        move()
```

Java:

```java
void forge_help() {
    int count = 4;
    for (int i = 0; i < count; i++) {
        move();
    }
}
```

Shared note: "A name kept inside a helper is its own local memory."

## Mission p4-m5 — Wake Melodia (climax)

- `conceptId`: `function_composition` · `tier`: `stretch` (position default, no override) · Seed pool: 4 (`4501`, `4502`, `4503`, `4504`)
- **Story (143 chars):** "Static still muffles the Foundry. Combine the helper routines to clear the hall and wake Melodia, the Ship helper voice, silent before Foundry."
- **Briefing:** "Define `first_leg()` and `second_leg()`, then call them in order to open both forge gates and wake Melodia."
- **Objectives:** 1. Open the first forge gate → `gate-one-open` 2. Open the second forge gate → `gate-two-open` 3. Wake Melodia at the far gate → `melodia-wake`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 4, y 0, z 0, `linkId gate-1`); `switch-2` (`switch`, x 6, y 0, z 0, `linkId gate-2`); `gate-2` (`gate`, x 7, y 0, z 0, `linkId gate-2`); `asteroid-1` (`asteroid_titanium`, x 8, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

### Starter code

Python:

```python
# Two helpers, one per gate, called in order to wake Melodia.
# move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // Two helpers, one per gate, called in order to wake Melodia.
    // Write main below. Define and call two helpers to clear both gates.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

`partial` shape: the class wrapper is given; the Cadet writes the `public static void main(String[] args) { ... }` line and its closing brace inside the editable region.

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `gate-one-open` | Open the first forge gate | `entities.gate-1.open` | `eq` | `true` | `final` | 1 |
| `gate-two-open` | Open the second forge gate | `entities.gate-2.open` | `eq` | `true` | `final` | 2 |
| `melodia-wake` | Wake Melodia at the far gate | `ship.x` | `eq` | `7` | `final` | 3 |

### Reference route and Par

Reference core lines (Python shown; Java mirrors with `void first_leg() { move(); move(); move(); move(); }`, `void second_leg() { move(); move(); move(); }` then `first_leg(); second_leg();`):

```python
def first_leg():
    move()
    move()
    move()
    move()

def second_leg():
    move()
    move()
    move()

first_leg()
second_leg()
```

Totals: 7 steps, 7 energy in both languages.
`refSteps 7`, `refEnergy 7` → Par `maxSteps 13`, `maxEnergy 13` (`ceil(1.5 × 7) + 2 = 13`). No exception.

### Hints

1. Nudge: "One helper opens the first gate; another opens the second. Call them one after the other."
2. Stronger: "Write `first_leg()` to reach the first gate and `second_leg()` to reach the second, then call both."
3. Near-solution: "Define two helpers, one per gate, call them in order, and press Run."

### Rosetta Pair (Planet concept: `function`, revealed after Pass)

Python:

```python
def first_leg():
    move()
    move()

def second_leg():
    move()
```

Java:

```java
void first_leg() {
    move();
    move();
}

void second_leg() {
    move();
}
```

Shared note: "Two helpers side by side, each flying one part of the route."

## Foundry Gate — Boss Gate

Seed pool: 3 (`4601`, `4602`, `4603`). No Par, no Stars. Part B unlocks only after Part A passes (four of five items, unlimited retries, no cooldown).

### Part A — five quiz items (fixed order)

| # | Type | Prompt | Options | Correct index | Explanation |
|---|---|---|---|---|---|
| 1 | `choice` | A Cadet-written helper routine runs only when it is: | A) defined · B) called at least once · C) saved · D) seeded | 1 | Defining a helper does not move the Ship; Star 3 requires a defined function that actually executes. |
| 2 | `spot-bug` | This helper is defined but the Ship stays still: a helper named `forge_help` whose body calls `move()` once. What is missing? | A) a call to `forge_help()` · B) more moves · C) a crystal · D) a seed | 0 | A defined-but-never-called helper never executes, so it cannot pass Star 3 or open the gate. |
| 3 | `predict-state` | Starting at x 0 facing east, a helper named `patrol` calls `move()` twice. The code calls `patrol()` twice. What is `ship.x`? | 2 · 4 · 6 · 8 | 1 | Two calls of two moves each move the Ship four cells east. |
| 4 | `choice` | A `for` loop's body runs once per: | A) second · B) each count · C) Ship cell · D) Seed | 1 | A counted `for` loop runs its body once per count. |
| 5 | `spot-bug` | A helper sets a variable named count to 4 inside itself, then code outside reads count. Why does that fail? | A) `count` is local to the helper · B) `count` needs a seed · C) `count` is too large · D) `count` needs a gate | 0 | A local variable lives only inside its helper; code outside cannot read it. |

### Part B — coding challenge

Reuses the Mission fields for layout, Pass checks, both starter codes, three hints, and seed pool (3 seeds). No Par, no Star 3 concept, no Rosetta Pair, no tier, awards no Stars.

#### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 4, y 0, z 0, `linkId gate-1`); `switch-2` (`switch`, x 6, y 0, z 0, `linkId gate-2`); `gate-2` (`gate`, x 7, y 0, z 0, `linkId gate-2`); `crystal-1` (`crystal`, x 5, y 0, z 2).

#### Starter code

Python:

```python
# Two helpers, one per gate, called in order to wake Melodia.
# move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`partial`):

```java
public class Main {
    // Two helpers, one per gate, called in order to wake Melodia.
    // Write main below. Define and call two helpers to clear both gates.
    // YOUR CODE BELOW

    // YOUR CODE ABOVE
}
```

#### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `gate-one-open` | Open the first forge gate | `entities.gate-1.open` | `eq` | `true` | `final` | 1 |
| `gate-two-open` | Open the second forge gate | `entities.gate-2.open` | `eq` | `true` | `final` | 2 |
| `through-both` | Clear both forge gates | `ship.x` | `eq` | `7` | `final` | 3 |

#### Reference route (Part B awards no Stars)

`def first_leg(): move(); move(); move(); move()` then `def second_leg(): move(); move(); move()` then `first_leg(); second_leg()` — 7 steps, 7 energy in both languages.

#### Hints

1. Nudge: "One helper opens the first gate; another opens the second. Call them one after the other."
2. Stronger: "Write `first_leg()` to reach the first gate and `second_leg()` to reach the second, then call both."
3. Near-solution: "Define two helpers, one per gate, call them in order, and press Run."

## Summary tables for the builder

### Tiers, Seeds, Par

| Mission | `conceptId` | `tier` | Seeds | ref steps / energy (Py = Java) | Par `maxSteps` / `maxEnergy` | Override / exception |
|---|---|---|---|---|---|---|
| `p4-m1` | `function_definition` | `intro` | 2 | 4 / 4 | 8 / 8 | none |
| `p4-m2` | `function_parameter` | `core` | 3 | 4 / 4 | 8 / 8 | none |
| `p4-m3` | `function_return` | `core` | 3 | 4 / 4 | 8 / 8 | none |
| `p4-m4` | `local_variable` | `core` | 3 | 4 / 4 | 8 / 8 | none |
| `p4-m5` | `function_composition` | `stretch` | 4 | 7 / 7 | 13 / 13 | none |
| Foundry Gate Part B | — | — | 3 | 7 / 7 | — | no Par by design |

Par check, per the Par decision: `ceil(1.5 × 4) + 2 = 8`; `ceil(1.5 × 7) + 2 = 13`. The later build test reruns both reference solutions on the practice Seed, recomputes this formula, and fails on any mismatch with the table.

### Check-label rule check

Every check label reads without coordinates, per ADR-0013 feedback rules: labels name the goal ("Open the first forge gate"), never a cell. Hidden-Seed failures surface only these labels plus the fixed anti-hardcoding line.

## Authoring choices baked into this spec

1. Function pattern: each helper is defined and called; the body calls Ship actions directly, and counts are fixed by non-moving world features so the same helper runs on every Seed.
2. Seed invariance: Pass checks anchored only on non-moving world features; one decorative crystal per layout; no cracked asteroid and no drone on Planet 4.
3. No tier override and no Par exception on Planet 4; both quotas stay untouched for Planet 5.
4. Reference solutions at `content/references/planet-4/`, named `<slug>.py` / `<slug>.java` plus `foundry-gate-part-b.py` / `.java`.
5. Mission titles and story text as written above, within the story rules from the Planet identities decision (Foundry: helpers offline, M5 wakes Melodia; Static damage cleared locally at the climax).
6. Seed pools `4101`–`4603`, Planet-prefixed.

**Verification note:** the Ship sim is not built yet, so reference steps/energy and Par were counted by hand from the authored routes in this document. The later build test recomputes Par from live reference runs and fails on mismatch, per the Par decision.
