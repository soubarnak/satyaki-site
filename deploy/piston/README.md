# Self-hosted Piston runner (Coolify, internal-only)

Java execution for JavaQuest (SRS IR-002). Only the site Next.js run
route (Coolify app `javaquest-site`) may call it, with header
`X-Runner-Key`.

Since ticket #26 the runner is **internal-only**: the gateway
sub-application has no public FQDN (no Traefik route), so the public
internet cannot call Java execution directly. The service is attached
to the shared `coolify` Docker network and the site app reaches the
gateway over the internal server-network address below.

## Deploy record (#26, live 2026-11-04 via Coolify MCP)

- Coolify project `JavaQuest`, service `javaquest-piston`
  (production environment) on server `bongbetic`.
- `deploy/piston/compose.yaml` is the source of the service compose;
  the FQDN-free revision was pushed with the service `update` call and
  redeployed in the same change.
- Internal runner address (plain configuration, not a secret):
  `http://gateway-bx5d9mja928kdyg92od5jwtq:80` — the Coolify-generated
  gateway container name (`<compose-service>-<service-uuid>`) on the
  `coolify` network. The site app (same network) uses this as its
  `RUNNER_URL`. Reachability by container name is what the service
  `connect_to_docker_network` attachment provides.
- Previous public gateway `https://satyakisjava.bongbetic.com` removed:
  FQDN cleared on the gateway sub-application and the
  `SERVICE_FQDN_GATEWAY_80` declaration dropped from the compose, then
  redeployed. At that point the old address answered Traefik `503`
  (no route) — never a runner answer.
- Learner domain moved to the site (#27, live 2026-11-04): the app
  `javaquest-site` now serves both `https://satyakisjava.bongbetic.com`
  and `https://javaquest.51.83.192.166.sslip.io` (Coolify app domains
  updated via API, then redeployed; no secret touched, no image change
  beyond the redeploy). The runner stays internal-only: the gateway
  sub-application still has no public FQDN, and the runner path on the
  learner domain answers the site's `404`, never a runner response.
- Key rotated at cutover: the provisioning key (which transited the
  provisioning session) was replaced with a fresh `openssl rand
  -base64 48` value on the service (`SERVICE_PASSWORD_64_RUNNERKEY`
  plus the mirrored service `RUNNER_KEY`) and on the site app
  (`RUNNER_KEY`, production and preview scopes), then both redeployed.
  Old value returns `403 forbidden`; wrong or missing key likewise
  `403`, which the site surfaces as `runner-unavailable`, never a Pass
  (locked by `lib/server/piston.test.ts` and
  `tests/unit/run-route.test.ts`).
- Cutover verification (all live, temp site address
  `https://javaquest.51.83.192.166.sslip.io`):
  - new key → `200`, java `15.0.2` listed; wrong key → `403`; no key
    → `403` (checked just after rotation, while the route was still
    public);
  - after the cutover, Level-1 starter-derived program through the
    site `/api/run` → `ok`, `Bolt is awake!` (Pass follows by the
    judge output-plus-token rule);
  - endless program → `time-cap` at the cap; socket connect →
    `Network is unreachable` (`runtime` class);
  - public `https://satyakisjava.bongbetic.com/api/v2/runtimes` →
    `503`, gateway FQDN null on both sub-applications (that was the
    #26 state; since #27 the same path answers the site's `404`).

## Configuration placement (secret values never enter the repo)

| Value | Runner side | Site side |
|---|---|---|
| `RUNNER_KEY` (the one secret) | Service env `SERVICE_PASSWORD_64_RUNNERKEY` (Coolify-generated slot, rotated in place), mirrored to service env `RUNNER_KEY`; interpolated into the gateway Caddyfile at startup | App env `RUNNER_KEY` (production + preview), server-side only — never `NEXT_PUBLIC_`, never baked into the image (`Containerfile` leaves it unset) |
| `RUNNER_URL` (plain config) | — | App env `RUNNER_URL=http://gateway-bx5d9mja928kdyg92od5jwtq:80` (production + preview) |

No secret value appears below, in `compose.yaml`, or anywhere in git.

## Rotate the key (operator runbook)

```sh
NEW_KEY="$(openssl rand -base64 48 | tr -d '\n')"   # 64 chars, no whitespace
# In Coolify (or via the Coolify MCP env_vars tool): set the new value on
#   service javaquest-piston: SERVICE_PASSWORD_64_RUNNERKEY and RUNNER_KEY
#   app javaquest-site: RUNNER_KEY (production and preview)
# Redeploy the service, then the app. Verify:
curl -s https://satyakisjava.bongbetic.com/api/v2/runtimes \
  -H "X-Runner-Key: $NEW_KEY"        # only while a public route exists;
                                     # internal-only: verify via the site /api/run
curl -s -o /dev/null -w '%{http_code}\n' \
  https://<runner-address>/api/v2/runtimes \
  -H "X-Runner-Key: <old-key>"       # expect 403
```

The key must not contain whitespace: it is interpolated into a
Caddyfile header-matcher line at gateway startup.

## Smoke tests (site-mediated, over the internal network)

```sh
SITE=https://javaquest.51.83.192.166.sslip.io
# 1. Starter-derived Level-1 program → ok + "Bolt is awake!" (Pass by judge rule)
curl -s -X POST $SITE/api/run -H 'Content-Type: application/json' \
  -d '{"program":"public class Main { public static void main(String[] a){ System.out.println(\"Bolt is awake!\"); } }"}'
# 2. Endless loop → time-cap at the cap, no hang
# 3. Socket connect → "Network is unreachable", no outbound network
```

Public refusal (from anywhere off the server):

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://satyakisjava.bongbetic.com/api/v2/runtimes
# expect 503 (no route) — never a runner response
```

Provisioning history (2026-10-31, superseded by #26): the runner was
first provisioned behind the public gateway above with a Coolify
generated key; smoke then showed 403 without key, Java 15.0.2 printing
42 in ~1 s, compile error with code 1, infinite loop SIGKILL at ~3 s,
and `Network is unreachable` on socket connect. That key and that
public route are retired by this ticket.

Observation for follow-up (not caused by #26, same Piston image and
caps as before): a live javac failure currently surfaces as class
`runtime` with the compiler text in stderr, where the stub-based
`compile` test uses `compile.code: 1`. Worth a classifier ticket if
the distinction matters to Cadets.

## Risks owned by parent

- The `piston` container is `privileged`. A sandbox escape means host root.
  The gateway key and Piston caps reduce exposure; they do not remove it.
- Uptime, disk (runtime packages in the piston data volume), and image updates
  are manual Coolify operations.
- Internal addressing depends on Coolify's generated container name
  (`gateway-<service-uuid>`) and the `connect_to_docker_network`
  attachment. If Coolify ever renames the container, update the site
  `RUNNER_URL` to match and redeploy the app (env-only change).
