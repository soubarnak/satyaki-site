# Research: Java execution in the browser

Status: research complete, 2026-11-04. Ticket: GitHub issue #30 (map #29).
Unblocks: #42 (Ship API) and #44 (debugger timeline).

## Question

> How should Java run in the browser for kids: client AST
> interpreter/transpiler, sandboxed WebAssembly JVM, or reuse the
> self-hosted Piston runner? Judge each against: identical Ship API with
> Python, line-by-line execution highlight, 500-step / 3-second loop
> guard, kid-friendly error translation with line numbers, load time on
> school hardware, and offline behaviour. Recommend one, with fallback.

## Recommendation in one paragraph

Build a small client-side interpreter in TypeScript for a deliberately
bounded subset of Java ("Cadet Java"), parsing learner source with the
`java-parser` package and executing the syntax tree in a Web Worker.
It is the only option that owns its execution loop, so it is the only
option where line-by-line highlight, a 500-step guard, timeline scrub,
kid-worded errors with line numbers, and direct calls into the same
TypeScript Ship simulation that Python uses are all straightforward
consequences of the design rather than instrumentation projects bolted
onto a runtime built for something else. The fallback is the existing
self-hosted Piston runner, kept for today's stdout-graded Java levels
and reused as a test oracle for the interpreter; it cannot serve the
steppable 3D destination. A WebAssembly JVM (CheerpJ) is the strongest
third option and the right escape hatch if full-Java fidelity ever
outranks stepping, but it runs compiled bytecode rather than learner
source and documents no step or trace API.

## Grounding: where the app is, where it is going

Current state (from this repository):

- Next.js 16.4.3 / React 19, no client execution of learner code at all
  (`package.json`).
- Java runs on a self-hosted Piston service on Coolify, internal-only,
  behind a key-checking gateway
  ([ADR-0002](../adr/0002-runner-env-values.md),
  [deploy/piston/README.md](../../deploy/piston/README.md)). The run
  route pins language `java`, version `15.0.2`, one file `Main.java`,
  empty stdin, 3000 ms compile / 5000 ms run / 9500 ms abort
  ([ADR-0003](../adr/0003-run-route-budget.md),
  [lib/server/piston.ts](../../lib/server/piston.ts)).
- Outcomes are classified server-side into seven Piston-shaped classes
  (`ok`, `compile`, `runtime`, `memory-cap`, `time-cap`,
  `runner-unavailable`, `busy`)
  ([ADR-0004](../adr/0004-run-error-classes.md),
  [lib/server/classify.ts](../../lib/server/classify.ts)).
- Passing is stdout equality plus a concept token in the source text
  ([lib/judge.ts](../../lib/judge.ts), [GLOSSARY.md](../../GLOSSARY.md)).
  There is no trace, no stepping, and no world state.
- The shipped concept ladder is small and closed: print, variables,
  branch, loop, method, class, array, combined loops, debug repair,
  combined quest ([lib/levels.ts](../../lib/levels.ts),
  [docs/javaquest-level-pack.md](../javaquest-level-pack.md)).

Destination (per ticket #30 and the map): a dual-language Python 3 +
Java 3D platform for ages 10–13, 25 levels, a state-based grader, and a
debugger with line-by-line highlight and timeline scrub. The Ship API
must be identical in both languages (Python `snake_case`, Java
`camelCase`). Python runs client-side via Pyodide in a Web Worker
(ticket #31, assumed done for this research). Three destination facts
drive everything below:

1. **Execution must be steppable and traceable**, not run-to-stdout.
   Timeline scrub means the runner must be able to produce, for each
   step, at least the source line and enough state to redraw the world.
2. **Ship calls are interactive.** A level whose loop reads a sensor
   and then moves needs each Ship call to talk to the live world
   simulation while the program runs, and both languages must observe
   identical semantics. The cheapest way to guarantee identity is one
   TypeScript simulation that both language runners call into.
3. **The Java subset is curriculum-bounded.** Learner programs are
   short (today capped at 20,000 characters, realistically tens of
   lines), single-file, no stdin. "Java" here means the concept ladder
   plus the destination additions (while loops, lists, more String
   operations), not the Java Language Specification.

## Criteria table

Scoring: **Strong** = the criterion falls out of the design;
**Partial** = achievable with meaningful extra work; **Weak** = fights
the design or not documented as possible. Options: **A** custom AST
interpreter in TypeScript over `java-parser`; **B** WebAssembly JVM,
represented by CheerpJ (TeaVM, Bytecoder, DoppioJVM assessed and dropped
below); **C** reuse the self-hosted Piston runner.

| Criterion | A: AST interpreter | B: CheerpJ (WASM JVM) | C: Piston (server) |
| --- | --- | --- | --- |
| Identical Ship API with Python | Strong — builtin Ship methods dispatch to the one TS simulation | Partial — Ship stub `.jar` with JS native methods; needs compiled bytecode first | Weak — one-shot stdout API; interactive Ship needs a stdin/stdout protocol or a duplicate world sim in Java |
| Line-by-line highlight + timeline scrub | Strong — interpreter emits a trace event per statement; scrub replays recorded events | Weak — no documented step/trace/debugger API | Weak — no step/trace in the execute API; would need source/bytecode instrumentation server-side |
| 500-step / 3-second guard | Strong — counter per statement + wall clock in the loop; worker termination as backstop | Partial — wall clock via worker termination; step counting needs instrumentation | Partial — wall time and memory caps exist today; "500 steps" has no server-side meaning without instrumentation |
| Kid-friendly errors with line numbers | Strong — every parse/name/type/runtime error is ours to word, all carry token line/column | Partial — real `javac`/JVM text, translatable by pattern as today, but compile step itself is unplaced (see below) | Strong today — real `javac` `Main.java:line` text already classified into kid sentences (ADR-0004) |
| Load time on school hardware | Strong — parser measured in tens of KB gzip; interpreter is our own small TS | Weak–Partial — runtime resources download on demand and cache, but no published total found; first load is the risk | Strong for the page (nothing to load), Weak per run (~1 s compile+print smoke, ADR-0003; every Run is a network round trip) |
| Offline behaviour | Strong — static JS shipped with the site, cacheable like any asset | Partial — free tier loads from the vendor CDN; self-hosting (hence full offline) is a paid tier feature | Weak — no network, no runs at all |
| Java coverage vs. subset need | Partial — exactly the curriculum subset, by construction; everything else is a kid-worded "not in Cadet Java yet" | Strong — full OpenJDK, far beyond need (and beyond what we want kids to reach) | Strong — real `javac`/JVM (Java 15.0.2 as pinned) |
| Sandboxing of learner code | Strong — no `eval`, no access beyond dispatched builtins; worker-isolated | Partial — browser sandbox (vendor-documented), but the full class library is reachable unless filtered | Strong — isolated server-side execution, already proven in production shape |
| Maintenance / licence / cost | Strong — `java-parser` + Chevrotain are Apache-2.0 and actively released; interpreter is ours to maintain (that is also its main cost) | Partial — vendor-maintained, v5.0 current; free for educational use from their CDN, paid for self-hosting/commercial tiers | Strong — MIT, already deployed on Coolify; cost is the existing server |
| Build effort to destination | Partial — the interpreter is the largest single build item, bounded by the subset | Partial — integration is easy, but source compilation, stepping, and step counting are unsolved on top of it | Weak for destination — existing work only covers run-to-stdout grading |

## Option A — Custom AST interpreter in TypeScript

### Shape

Parse learner source with
[`java-parser`](https://www.npmjs.com/package/java-parser) (a
Chevrotain-based Java parser in JavaScript, maintained inside the
[prettier-java](https://github.com/jhipster/prettier-java) project),
lower its concrete syntax tree (CST) to a small internal AST covering
only the Cadet Java subset, and tree-walk that AST in a Web Worker.
Builtin objects (`System.out`, a `Ship` API surface, a trimmed `Math`,
String/array/List methods) are TypeScript functions the interpreter
dispatches to. Ship builtins call the same world simulation module the
Python worker calls, so Ship semantics exist exactly once.

Measured and verified during this research (local probe, 2026-11-04,
against the published npm package — a primary artifact, re-runnable):

- `java-parser` latest is 3.0.1 (published 2025-07-01), Apache-2.0,
  depending on `chevrotain` 11.0.3, per the
  [npm registry record](https://registry.npmjs.org/java-parser). The
  registry reports a 46,520-byte tarball / 257,064 bytes unpacked; the
  minified Chevrotain build it pulls in measured 140,427 bytes
  (42,152 bytes gzipped) locally. Total parser cost is therefore in
  the tens of KB gzipped before bundling/tree-shaking — school-hardware
  friendly. The parent repo `jhipster/prettier-java` was pushed
  2026-11-01 with release `prettier-plugin-java@2.11.0` on 2026-09-28
  ([GitHub API](https://api.github.com/repos/jhipster/prettier-java),
  queried 2026-11-04): actively maintained.
- The parser "outputs a Concrete Syntax Tree, rather than an Abstract
  Syntax Tree" and is offered as "the basis for other Java related
  tools in the JavaScript ecosystem"
  ([package README](https://unpkg.com/java-parser@3.0.1/README.md)).
  CST-to-subset-AST lowering is therefore our code to write; that is
  expected and is where unsupported-syntax errors get their kid
  wording.
- Tokens carry `startLine`, `startColumn`, and `startOffset`
  (observed in the probe: first token `public` at line 1, column 1,
  offset 0), which is the raw material for both line highlight and
  error line numbers.
- Parse failures throw with the line and column in the message
  (observed: "parsing errors detected in line: 2, column: 51" followed
  by expected token sequences). The wording is adult and must be
  translated wholesale — but translation is a lookup on error kind +
  position, which the destination requires for every option anyway.

### Against the criteria

- **Ship parity:** a Ship call in Java (`ship.moveForward()`) and in
  Python (`ship.move_forward()`) resolve to the same TypeScript host
  function. There is no second implementation to drift. Sensor reads
  return live simulation values mid-loop.
- **Highlight and scrub:** the interpreter emits one trace event per
  executed statement: `{ step, line, kind, locals, shipDelta }`. The
  500-step cap bounds a trace at 500 events, so storing full locals
  snapshots (values are ints, booleans, Strings, small arrays) is
  trivial, and timeline scrub is "redraw from event *k*". This is the
  same event-stream contract the Pyodide runner can emit, so #44
  builds one timeline UI for both languages.
- **Guard:** increment the step counter on every statement; stop with
  a kid-worded `step-limit` error at 500; check a 3-second wall clock
  in the same loop. A pathological case that somehow wedges the worker
  is still stoppable because
  [`Worker.terminate()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate)
  "immediately terminates the Worker … it is stopped at once". The
  only code that runs between step checks is our own builtins, so the
  guard cannot be starved by learner code.
- **Errors:** parse, unknown-name, type, array-bounds, divide-by-zero,
  and Ship errors are all raised by our code with a line attached, so
  each maps to one kid sentence plus the line number. This replaces
  the Piston-shaped ADR-0004 taxonomy for client runs with a
  runner-owned taxonomy shared with Python (see Implications).
- **Load and offline:** the interpreter ships as ordinary site
  JavaScript. Once the page and its assets are cached, Java levels run
  with no network. Cold start is parse-time only (milliseconds for
  tens of lines; not separately measured — see Open unknowns).
- **Coverage:** exactly the subset, nothing else. A v1 subset drawn
  from the shipped ladder plus destination needs: `int`/`boolean`/
  `String` (and `double` only if Ship needs it), literals, variables,
  assignment and `++`/`--`/`+=`-family, arithmetic/comparison/logical
  operators with Java integer-division and short-circuit semantics,
  `if`/`else`, `for`, `while`, `break`/`continue`, static methods with
  parameters and return values, classes with fields and a default or
  simple constructor (level 6 already needs this much), arrays with
  initialisers and `.length`, `System.out.print/println`, and String
  `+` concatenation, `.length()`, `.equals()`, `.charAt()`,
  `.substring()`. Lists (`ArrayList` surface syntax) and enhanced
  `for` are destination decisions for #42. Everything else (packages,
  imports beyond the builtins, threads, file/network I/O, exceptions
  as a teaching topic, inheritance/interfaces, generics beyond list
  surface syntax) is rejected at lowering time with a "not in Cadet
  Java yet" error naming the line. Deliberate semantic decisions the
  subset spec must pin down rather than drift into: 32-bit `int`
  overflow, and `==` on Strings (recommend teaching `.equals()` and
  documenting the interpreter's `==` behaviour explicitly in the spec).

### Transpiler variant, assessed and set aside

Option A's sibling — transpiling the subset to JavaScript with an
injected `__step(line)` hook, then running the JS — shares the parser
and subset work but gives up the two properties the destination leans
on: locals snapshots for scrub (JS locals are not inspectable from the
hook) and a closed capability surface (generated code runs with
whatever the surrounding scope exposes unless carefully sealed;
`eval`-adjacent CSP friction on school networks is a further risk).
Existing Java→JS transpilers do not change this: JSweet "stands on
Oracle's Java Compiler (javac) and on Microsoft's TypeScript (tsc)"
([JSweet README](https://github.com/cincheo/jsweet)), i.e. it is a
build-time tool needing a JDK, and its latest GitHub release is 3.1.0
(2021-04-22) with last push 2023-12-16
([GitHub API](https://api.github.com/repos/cincheo/jsweet), queried
2026-11-04). A custom interpreter is the better member of the family
for this product.

### Cost

The interpreter is real work — the largest single build item of the
three options — but its scope is the curriculum, and the 25 reference
solutions (10 already in the level pack) double as golden tests. The
existing Piston runner can act as a CI oracle: run each reference
solution through real `javac` (via Piston) and through the interpreter
and diff stdout/Ship-action logs, which catches semantic drift where
it matters. Any effort figure in weeks would be an estimate, not a
sourced claim; the subset spec in #42 is what makes it estimable.

## Option B — WebAssembly JVM (CheerpJ; others dropped)

### CheerpJ findings

CheerpJ is "a Java Virtual Machine and a full build of OpenJDK for the
browser, implemented in WebAssembly and JavaScript" running "Java 8,
11, 17 and 21, with Java 25 in preview … from their compiled JARs,
with no source code, recompilation, plug-in or local Java
installation"; version 5.0 is current
([CheerpJ documentation overview](https://cheerpj.com/docs/overview)).
Its architecture notes stress the same point: "It works on compiled
Java bytecode, so it needs the application's JARs, not its source
code" ([architecture](https://cheerpj.com/docs/explanation/architecture)).
That single fact shapes this option: **CheerpJ does not accept learner
`.java` source**, and its fetched documentation describes no in-browser
`javac` path. (The 5.0 data sheet says each version ships "its own
full build of OpenJDK" whose class library is "the full JDK's, not
only the JRE subset" ([data sheet](https://cheerpj.com/data-sheets/)),
which makes running the compiler as a Java program conceivable, but
conceivable is all it is — see Open unknowns. The alternative,
compiling on a server, reintroduces the server this option was meant
to remove, and Piston's API returns stdout/stderr only, not compiled
artifacts.)

- **Stepping/tracing:** the documentation's debugging page covers
  troubleshooting CheerpJ itself (console logs, `enableDebug`, HAR
  files) — "[collect] the information we need if you ask us for help"
  ([debugging guide](https://cheerpj.com/docs/guides/cheerpj-debug)).
  No breakpoint, single-step, line-trace, or JDWP-style API is
  documented in the fetched docs. Timeline scrub and the 500-step
  guard would both need bytecode instrumentation layered on top — a
  research project, with output fidelity then depending on our
  instrumentation rather than on the JVM. This is the decisive gap
  against destination fact 1.
- **Ship API:** genuinely feasible once bytecode exists. CheerpJ lets
  you "implement native methods in JavaScript instead, where they can
  use JavaScript libraries and any Web API"
  ([native methods guide](https://cheerpj.com/docs/guides/implementing-native-methods)),
  and library mode "lets JavaScript use Java classes, objects and
  arrays directly"
  ([library mode](https://cheerpj.com/docs/guides/library-mode)). A
  precompiled `Ship` stub with `native` methods could dispatch to the
  same TS simulation as Python. Parity is achievable; getting learner
  bytecode to link against the stub is the unsolved part.
- **Load on school hardware:** runtime resources are "loaded on
  demand, when the application first needs them" and the browser
  "caches them for later visits", with a documented
  [`preloadResources`](https://cheerpj.com/docs/guides/Startup-time-optimization)
  mechanism to fetch a profiled set in parallel. The bootstrap
  `loader.js` measured 7,521 bytes from the vendor CDN
  (`cjrtnc.leaningtech.com`, fetched 2026-11-04), but that is only the
  loader; **no total first-run download size or cold-start time is
  published in the documentation fetched**, and a full OpenJDK class
  library is necessarily downloaded in pieces on first use. On
  first-visit school Chromebooks with cleared caches (the vendor's own
  preloading use case), this is the riskiest first impression of the
  three options. Any MB figure would be unverified; a spike
  measurement is required before this option could be budgeted.
- **Sandbox:** the vendor's security model is the browser's: "Java
  code cannot reach the local disk, start operating-system processes
  or load pre-built native binaries" and CheerpJ "adds no privileges
  beyond those of a normal web page"
  ([data sheet, Security](https://cheerpj.com/data-sheets/)). Safe
  against the machine; but the entire OpenJDK class library is
  addressable by learner code (threads, reflection, `System.exit`,
  HTTP via the browser), so kid-appropriate behaviour would still
  need filtering we cannot easily impose inside a real JVM.
- **Errors:** real `javac`/JVM messages with line numbers — the same
  raw material ADR-0004 already translates — but only if something
  runs `javac`. Runtime line numbers come from stack traces on
  exceptions; logic errors (the common kid case) produce no line
  information at all without stepping.
- **Offline and licence:** "CheerpJ is free for personal, educational
  and hobby use" and for non-commercial open-source projects loading
  from the CheerpJ CDN with credit; "Serving the CheerpJ runtime from
  anywhere other than the CheerpJ CDN counts as self-hosting", which
  is a paid add-on (Small Business) or included in Enterprise, whose
  build "contacts no external server and works on air-gapped
  networks" ([licensing](https://cheerpj.com/docs/licensing)). The
  pricing page lists Small Business at £100 per developer per month
  ([cheerpj.com/licensing](https://cheerpj.com/licensing/), fetched
  2026-11-04). So: free tier ⇒ CDN dependency and no true offline;
  offline ⇒ paid tier. Maintenance is vendor-active (5.0 current;
  meta repo pushed 2026-11-02,
  [GitHub API](https://api.github.com/repos/leaningtech/cheerpj-meta)).

### TeaVM and Bytecoder — dropped (ahead-of-time, not per-run)

TeaVM is "an ahead-of-time compiler of Java bytecode to JavaScript"
that "relies on existing compilers such as javac" and restricts
reflection, resources, class loaders, and JNI
([TeaVM overview](https://teavm.org/docs/intro/overview.html)). It is
healthy (release 0.16.0, 2026-10-02; Apache-2.0;
[GitHub API](https://api.github.com/repos/konsoletyper/teavm)) and even
produces source maps with IDE debugging. Bytecoder is the same shape:
it cross-compiles "JVM Bytecode to JavaScript, WebAssembly" with
SourceMaps as a goal
([Bytecoder README](https://github.com/mirkosertic/Bytecoder);
Apache-2.0, last release 2024-05-10, repo pushed 2026-10-05). Both
compile *known* bytecode ahead of time. Running a child's new source
on every Run click would require `javac` plus the AOT compiler (both
JVM programs) to execute per run — in the browser that means first
solving the JVM-in-browser problem they were meant to avoid, and on a
server it means a slower, more complex Piston. Neither documents a
per-statement step/trace runtime API. Dropped.

### DoppioJVM — dropped (unmaintained)

DoppioJVM is a JVM written in TypeScript
([README](https://github.com/plasma-umass/doppio)), but its latest
GitHub release is v0.5.0 (2016-10-30) and the repository was last
pushed 2022-12-06
([GitHub API](https://api.github.com/repos/plasma-umass/doppio),
queried 2026-11-04). Betting a kids' platform on it would mean
adopting the JVM ourselves. Dropped.

## Option C — Reuse the self-hosted Piston runner

Piston is "a high performance general purpose code execution engine"
for "running untrusted and possibly malicious code", MIT-licensed,
repo active (pushed 2026-07-31;
[GitHub](https://github.com/engineer-man/piston),
[API](https://api.github.com/repos/engineer-man/piston)). It is
already this product's runner: ADR-0003 records live smoke evidence
that "a tiny program compiles and prints in about 1 s; an infinite
loop was killed at about 3 s", and the deploy record shows the
internal-only Coolify service passing end-to-end level checks
([deploy/piston/README.md](../../deploy/piston/README.md)). (Upstream's
own install docs assume Docker and a privileged container with cgroup
v2; our site image is built with podman from the repo
[Containerfile](../../Containerfile), and the Coolify host's Docker is
infrastructure we do not control — noted for completeness, unchanged
by this decision.)

Against the destination criteria, though, Piston's contract is the
wrong shape. The execute endpoint takes files/stdin/timeouts and
returns, per phase, `stdout`, `stderr`, exit `code`, and `signal`
([Piston README, Execute Endpoint](https://github.com/engineer-man/piston#execute-endpoint)) —
exactly the run-to-stdout shape `lib/server/classify.ts` consumes
today. There is no step, trace, or locals channel. Three consequences:

- **Ship parity fails structurally.** A Ship call cannot reach the
  browser's world simulation mid-run through `POST /execute`. The
  workarounds are (i) reimplementing the world simulation in Java
  inside an injected stub so the whole run is self-contained — a
  second Ship semantics to keep in lockstep with Python's, the exact
  drift the destination forbids; or (ii) a line protocol over
  stdin/stdout. Self-hosted Piston does document an interactive
  WebSocket endpoint (`/api/v2/connect`, "not available through the
  public API") exchanging stdin/stdout and signals in real time
  ([Piston README, Interactive execution endpoint](https://github.com/engineer-man/piston#interactive-execution-endpoint-not-available-through-the-public-api)),
  which makes (ii) conceivable — but every sensor read and every step
  becomes a network round trip through our key-checking gateway
  (whose WebSocket proxying is untested; repo rule ADR-0007 also bars
  tests from calling the live runner), and a classroom of kids holds
  a classroom of server processes open.
- **Highlight/scrub and the 500-step guard do not exist** in the API.
  Both would need the learner program instrumented (source rewrite or
  a Java agent emitting line events) — comparable in effort to the
  trace emission that is free in option A, but done in a language and
  process we control least, and still only as good as the network.
- **Offline is impossible**, and every Run keeps paying the ~1 s
  compile-plus-run latency ADR-0003 measured, now multiplied if
  stepping is ever made interactive.

What Piston remains genuinely best at: real `javac` fidelity, real
error text with `Main.java:line`, hard server-side time/memory caps,
and zero client weight. That is why it is the fallback (below) and
the interpreter's test oracle, not the destination runner.

## Fallback

If the interpreter (option A) slips or a level needs Java beyond the
v1 subset, fall back in this order:

1. **Keep today's Piston path for Java stdout levels** while Python
   ships the 3D/Ship experience first. This is zero new work — the
   route, classifier, and judge already exist — and it de-risks the
   launch date rather than the architecture.
2. **Piston with an instrumented Ship stub for replay-only Ship
   levels**: inject a `Ship` class whose methods append action
   records that are printed as a delimited block on stdout at exit;
   the client replays the recorded actions into the 3D view and
   grades final state. This supports levels whose Ship interactions
   are write-only (move/turn/print) but *not* sensor-driven loops,
   offers timeline scrub over Ship actions only (no per-line locals),
   and needs no interactive endpoint. Acceptable as a bridge;
   explicitly not parity.
3. **CheerpJ** only if full-Java fidelity becomes a hard requirement
   (e.g. an "advanced Java" track): spike in-browser compilation
   first (see Open unknowns), budget the paid self-hosting tier if
   offline matters, and accept run-to-completion without stepping for
   that track.

## Risks and open unknowns

Verified vs. unverified is called out explicitly; the following claims
could **not** be verified from a primary source during this research
and must not be planned against as facts:

- **Unverified: CheerpJ total first-run download and cold start.**
  The vendor documents on-demand resource loading, caching, and
  preloading, and the bootstrap loader measured 7,521 bytes, but no
  total MB or seconds-to-first-line figure appears in the fetched
  primary docs. Needs a spike on representative school hardware.
- **Unverified: compiling learner source with CheerpJ.** The docs
  state CheerpJ consumes compiled bytecode and ship a full JDK build;
  they do not document running `javac` under CheerpJ. Treat
  in-browser compilation via CheerpJ as unproven until a spike runs
  `com.sun.tools.javac` (or equivalent) under it.
- **Unverified: any undocumented CheerpJ stepping support.** No
  step/breakpoint/trace API appears in the fetched documentation;
  absence of documentation is treated as absence for planning, but a
  vendor enquiry could in principle change this.
- **Unverified: interpreter total bundle size and parse latency.**
  Parser components were measured (above); the interpreter's own size
  and per-run latency are estimates until the subset is built. Both
  are bounded by design (subset-only code, ≤500 steps) but not yet
  facts.
- **Unverified: Piston interactive endpoint through our gateway.**
  `/api/v2/connect` is documented upstream for self-hosted instances;
  whether our key-checking gateway proxies WebSockets, and its
  per-step latency, were not tested (and repo tests must not call the
  live runner, per ADR-0007).
- **Unverified: school-Chromebook numbers for every option.** No
  target-device measurement exists yet. Recommend a one-page spike
  before #44: cold/warm load and time-to-first-step for the
  interpreter prototype (and for CheerpJ only if it is still in
  contention) on the slowest hardware the school actually has.

Design risks for the recommended option, with mitigations:

- **Semantic drift from real Java.** Kids who later meet a real JDK
  must not have learned wrong rules. Mitigation: pin the tricky
  semantics in the subset spec (integer division/overflow, String
  `==` vs `.equals()`, short-circuiting, array bounds) and oracle-test
  reference solutions against Piston/`javac` in CI.
- **CST lowering effort.** `java-parser` accepts all of Java; the
  lowering pass must recognise the subset and reject the rest with
  kid wording. Mitigation: build lowering per concept in level order,
  so each level's reference solution is the acceptance test for its
  slice.
- **"But real Java…" requests.** A bounded subset will eventually
  frustrate an advanced learner. Mitigation: the Piston fallback
  keeps a full-Java escape hatch for a future advanced track without
  contaminating the steppable core.

## Implications for the tickets this unblocks

### #42 — Ship API

- Define Ship **once** as TypeScript host functions over the world
  simulation. Java exposes them as interpreter builtins in
  `camelCase`; Python (Pyodide worker, #31) binds the same functions
  in `snake_case`. Neither language reimplements Ship semantics.
- #42 owns the Cadet Java subset spec: types, operators with pinned
  semantics, control flow, methods, class/array/String/List surface,
  the builtin list, and the "not in Cadet Java yet" rejection
  behaviour. The interpreter estimate should be taken only after this
  spec exists.
- Cross-language acceptance test for #42: the same level solved in
  Java and Python must emit the identical Ship action sequence and
  final world state. This is cheap to assert because both runners
  call one host.
- Error taxonomy moves client-side and becomes language-shared
  (`parse`, `name`, `type`, `index`, `step-limit`, `time-limit`,
  `ship`, …), superseding the Piston-shaped ADR-0004 classes for
  client runs; ADR-0004 remains correct for the Piston fallback path.
  A short superseding ADR should record this when #42 lands.

### #44 — Debugger timeline

- The contract #44 should build against is a per-language **trace
  event stream**: `{ step, line, kind, locals, shipDelta }`, capped
  at the 500-step guard, produced identically by the Java interpreter
  and the Python runner. Highlight = current event's line; scrub =
  render world + locals at event *k*; play = stepping *k* forward.
  No runner needs a live debugger protocol, which is precisely what
  neither CheerpJ nor Piston could offer.
- Because traces are complete and bounded (≤500 events), #44 can be a
  pure replay UI: no pausing live execution, no breakpoints into a
  running process. That removes the hardest UI/state problems from
  the ticket.
- Grading (state-based) reads the final trace event's world state,
  replacing stdout equality in `lib/judge.ts` for destination levels;
  concept tokens can be checked against the lowered AST instead of
  source text later, but that is an optimisation, not a blocker.

## Sources

Primary sources only; each claim above is cited inline to its owner.
Fetched or queried 2026-11-04.

- This repo: `package.json`, `GLOSSARY.md`, `Containerfile`,
  `lib/levels.ts`, `lib/judge.ts`, `lib/server/piston.ts`,
  `lib/server/env.ts`, `lib/server/run-handler.ts`,
  `lib/server/classify.ts`, `app/api/run/route.ts`,
  `docs/adr/0002-runner-env-values.md`,
  `docs/adr/0003-run-route-budget.md`,
  `docs/adr/0004-run-error-classes.md`,
  `docs/javaquest-level-pack.md`, `deploy/piston/README.md`.
- java-parser / Chevrotain: https://www.npmjs.com/package/java-parser,
  https://registry.npmjs.org/java-parser,
  https://unpkg.com/java-parser@3.0.1/README.md,
  https://github.com/jhipster/prettier-java (plus GitHub API metadata
  and a local parse probe against the published tarball).
- JSweet: https://github.com/cincheo/jsweet (README + GitHub API
  release/push metadata).
- CheerpJ (Leaning Technologies): https://cheerpj.com/docs/overview,
  https://cheerpj.com/docs/explanation/architecture,
  https://cheerpj.com/docs/licensing, https://cheerpj.com/licensing/,
  https://cheerpj.com/data-sheets/,
  https://cheerpj.com/docs/guides/Startup-time-optimization,
  https://cheerpj.com/docs/guides/cheerpj-debug,
  https://cheerpj.com/docs/guides/implementing-native-methods,
  https://cheerpj.com/docs/guides/library-mode, vendor CDN loader
  (`cjrtnc.leaningtech.com`) HEAD/body measurement.
- TeaVM: https://teavm.org/docs/intro/overview.html,
  https://github.com/konsoletyper/teavm (README + GitHub API).
- Bytecoder: https://github.com/mirkosertic/Bytecoder (README +
  GitHub API).
- DoppioJVM: https://github.com/plasma-umass/doppio (README + GitHub
  API).
- Piston: https://github.com/engineer-man/piston (README: execute and
  interactive endpoint specs; GitHub API metadata).
- Web Workers: https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate
