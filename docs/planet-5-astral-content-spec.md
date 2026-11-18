# Planet 5 — Astral content spec

Status: build-ready spec draft for [Author Planet 5 content spec](https://github.com/soubarnak/satyaki-site/issues/56). Awaits human review; the ticket resolution comment carries the decision gist.

Destination input decisions, not reopened here:

- Concept spine: [Decide concept spine for 25 Missions and 5 Planets](https://github.com/soubarnak/satyaki-site/issues/49)
- Planet identities and story arc: [Decide Planet identities and story arc](https://github.com/soubarnak/satyaki-site/issues/50)
- Par formula and tier rules: [Decide Par formula and tier override rules](https://github.com/soubarnak/satyaki-site/issues/51)
- Schema, Ship API, grader: ADR-0011, ADR-0012, ADR-0013 in `docs/adr/`.

## Planet record

| Field | Value |
|---|---|
| `id` | `planet-5` |
| `slug` | `astral` |
| `name` | `Astral` |
| `themeId` | `astral-starfield` |
| `planetConceptId` | `list` |
| Mission slugs, in order | `p5-m1`, `p5-m2`, `p5-m3`, `p5-m4`, `p5-m5` |
| Boss Gate title | Astral Gate |
| Restored Ship system | Star route (Haven rescue signal) |
| `star3Concept` | `list` on every Mission. Boss Gate Part B has none. |
| Java Training Wheels | `minimal` on every Mission and on Boss Gate Part B (Planet 5 default, ADR-0011; no per-Mission override) |

## Authoring rules applied to every Mission below

1. **Pass is World State only** (ADR-0013). Code text never gates Star 1. Each reference solution uses the Mission `conceptId` in the editable region. Star 3 for `list` passes when Cadet code in the editable region creates a list or array and reads or writes an element by index, and that code executes on the practice Seed (ADR-0013: Python list literal plus subscript; Java array plus index). Comments, string literals, and starter scaffold never count. `p5-m1` creates a list and does not index it, so that reference does not earn Star 3. `p5-m2` through `p5-m5` create a list and index it, so those references do.
2. **Seed invariance.** Hidden Seeds relocate only crystals, cracked asteroids, and drone start cells (ADR-0012). Every Pass check below anchors on Ship state, a `switch`, or a `gate`: none of those ever move. Each layout carries one crystal off the reference route as visible Seed variation; crystals never block, so a relocated crystal cannot block a route. No cracked asteroid and no drone appears on Planet 5, so no relocatable blocker can land on a reference route on a hidden Seed.
3. **Lists hold the route.** From `p5-m2` on, a list earns its place by being read or written by index, and those ints are the move counts (and, at the climax, the turn flags) the Ship flies. Values are fixed in Cadet code, matched to non-moving world features, so the same list runs on every Seed. Indexes are 0-based in both languages. Lists hold ints only: no string lists, no `ArrayList`, no `len`. Loop bounds are integer literals equal to the list length. Sensors stay scalars (ADR-0012); a list is program memory, never a sensor result. Scaffold code never calls Ship actions and never reads Cadet lists.
4. **One new construct per Mission.** Missions 1–4 teach one construct each (`list_creation`, `list_indexing`, `list_update`, `list_iteration`); `p5-m5` is the Planet-concept climax (`list_driven_route`) and combines creation, indexing, update, and index iteration with a conditional turn flag. Loops and conditionals are reused from earlier Planets. No class or OOP concept is taught; `public class Main` and `main` are program shape only.
5. **Par** (from the Par decision): `maxSteps = ceil(1.5 × refSteps) + 2`, `maxEnergy = ceil(1.5 × refEnergy) + 2`, shared across languages, practice Seed only. Python and Java references post identical steps and energy on every Mission below, so `refSteps` / `refEnergy` are those shared values. No Par exception and no tier override is used on Planet 5; tier defaults M1 `intro`, M2–M4 `core`, M5 `stretch`. Boss Gate Part B has no Par and no tier.
6. **Reference solutions** live outside shipped content at `content/references/planet-5/<slug>.py` and `content/references/planet-5/<slug>.java`, plus `astral-gate-part-b.py` / `.java` for the Boss Gate. The build test runs each file as a whole program on every Seed in the pool; each must Pass (Boss Gate Part B: pass its checks, no Stars). No starter scaffold is wrapped around a Planet 5 reference. Python files are the core lines shown under **Reference route**. Java files are exactly this wrapper around those core lines, with Java names (`turnLeft` for `turn_left`):

```java
public class Main {
    public static void main(String[] args) {
        // core lines
    }
}
```

Reference files contain no `YOUR CODE` markers. There is no Par-exception list for Planet 5. The Planet spec is the source the builder transcribes from.

7. **Training Wheels `minimal` shape.** The starter is comments plus the markers only. No class wrapper is given. The Cadet writes `public class Main` and `public static void main(String[] args)` inside the markers, then the list code inside `main`. Markers are `// YOUR CODE BELOW` and `// YOUR CODE ABOVE`, exactly once. A starter whose only text is comments, including those two marker comments, is valid at this stage: the build check does not require a `class` token in the starter. This reading governs Planet 5 Java starters (ADR-0011 "comment prompt only").
8. **Initial entity state.** Every `switch` starts `on: false`. Every `gate` starts `open: false` and is open exactly while the switch sharing its `linkId` is `on`. Entering a switch cell toggles it (ADR-0012).
9. Story text is second-person narrator voice, at most 280 characters, no Mission Control character, no dialogue. Static is a phenomenon only. Briefing is one sentence. Objectives are Cadet-facing and map to check ids. Hint text is identical in both languages, so hints name `move()` (the same in both) and say "turn left" in words rather than `turn_left` / `turnLeft`.

## Mission p5-m1 — Gather the Star Cargo

- `conceptId`: `list_creation` · `tier`: `intro` (position default, no override) · Seed pool: 2 (`5101`, `5102`; first is practice)
- **Story (126 chars):** "You leave the Foundry. Static has scattered Astral's star cargo. Make a list of the four loose stars, then fly the cargo lane."
- **Briefing:** "Make a list of four 1s, one per loose star, then fly east onto the cargo switch."
- **Objectives:** 1. Reach the cargo switch → `switch-on`, `on-switch`, `stay-lane`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 4, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 5, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `crystal-1` (`crystal`, x 1, y 0, z 2).

The reference stops on the switch. The gate opens because the switch toggles, and the titanium cell is past the gate. Neither is a Pass check. The crystal is off the lane.

### Starter code

Python:

```python
# Astral star cargo is scattered. Make a list of four 1s, then fly east.
# move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`minimal`):

```java
// Astral star cargo is scattered. Make a list of four 1s, then fly east.
// Write public class Main and public static void main(String[] args).
// Inside main, move() flies one cell the way the Ship faces.
// YOUR CODE BELOW

// YOUR CODE ABOVE
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the cargo switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `on-switch` | Reach the cargo switch | `ship.x` | `eq` | `4` | `final` | 1 |
| `stay-lane` | Stay in the cargo lane | `ship.z` | `eq` | `0` | `final` | 1 |

### Reference route and Par

Python file:

```python
stars = [1, 1, 1, 1]
move()
move()
move()
move()
```

Java core inside `main`:

```java
int[] stars = {1, 1, 1, 1};
move();
move();
move();
move();
```

The list is created and not indexed. Totals: 4 steps, 4 energy in both languages.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8` (`ceil(1.5 × 4) + 2 = 8`). No exception.

### Hints

1. Nudge: "A list holds many values under one name. Make one, then fly the lane."
2. Stronger: "Put four 1s in one list, one per loose star. Then call move() once per star."
3. Near-solution: "Make a list of four 1s, call move() four times, and press Run."

### Rosetta Pair (Planet concept: `list`, revealed after Pass)

Python:

```python
stars = [1, 1, 1, 1]
```

Java:

```java
int[] stars = {1, 1, 1, 1};
```

Shared note: "A list holds many values under one name."

## Mission p5-m2 — Read the First Star

- `conceptId`: `list_indexing` · `tier`: `core` (position default, no override) · Seed pool: 3 (`5201`, `5202`, `5203`)
- **Story (126 chars):** "The first slot of your star list holds the lane length. A second slot is a Static lie. Read the first slot, then fly that far."
- **Briefing:** "Read index 0 from a list of 4 then 9, and fly that many cells east onto the cargo switch."
- **Objectives:** 1. Reach the cargo switch → `switch-on`, `on-switch`, `stay-lane`

### Layout

- Bounds: `maxX 8, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 4, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 5, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 8, y 0, z 0); `crystal-1` (`crystal`, x 2, y 0, z 2).

Index 0 is the lane length 4, which lands on the switch. Index 1 is 9, a Static lie: nine moves run into the east bound (`maxX 8`) and finish off the switch, so the Pass fails. The crystal is off the lane.

### Starter code

Python:

```python
# The first slot is the lane length. The second slot is a Static lie.
# route[0] reads the first slot. move() flies one cell.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`minimal`):

```java
// The first slot is the lane length. The second slot is a Static lie.
// Write public class Main and public static void main(String[] args).
// Inside main, route[0] reads the first slot. move() flies one cell.
// YOUR CODE BELOW

// YOUR CODE ABOVE
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the cargo switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `on-switch` | Reach the cargo switch | `ship.x` | `eq` | `4` | `final` | 1 |
| `stay-lane` | Stay in the cargo lane | `ship.z` | `eq` | `0` | `final` | 1 |

### Reference route and Par

Python file:

```python
route = [4, 9]
for n in range(route[0]):
    move()
```

Java core inside `main`:

```java
int[] route = {4, 9};
for (int n = 0; n < route[0]; n++) {
    move();
}
```

Totals: 4 steps, 4 energy in both languages. The loop reuses Planet 3; the new construct is the index read.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "Index 0 is the first slot. The second slot is a Static lie."
2. Stronger: "Make a list of 4 then 9. Fly as many cells as the first slot."
3. Near-solution: "Make a list of 4 then 9, call move() as many times as index 0, and press Run."

### Rosetta Pair (Planet concept: `list`, revealed after Pass)

Python:

```python
route = [4, 9]
log(route[0])
```

Java:

```java
int[] route = {4, 9};
log(route[0]);
```

Shared note: "Index 0 is the first slot in the list."

## Mission p5-m3 — Correct the Star Count

- `conceptId`: `list_update` · `tier`: `core` (position default, no override) · Seed pool: 3 (`5301`, `5302`, `5303`)
- **Story (121 chars):** "Static wrote the wrong count in the star list. Replace that slot with the true lane length, then fly to the cargo switch."
- **Briefing:** "Change the list's only slot from 2 to 5, then fly that many cells east onto the cargo switch."
- **Objectives:** 1. Reach the cargo switch → `switch-on`, `on-switch`, `stay-lane`

### Layout

- Bounds: `maxX 7, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 5, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 6, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 7, y 0, z 0); `crystal-1` (`crystal`, x 1, y 0, z 2).

Leaving the slot at 2 stops short of the switch. Writing 5 lands on it. The crystal is off the lane.

### Starter code

Python:

```python
# Static stored 2. The lane length is 5. Write 5 into slot 0, then fly.
# move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`minimal`):

```java
// Static stored 2. The lane length is 5. Write 5 into slot 0, then fly.
// Write public class Main and public static void main(String[] args).
// Inside main, move() flies one cell the way the Ship faces.
// YOUR CODE BELOW

// YOUR CODE ABOVE
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the cargo switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `on-switch` | Reach the cargo switch | `ship.x` | `eq` | `5` | `final` | 1 |
| `stay-lane` | Stay in the cargo lane | `ship.z` | `eq` | `0` | `final` | 1 |

### Reference route and Par

Python file:

```python
route = [2]
route[0] = 5
for n in range(route[0]):
    move()
```

Java core inside `main`:

```java
int[] route = {2};
route[0] = 5;
for (int n = 0; n < route[0]; n++) {
    move();
}
```

Totals: 5 steps, 5 energy in both languages.
`refSteps 5`, `refEnergy 5` → Par `maxSteps 10`, `maxEnergy 10` (`ceil(1.5 × 5) + 2 = 10`). No exception.

### Hints

1. Nudge: "Writing a slot replaces that one value. The stored 2 is wrong."
2. Stronger: "Make a list whose only slot is 2, write 5 into index 0, then fly that many cells."
3. Near-solution: "Set index 0 to 5, call move() that many times, and press Run."

### Rosetta Pair (Planet concept: `list`, revealed after Pass)

Python:

```python
route = [2]
route[0] = 5
```

Java:

```java
int[] route = {2};
route[0] = 5;
```

Shared note: "Writing a slot replaces only that one value."

## Mission p5-m4 — Walk the Star List

- `conceptId`: `list_iteration` · `tier`: `core` (position default, no override) · Seed pool: 3 (`5401`, `5402`, `5403`)
- **Story (99 chars):** "The star list holds two jumps along the cargo lane. Walk every slot by its index and fly each jump."
- **Briefing:** "Walk both slots by index, a jump of 1 then a jump of 3, and fly them east onto the cargo switch."
- **Objectives:** 1. Reach the cargo switch → `switch-on`, `on-switch`, `stay-lane`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 2`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 4, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 5, y 0, z 0, `linkId gate-1`); `asteroid-1` (`asteroid_titanium`, x 6, y 0, z 0); `crystal-1` (`crystal`, x 1, y 0, z 2).

The slots are 1 then 3. Their sum is 4, which lands on the switch. The loop count 2 is the list length, written as a number. The crystal is off the lane.

### Starter code

Python:

```python
# Two jumps sit in the list. Walk every index and fly that jump.
# move() flies one cell the way the Ship faces.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`minimal`):

```java
// Two jumps sit in the list. Walk every index and fly that jump.
// Write public class Main and public static void main(String[] args).
// Inside main, move() flies one cell the way the Ship faces.
// YOUR CODE BELOW

// YOUR CODE ABOVE
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `switch-on` | Flip the cargo switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `on-switch` | Reach the cargo switch | `ship.x` | `eq` | `4` | `final` | 1 |
| `stay-lane` | Stay in the cargo lane | `ship.z` | `eq` | `0` | `final` | 1 |

### Reference route and Par

Python file:

```python
route = [1, 3]
for i in range(2):
    for n in range(route[i]):
        move()
```

Java core inside `main`:

```java
int[] route = {1, 3};
for (int i = 0; i < 2; i++) {
    for (int n = 0; n < route[i]; n++) {
        move();
    }
}
```

Totals: 4 steps, 4 energy in both languages. The inner loop reuses Planet 3; the new construct is the index walk across the list.
`refSteps 4`, `refEnergy 4` → Par `maxSteps 8`, `maxEnergy 8`. No exception.

### Hints

1. Nudge: "Visit each slot by its index. Fly the number stored there."
2. Stronger: "Make a list of 1 then 3. For index 0 and index 1, call move() that many times."
3. Near-solution: "Walk both indexes, fly the jump in each slot, and press Run."

### Rosetta Pair (Planet concept: `list`, revealed after Pass)

Python:

```python
route = [1, 3]
for i in range(2):
    log(route[i])
```

Java:

```java
int[] route = {1, 3};
for (int i = 0; i < 2; i++) {
    log(route[i]);
}
```

Shared note: "An index walk visits every slot, starting at 0."

## Mission p5-m5 — Fly the Star Route (climax)

- `conceptId`: `list_driven_route` · `tier`: `stretch` (position default, no override) · Seed pool: 4 (`5501`, `5502`, `5503`, `5504`)
- **Story (120 chars):** "Static scrambled the last star step. Correct the list, follow the ordered star route, and light the Haven rescue signal."
- **Briefing:** "Correct the last move slot from 1 to 3, then follow the move list and the turn list in order to the Haven signal."
- **Objectives:** 1. Light the first star switch → `first-switch` 2. Open the star-lane gate → `lane-gate` 3. Light the Haven rescue signal → `signal-switch`, `signal-gate`, `signal-lane`, `reach-signal`

### Layout

- Bounds: `maxX 6, maxY 0, maxZ 6`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 3, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 3, y 0, z 1, `linkId gate-1`); `switch-2` (`switch`, x 3, y 0, z 5, `linkId gate-2`); `gate-2` (`gate`, x 3, y 0, z 6, `linkId gate-2`); `asteroid-1` (`asteroid_titanium`, x 4, y 0, z 0); `crystal-1` (`crystal`, x 1, y 0, z 2).

Two lists, each of length 3, read by the same index. `route` holds move counts. `turns` holds 0 or 1; 1 means turn left before that leg's moves. The authored lists before the correction are `route = [3, 2, 1]` and `turns = [0, 1, 0]`. The reference writes `route[2] = 3` before flying.

Counted on the practice Seed, heading east at `(0, 0)`:

1. Index 0: no turn, 3 moves east, land on `switch-1` at `(3, 0)`. The switch toggles on and `gate-1` opens.
2. Index 1: turn left (now north), 2 moves north, through `gate-1` at `(3, 1)`, stop at `(3, 2)`.
3. Index 2: no turn, 3 moves north, land on `switch-2` at `(3, 5)`. The switch toggles on and `gate-2` opens. The Ship does not enter `gate-2`.

Leaving `route[2]` at 1 stops at `(3, 3)`, short of the signal. The titanium cell is east of the turn, off the route. The crystal is off the route.

### Starter code

Python:

```python
# The last move slot is wrong. Write 3 there, then fly both lists in order.
# A turns slot of 1 means turn left before that leg. move() flies one cell.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`minimal`):

```java
// The last move slot is wrong. Write 3 there, then fly both lists in order.
// Write public class Main and public static void main(String[] args).
// Inside main, a turns slot of 1 means turn left before that leg.
// YOUR CODE BELOW

// YOUR CODE ABOVE
```

### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `first-switch` | Light the first star switch | `entities.switch-1.on` | `eq` | `true` | `final` | 1 |
| `lane-gate` | Open the star-lane gate | `entities.gate-1.open` | `eq` | `true` | `final` | 2 |
| `signal-switch` | Light the Haven rescue signal | `entities.switch-2.on` | `eq` | `true` | `final` | 3 |
| `signal-gate` | Open the Haven signal gate | `entities.gate-2.open` | `eq` | `true` | `final` | 3 |
| `signal-lane` | Stay on the signal lane | `ship.x` | `eq` | `3` | `final` | 3 |
| `reach-signal` | Reach the Haven signal | `ship.z` | `eq` | `5` | `final` | 3 |

### Reference route and Par

Python file:

```python
route = [3, 2, 1]
turns = [0, 1, 0]
route[2] = 3
for i in range(3):
    if turns[i] == 1:
        turn_left()
    for n in range(route[i]):
        move()
```

Java core inside `main`:

```java
int[] route = {3, 2, 1};
int[] turns = {0, 1, 0};
route[2] = 3;
for (int i = 0; i < 3; i++) {
    if (turns[i] == 1) {
        turnLeft();
    }
    for (int n = 0; n < route[i]; n++) {
        move();
    }
}
```

Totals: 8 moves and 1 turn, so 9 steps and 9 energy in both languages.
`refSteps 9`, `refEnergy 9` → Par `maxSteps 16`, `maxEnergy 16` (`ceil(1.5 × 9) + 2 = 16`). No exception.

### Hints

1. Nudge: "Two lists share one index. Correct the last move slot before you fly."
2. Stronger: "Write 3 into the last move slot. For each index, turn left when the turns slot is 1, then fly the move slot."
3. Near-solution: "Set the last move slot to 3, walk both lists from index 0, turn left only when that turns slot is 1, and press Run."

### Rosetta Pair (Planet concept: `list`, revealed after Pass)

Python:

```python
route = [3, 2, 3]
turns = [0, 1, 0]
log(route[0])
```

Java:

```java
int[] route = {3, 2, 3};
int[] turns = {0, 1, 0};
log(route[0]);
```

Shared note: "Two lists, read in the same order, fly the star route."

## Astral Gate — Boss Gate

Seed pool: 3 (`5601`, `5602`, `5603`). No Par, no Stars, no `star3Concept`, no Rosetta Pair, no tier. Part B unlocks only after Part A passes (four of five items, unlimited retries, no cooldown).

### Part A — five quiz items (fixed order)

| # | Type | Prompt | Options | Correct index | Explanation |
|---|---|---|---|---|---|
| 1 | `choice` | The first slot of a list is index: | A) 1 · B) 0 · C) the length · D) the Seed | 1 | Lists and arrays in both languages start at index 0. |
| 2 | `spot-bug` | A Cadet writes a list or array named stars holding four 1s, then four `move()` calls that never read stars. The lane Passes, but Star 3 does not. What is missing? | A) a read or write of a slot, such as `stars[0]` · B) a crystal · C) another Seed · D) a turn | 0 | Star 3 for list needs a list or array created and a slot read or written by index, and that code must run. |
| 3 | `predict-state` | Starting at x 0 facing east, a list or array named route holds 1 then 3. For each index the Ship flies that slot with `move()`. What is `ship.x`? | 2 · 4 · 6 · 8 | 1 | The slots are 1 and 3, so the Ship moves four cells east. |
| 4 | `choice` | A list or array holds 2 in its first slot, and the code writes 5 into index 0. The first slot is now: | A) 2 · B) 5 · C) 2 and 5 · D) empty | 1 | Writing a slot replaces that slot only. |
| 5 | `choice` | A Ship sensor such as the scan-ahead sensor returns: | A) a list or array of names · B) one scalar, never a list or array · C) the Cadet's list or array · D) the Seed | 1 | Sensors return one JSON scalar in v1. A Cadet's list or array is program memory, not a sensor result. |

### Part B — coding challenge

Reuses the Mission fields for layout, Pass checks, both starter codes, three hints, and seed pool (3 seeds). Also carries a briefing, because the Planet identities decision puts the ending beat here. No story field is added to the Boss Gate record. No Par, no Star 3 concept, no Rosetta Pair, no tier, awards no Stars.

**Briefing:** "Haven Station's automated beacon answers: correct the star route and fly it until the beacon switch lights."

No sequel hook and no Planet 6 tease. The briefing is the ending beat.

#### Layout

- Bounds: `maxX 6, maxY 0, maxZ 4`. `shipStart`: `x 0, y 0, z 0, heading east, energy 30`.
- Entities: `switch-1` (`switch`, x 2, y 0, z 0, `linkId gate-1`); `gate-1` (`gate`, x 2, y 0, z 1, `linkId gate-1`); `switch-2` (`switch`, x 2, y 0, z 3, `linkId gate-2`); `gate-2` (`gate`, x 2, y 0, z 4, `linkId gate-2`); `asteroid-1` (`asteroid_titanium`, x 3, y 0, z 0); `crystal-1` (`crystal`, x 0, y 0, z 2).

`route` starts as `[2, 1]` and `turns` as `[0, 1]`. The reference writes `route[1] = 3` before flying.

Counted on the practice Seed, heading east at `(0, 0)`:

1. Index 0: no turn, 2 moves east, land on `switch-1` at `(2, 0)`. `gate-1` opens.
2. Index 1: turn left (now north), 3 moves north, through `gate-1` at `(2, 1)`, land on `switch-2` at `(2, 3)`. `gate-2` opens. The Ship does not enter `gate-2`.

Leaving `route[1]` at 1 stops on `gate-1` at `(2, 1)`, short of the beacon. The titanium cell is east of the switch, off the route. The crystal is off the route.

#### Starter code

Python:

```python
# Haven Station's beacon answers. The second move slot is wrong.
# Write 3 there, then fly both lists in order. A turns slot of 1 means turn left.
# YOUR CODE BELOW

# YOUR CODE ABOVE
```

Java (`minimal`):

```java
// Haven Station's beacon answers. The second move slot is wrong.
// Write public class Main and public static void main(String[] args).
// Inside main, write 3 into that slot, then fly. A turns slot of 1 means turn left.
// YOUR CODE BELOW

// YOUR CODE ABOVE
```

#### Pass checks

| id | label | statePath | comparator | expected | timing | objective |
|---|---|---|---|---|---|---|
| `lane-open` | Open the lane gate | `entities.gate-1.open` | `eq` | `true` | `final` | 1 |
| `beacon-lit` | Light the Haven beacon | `entities.switch-2.on` | `eq` | `true` | `final` | 2 |
| `beacon-gate` | Open the beacon gate | `entities.gate-2.open` | `eq` | `true` | `final` | 2 |
| `beacon-lane` | Stay on the beacon lane | `ship.x` | `eq` | `2` | `final` | 2 |
| `reach-beacon` | Reach the Haven beacon | `ship.z` | `eq` | `3` | `final` | 2 |

Objectives: 1. Open the lane gate → `lane-open` 2. Light the Haven beacon → `beacon-lit`, `beacon-gate`, `beacon-lane`, `reach-beacon`

#### Reference route (Part B awards no Stars)

Python file:

```python
route = [2, 1]
turns = [0, 1]
route[1] = 3
for i in range(2):
    if turns[i] == 1:
        turn_left()
    for n in range(route[i]):
        move()
```

Java core inside `main` (same wrapper as the Missions):

```java
int[] route = {2, 1};
int[] turns = {0, 1};
route[1] = 3;
for (int i = 0; i < 2; i++) {
    if (turns[i] == 1) {
        turnLeft();
    }
    for (int n = 0; n < route[i]; n++) {
        move();
    }
}
```

Totals: 5 moves and 1 turn, so 6 steps and 6 energy in both languages. No Par.

#### Hints

1. Nudge: "The beacon answers at the end of the route. Correct the second move slot first."
2. Stronger: "Write 3 into the second move slot. Turn left when the turns slot is 1, then fly the move slot."
3. Near-solution: "Set the second move slot to 3, walk both indexes, turn left only on the second leg, and press Run."

## Summary tables for the builder

### Tiers, Seeds, Par

| Mission | `conceptId` | `tier` | Seeds | ref steps / energy (Py = Java) | Par `maxSteps` / `maxEnergy` | Override / exception |
|---|---|---|---|---|---|---|
| `p5-m1` | `list_creation` | `intro` | 2 | 4 / 4 | 8 / 8 | none |
| `p5-m2` | `list_indexing` | `core` | 3 | 4 / 4 | 8 / 8 | none |
| `p5-m3` | `list_update` | `core` | 3 | 5 / 5 | 10 / 10 | none |
| `p5-m4` | `list_iteration` | `core` | 3 | 4 / 4 | 8 / 8 | none |
| `p5-m5` | `list_driven_route` | `stretch` | 4 | 9 / 9 | 16 / 16 | none |
| Astral Gate Part B | — | — | 3 | 6 / 6 | — | no Par by design |

Par check, per the Par decision: `ceil(1.5 × 4) + 2 = 8`; `ceil(1.5 × 5) + 2 = 10`; `ceil(1.5 × 9) + 2 = 16`. The later build test reruns both reference solutions on the practice Seed, recomputes this formula, and fails on any mismatch with the table.

### Check-label rule check

Every check label reads without coordinates, per ADR-0013 feedback rules: labels name the goal ("Light the Haven rescue signal"), never a cell. Hidden-Seed failures surface only these labels plus the fixed anti-hardcoding line.

## Authoring choices baked into this spec

1. Training Wheels `minimal` shape, as in the authoring rules: comment prompt and markers only; the Cadet writes the class and `main` inside the markers. A comment-only starter is valid. Java references are complete `Main` programs; nothing wraps them.
2. List pattern: ints only, index 0 first, Java `int[]` with subscript read and write, no `ArrayList` and no enhanced `for`. From `p5-m2` on, the indexed ints are load-bearing for the Pass. `p5-m1` only creates the list; a lane flown without a list still Passes, and Star 3 waits for a later replay that indexes.
3. `p5-m2` stores a decoy 9 in index 1 so the first-slot read is the lane length. `p5-m3` and the climax write over a wrong slot; skipping the write stops short of the switch or the signal.
4. Seed invariance: Pass checks anchored only on non-moving world features; one decorative crystal per layout; no cracked asteroid and no drone on Planet 5.
5. No tier override and no Par exception on Planet 5. Both quotas stay unused. No Par-exception file ships with the references.
6. Reference solutions at `content/references/planet-5/`, named `<slug>.py` / `<slug>.java` plus `astral-gate-part-b.py` / `.java`.
7. Mission titles and story text as written above, within the story rules from the Planet identities decision (Astral: leave Foundry with star cargo scattered, M5 follows the ordered star route and lights the Haven rescue signal, Astral Gate Part B briefing is the beacon answer, no sequel).
8. Seed pools `5101`–`5603`, Planet-prefixed.
9. Astral Gate Part A item 5 stands as written: sensors return one scalar, so a list cannot come from the Ship API.

**Verification note:** the Ship sim is not built yet, so reference steps, energy, and Par were counted by hand from the authored routes in this document, then checked with a grid walk of those same routes (moves, one left turn, bounds). The later build test recomputes Par from live reference runs and fails on mismatch, per the Par decision.
