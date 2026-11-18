# Cadet Java — bounded subset grammar (issue #64)

**Status:** Pinned first deliverable for the Cadet Java interpreter worker (map #29, spec §§3,5,9).
**Scope:** The bounded subset the TypeScript interpreter over `java-parser` CST executes in the Mission Web Worker.
This file is the grammar pin: the interpreter implements exactly this, no full-Java promise.

Domain words follow `GLOSSARY.md`. Ship API is ADR-0012. Star 3 mapping is ADR-0013.
Arena snapshots are ADR-0014. Content shapes are ADR-0011.

## 1. File shapes (ADR-0011 Training Wheels)

Every Mission program is one compilation unit, one public class, parsed with `java-parser`
`parse()`. Any parse failure is a learner error frame, never a crash.

- **full-scaffold** (Planets 1–2): `public class Main` with
  `public static void main(String[] args)` given. Cadet code sits between
  `// YOUR CODE BELOW` and `// YOUR CODE ABOVE` inside `main`.
- **partial** (Planets 3–4): the `public class Main` wrapper is given. The Cadet writes
  the `main` method line and its closing brace inside the markers.
- **minimal** (Planet 5): comments plus markers only. The Cadet writes the class and
  the `main` method inside the markers.
- Only `main` runs in Mission mode. Sibling methods in `Main` are callable helpers.
- Arena mode runs `onTick(ship, radar)` (see §7), always full-scaffold.

Markers are content concerns (ADR-0011). The interpreter finds executable methods by
CST (`main`, helpers, `onTick`), not by marker text.

## 2. What runs

| Area | Included | Excluded (learner error) |
|---|---|---|
| Variables | `int`, `double`, `String`, `boolean` decls, assignment, `+= -= *= /= %=`, `++ --` | `var`, casts, `final` statics, other types |
| Arithmetic | `+ - * / %`, parens, String `+` concat | Bit ops, shifts, `Math.*` |
| Comparison | `== != < > <= >=`, String `equals()` | `==` on Strings (use `equals`) |
| Logic | `&& \|\| !`, `true false null` | `& \| ^` single-char forms |
| Control | `if else if else`, `while`, classic `for`, enhanced `for`, `switch`, ternary | `do while` runs but is discouraged; no lambdas, no exceptions |
| Functions | Sibling methods with params, `return`, call with args | Overloads (first match wins), recursion past event cap stops |
| Lists | `int[]` decl/initializer/`new`, index read/write, `.length` | `ArrayList` (see §6), no string lists |
| Ship | 20 camelCase calls (ADR-0012 §5) | `snake_case` names, any other name |
| Snapshots | `ship.x ship.y ship.z ship.heading ship.energy ship.shield ship.crystals` | Writes to `ship.*`, any other field |
| Arena | `radar.droneDistance radar.droneDirection radar.wave radar.dronesLeft` plus `onTick` return | Writes to `radar.*` |
| Comments | `//` and `/* */` | Javadoc processing (ignored, kept) |

## 3. Planet concept mapping (ADR-0013 Star 3)

Same meaning as the Python AST mapping, read off the Cadet Java CST:

- **loop**: `for`, enhanced `for`, `while` (and `do while`) that executes.
- **conditional**: `if`, `switch`, ternary `?:` that executes.
- **function**: a Cadet-defined method that is called at least once and whose body executes.
- **list**: creating an `int[]` and reading or writing one element by index, executed.
- Only code inside the editable region counts; scaffold, comments, and string
  literals never count. The grader (`lib/grader.ts`) owns this check; the worker
  only reports executed lines in trace order.

## 4. Statements

- Empty `;` is legal and emits no trace event.
- A block `{ ... }` runs in order in a child scope. `main` locals are visible to the
  trace (see §8).
- `return value;` inside a helper returns the value. `return;` inside `main` ends
  the run normally. `onTick` must return exactly one action string (see §7).
- `for (int i = 0; i < N; i++)` bounds are plain ints. Enhanced form is
  `for (int n : route)`. `switch` discriminants are `int` or `String` with
  `case` constants and optional `default`; fall-through runs (Cadet style: one
  `break` per case).
- Anything outside this section that still parses (imports, extra classes, fields,
  `try/catch`, `throw`, `synchronized`) is rejected with a line-numbered learner
  error naming the construct.

## 5. Ship calls (ADR-0012, camelCase)

Step actions (1 step, in-worker synchronous against the one `ShipSim`):
`move() turnLeft() turnRight() ascend() descend() laser() harvest() shield()`.
Sensors (0 steps): `scanAhead() distanceAhead() energy() getX() getY() getZ()`
`heading() crystals() isShieldOn() onCrystal()`. `log(value)` costs 0 steps.

Rules:

- Step actions run only as standalone statements: `move();`. A step action nested
  inside an expression or assignment is a sensor/action mix-up error naming the line.
- Sensors run inside expressions. A standalone sensor statement is allowed and
  discarded (no step, still a trace event).
- `log` takes exactly one argument; every other Ship name takes zero. Wrong counts
  stop with an `ArgCount` frame naming the line.
- Unknown Ship names stop with an `UnknownShipName` frame. `snake_case` spellings
  (`turn_left`) in Java code are unknown names: the message names the camelCase form.
- Blocked moves spend the step and record `blocked: true`, never an error (ADR-0012).

## 6. Lists (Planet 5 shape)

```java
int[] route = {2, 3, 1};
int first = route[0];
route[1] = 4;
int n = route.length;
for (int i = 0; i < route.length; i++) { move(); }
for (int steps : route) { for (int n = 0; n < steps; n++) { move(); } }
```

`ArrayList<Integer>` with `add/get/set/size` parses (ADR-0013 allows it) and runs
through the same index path. Planet 5 content itself uses only `int[]`, 0-based,
ints only, loop bounds equal to the list length; sensors never return lists.

## 7. Arena `onTick` (ADR-0014)

```java
public class Main {
    public String onTick(Ship ship, Radar radar) {
        if (radar.droneDistance == 0) { return "shield"; }
        return "move";
    }
}
```

- Signature: `onTick(ship, radar)` with two parameters, returning `String`.
- `ship` fields: `x y z heading energy shield crystals` (read-only).
- `radar` fields: `droneDistance droneDirection wave dronesLeft` (read-only).
- The tick returns exactly one action string: `move turn_left turn_right ascend
  descend laser harvest shield wait` (Java spelling: `move turnLeft turnRight ascend
  descend laser harvest shield wait`; the interpreter accepts both and normalises).
  Any other return wastes the tick upstream; it never stops the run.
- No Ship calls inside `onTick`: per-tick control is the return value only.
  A Ship call there is a mix-up error naming the line.

## 8. Trace (spec §4, same shape as Python)

One batched result per Run press: run header `{initial, bounds}` plus one event
per executed learner line `{step, line, kind: "line", locals, shipDelta}` with
`log` text on a `log` field when `log()` runs on that line. `step` counts Ship
actions only; `shipDelta` is null on non-Ship lines. Error shape:
`{kind: "error", line, excType, message}`; World State at the stop stays readable.

- `line` is the 1-based global editor line of the CST node.
- `locals` holds JSON-safe scalars plus shallow small lists/dicts (string cap 200,
  20 items), dunders and Ship names excluded, same caps as Python.
- Caps per Seed run: 500 Ship steps, 500 trace events, 3 s wall clock. Hitting a
  guard stops the run with `step-cap`, `event-cap`, or `time-cap`.
- Only the practice trace returns for playback; hidden Seeds rerun the same
  interpreter and discard traces after grading.

## 9. Non-goals

Full Java, floats-as-grid, threads, I/O, exceptions-as-control-flow, and any
dependency beyond `java-parser`. Piston stays the CI oracle and the stdout fallback
(issue #30); CheerpJ is out of scope until full-Java fidelity outranks stepping.
