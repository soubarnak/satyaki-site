# ADR-0005 — In-memory sliding-window rate limiting

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Implements:** SRS NFR-009 (20 runs per client per 60 s) under CR-003
(no database), mitigating threat TH-001

## Context

NFR-009 refuses run 21 within a 60 s window per client with a busy message.
CR-003 forbids a server database and NFR-011/NFR-019 require zero personal
data in stored records. The site deploys as a single Coolify container
behind Traefik, so one process memory serves every request. A client must be
identified without storing anything: Traefik supplies the client IP in a
forwarded header on each request.

## Decision

The run route rate-limits in process memory:

- **Key:** SHA-256 hash of the client IP from Traefik's forwarded header.
  The hash exists only as a map key in memory; raw IPs are never logged or
  persisted, keeping the stored-record inventory at zero (NFR-011).
- **Window:** sliding. The route keeps the timestamps of a key's recent runs;
  a request that would be the 21st inside 60 s is refused with HTTP 429,
  result class `busy` (ADR-0004), and a retry-after value. Entries older
  than the window are dropped; empty keys are removed.
- **Counting order:** every run-route request counts before input
  validation, so malformed floods consume quota too (TH-001).
- **Concurrency cap:** at most 4 simultaneous runner calls across all
  clients; a request beyond that returns `busy` immediately, no queue.
  This protects the shared family server from parallel JVM spawns.

## Consequences

- One household or school NAT address shares a single 20-per-minute quota.
  SRS peak volume is 5 runs per minute per device, so two learners behind
  one address stay under the limit; this is accepted at version-1 scale
  (10 learners per day, NFR-003).
- Counters reset on container restart or redeploy. The exposure is one
  fresh 60 s window; accepted.
- The limiter is per process. Version 1 runs one site replica; scaling to
  several replicas would multiply the effective limit and needs a new
  decision then.
- The limiter is a pure, clock-injected module, unit-testable without HTTP
  (ADR-0007). NFR-009's 25-run verification runs against the route with a
  fake runner.

## Rejected alternatives

- Traefik rate-limit middleware: refusal behaviour would live in deploy
  configuration outside repo tests, and a mis-scoped label could throttle
  ordinary page views.
- Client-side throttle only: honest double-clicks stop, bots face no limit,
  TH-001 stays unmitigated.
