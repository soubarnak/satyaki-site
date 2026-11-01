# ADR-0002 — Two server env values for the runner, one of them secret

**Status:** Accepted (parent, 2026-11-01)
**Decides:** Part of GitHub issue "Lock architecture and SRS amendments"
**Amends:** SRS CR-002 (0 required environment values clause)

## Context

CR-002 required deployment with 0 environment values, written when a public
unauthenticated sandbox was assumed. Version 1 instead self-hosts Piston on
the family Coolify server behind a key-checking gateway (map decision
2026-10-31). The site's run route must present that key on every execute
call. At first site deploy, the learner domain moves from the gateway to the
site app and the runner becomes internal-only on the Coolify Docker network,
so the runner address changes at deploy time.

## Decision

The site app reads exactly two server-side environment values for the runner:

- `RUNNER_KEY` — the gateway key. The single secret in the system. Mirrored
  from the Piston service env in Coolify, per deploy/piston/README.md.
- `RUNNER_URL` — the runner base address. Plain configuration, not a secret:
  the public gateway address during development, the internal Coolify
  address after the domain switch.

Both values exist only in server code paths. Neither is exposed to the
browser bundle (no `NEXT_PUBLIC_` prefix), keeping NFR-006 intact.

## Consequences

- Key rotation and the deploy-time domain switch are env-only changes in
  Coolify; no code change or rebuild of client assets is needed.
- Local development can run against the public gateway by setting
  `RUNNER_URL` locally.
- The key rotation already owed before production (it transited the
  provisioning session) stays a Coolify env operation on both services.

## Rejected alternatives

- `RUNNER_KEY` only, URL hardcoded: local development could not target the
  gateway without a code edit, and the internal hostname would be guessed
  before deploy wiring exists.
- Public gateway forever: contradicts the locked internal-only runner and
  keeps the key endpoint internet-facing after launch.
