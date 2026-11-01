# ADR-0001 — Pin Next.js 16.4.3 exactly

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Amends:** SRS CR-001 (Next.js 14 App Router mandate)

## Context

SRS CR-001 mandated Next.js 14 App Router with TypeScript. The wayfinder map
locked "current stable Next.js" on 2026-10-31, amending CR-001 in principle.
The current stable release is 16.4.3 (npm `latest`, checked 2026-11-01). No
application code exists yet, so no migration cost applies.

## Decision

Build on Next.js 16.4.3 with the App Router and TypeScript. `package.json`
pins the exact version `16.4.3` with no caret or tilde range. Upgrades happen
only through a deliberate version-bump change, never as a side effect of a
fresh install on the Coolify build.

## Consequences

- Every build ticket targets one known framework version; Coolify builds are
  reproducible from the lockfile.
- Next.js 16 is the newest major; minor ecosystem lag is possible. Monaco
  Editor and shadcn/ui both run as client components and are unaffected in
  any known way.
- The scaffold ticket records the Node.js version Next.js 16.4.3 requires in
  the Coolify build settings.

## Rejected alternatives

- Latest 15.x: one major behind at birth; upgrade debt from day one.
- Floating "current stable on scaffold day": the scaffold session would pick
  an unreviewed version with no decision record.
