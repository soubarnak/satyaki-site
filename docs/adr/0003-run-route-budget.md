# ADR-0003 — Run route time and memory budget

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Implements:** SRS IR-003 within CR-004 (10 s route ceiling) and NFR-004
(5000 ms run cap, 256 MB memory cap)

## Context

Every Run travels browser → site run route → self-hosted Piston → back.
Piston splits a Java execution into a compile phase and a run phase, each
with its own timeout and memory limit. Smoke evidence from the live runner
(2026-10-31): a tiny program compiles and prints in about 1 s; an infinite
loop was killed at about 3 s under Piston defaults. The route must complete
or abort within 10000 ms (CR-004, kept as a self-imposed cap on Coolify).

## Decision

The run route calls Piston execute with this fixed budget, chosen server-side
on every request:

| Setting | Value |
|---|---|
| Compile timeout | 3000 ms |
| Run timeout | 5000 ms |
| Compile memory limit | 512 MB |
| Run memory limit | 256 MB |
| Route upstream abort | 9500 ms |

Fixed request shape, none of it client-selectable: language `java`, version
`15.0.2`, exactly one file `Main.java` holding the submitted text, empty
stdin. The route validates program text against DR-001 (1 to 20000
characters) before forwarding, and truncates each returned stream to 10000
characters (DR-005) before responding. The response duration shown under
FR-005 is the server-measured execute round trip.

## Consequences

- Worst case inside Piston is 8 s, leaving 1.5 s of the CR-004 budget for
  network and response handling; the 9500 ms abort guarantees a mapped
  runner-unavailable result instead of a dropped request.
- The 512 MB compile limit guards the host while avoiding false memory-cap
  errors from `javac` and JVM startup on valid programs; the learner-facing
  cap remains the 256 MB run limit in NFR-004.
- Pinning language, version, file name, and stdin server-side closes off
  client attempts to run other languages or feed input (OS-005).

## Rejected alternatives

- 256 MB and 2000 ms on the compile phase too: cold compiles and JVM memory
  pressure would produce cap errors for correct programs.
- Compile 4000 ms plus run 5000 ms with abort at 10000 ms: network overhead
  alone can breach CR-004 and surface as a dropped request.
