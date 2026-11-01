# ADR-0004 — Run result classes mapped server-side

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Implements:** SRS FR-007 (child-readable error mapping) and the WF-002
runner down-or-busy path, over IR-003

## Context

FR-007 requires one child-readable sentence per error class — compile error,
runtime error, time cap, memory cap — plus the raw error text. WF-002 adds a
runner down-or-busy path that blocks the run with a retry message and awards
no pass. Piston returns coarse signals: per-phase exit codes, stderr text,
and process kills. SIGKILL enforces both the time cap and the memory cap, so
the two cap classes must be told apart indirectly.

## Decision

The run route classifies every outcome into exactly one of seven classes and
returns the class name with the result. The client renders the mapped
sentence for the class plus the raw stderr text; it never classifies.

| Class | Signal |
|---|---|
| `ok` | Compile and run exit 0 |
| `compile` | Compile phase exit code not 0 |
| `runtime` | Run phase exit code not 0 and the process was not killed |
| `memory-cap` | Run stderr carries `OutOfMemoryError` |
| `time-cap` | Run process killed with duration at the 5000 ms cap |
| `runner-unavailable` | Network failure, the 9500 ms route abort (ADR-0003), or a runner HTTP error |
| `busy` | Refused by rate limiting before any runner call (ADR-0005) |

An outcome matching no row returns `runtime` handling with the generic
try-again sentence FR-007 requires for unmapped errors. Raw stderr is
passed through after server-side stripping of internal runner paths
(NFR-005). No class other than `ok` can produce a pass (NFR-014). The exact
child-readable sentences are content: they are drafted with the level pack
and parent-reviewed there, not fixed by this ADR.

## Consequences

- The time/memory split is heuristic: a memory kill with no
  `OutOfMemoryError` text at cap duration labels as `time-cap`. Enforcement
  is unaffected — the program stops at the cap either way (NFR-004); only
  the teaching sentence differs in that rare case.
- `runner-unavailable` keeps infrastructure failure visually distinct from a
  mistake in the child's code, as WF-002 requires.
- Classification is a pure function of the Piston response, unit-testable
  without a live runner (ADR-0007).

## Rejected alternatives

- Four FR-007 classes only, runner failure folded into the generic sentence:
  a dead runner would read as the child's own code mistake.
- One merged "stopped" class for both caps: contradicts FR-007 naming both
  caps and loses the teaching distinction.
