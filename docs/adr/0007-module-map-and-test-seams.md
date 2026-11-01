# ADR-0007 — Module map and test seams

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Implements:** Structure for all SRS workflows; verification seams for
NFR-009, NFR-014, DR-001 to DR-005

## Context

Later build tickets (map view, lesson player, run route, playground, arena
replay, progress view) need fixed module boundaries so parallel work does
not tangle. Several SRS verifications are bulk fault sets — 100
fault-injected runs with 0 false passes (NFR-014), 25 runs against the rate
limit (NFR-009), seeded corrupt progress records (DR-003, DR-004) — which
are only repeatable if the decision logic sits in pure modules behind
stubbable boundaries, away from the browser, Monaco, and the live runner.

## Decision

### Routes (`app/`, Next.js App Router)

| Route | Realises |
|---|---|
| `/` | Level map, WF-001 |
| `/levels/[id]` | Lesson player, WF-002 |
| `/playground` | Playground, WF-003 |
| `/arena` | Robot arena, WF-004 |
| `/progress` | Parent progress and reset, WF-005 |
| `/api/run` | Run route (IR-003), Node.js runtime |

The run route uses the Node.js runtime, not Edge: the in-memory rate
limiter (ADR-0005) needs one persistent process, and Edge gains nothing on
a self-hosted Coolify container.

### Pure core (`lib/`, no framework imports)

- **Levels:** level content data and types; build-time validation of point
  bounds (DR-002), concept order and one-concept-per-level (FR-004).
- **Progress:** parse, sanitize, derive (ADR-0006); streak counting
  (FR-015). Storage access sits behind a thin `localStorage` adapter; the
  core never touches `window`.
- **Judge:** pass decision from output check plus concept token (FR-006).
- **Arena engine:** parses printed robot commands from program output,
  replays them in order, applies the 100-command win rule (FR-011).

### Server-only (`lib/server/`, never imported by client components)

- **Env:** single reader for `RUNNER_URL` and `RUNNER_KEY` (ADR-0002); a
  missing value yields the `runner-unavailable` class, never a crash page.
- **Piston client:** execute call with the ADR-0003 budget and abort.
- **Classifier:** Piston response to result class (ADR-0004).
- **Rate limiter:** sliding window plus concurrency cap (ADR-0005), clock
  injected.

### Test seams

- **Vitest unit suites** per pure module, seeded from SRS cases: DR-001
  lengths 0/1/20000/20001, DR-002 points 9/10/500/501, DR-003/DR-004 corrupt
  records, FR-011 win at 100 commands vs loss at 101, classifier against
  canned Piston payloads per ADR-0004 row, limiter refusing run 21 under a
  fake clock.
- **Route integration tests** for `/api/run` against a stub Piston HTTP
  server: the NFR-014 fault set (timeout, abort, HTTP error, garbage body)
  asserting no `ok` class and no pass; DR-005 truncation at 10000
  characters per stream.
- **Thin Playwright pass** over WF-002 with the run API stubbed in the
  browser: open level, run starter-derived program, see pass, map shows it.
- No automated test calls the live runner. Live smoke stays manual per
  deploy/piston/README.md and the RC checks.

## Consequences

- Build tickets can be sliced per module with the seams above as their
  acceptance tests; the Heimdall build waves inherit this map.
- Monaco and animation code stay in components; nothing test-critical
  depends on them.
- A future runner swap touches one module (Piston client) plus the
  classifier's canned payloads, per the map's IR-003 note.

## Rejected alternatives

- Logic inside React components with component-level tests: Monaco coupling
  makes fault injection slow and brittle.
- Manual QA only: the 25-run and 100-run verification sets in NFR-009 and
  NFR-014 are not repeatable by hand.
