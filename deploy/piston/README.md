# Self-hosted Piston runner (hetzner1, internal-only)

Java execution for JavaQuest (SRS IR-002). Only the site Next.js run
route may call it, with header `X-Runner-Key`.

Since ticket #26 the runner is **internal-only**: it has no public DNS
name, no Caddy block, and no published host port. The public internet
cannot call Java execution directly. The site app reaches it over the
server network only.

## Deploy record (#26)

- Host `hetzner1`, directory `/srv/javaquest-runner/compose.yml`
  (from `compose.yaml` in this folder), podman only, per
  `bongbetic-infra/hetzner1.md`. No Coolify, no Traefik, no Docker.
- Internal runner address (plain configuration, not a secret):
  `http://javaquest-runner-gateway:80` — the gateway container name on
  the shared `edge` network. The site app (also on `edge`) uses this as
  its `RUNNER_URL`.
- Previous public gateway `https://satyakisjava.bongbetic.com` removed:
  DNS records deleted and no Caddy block created for it, in the same
  change that deployed the site (see #27). Public `curl` to the old
  address must fail (DNS resolution failure or connection refused),
  never a runner answer.
- Key rotated at cutover: the provisioning key (which transited an
  earlier agent session) was replaced on both sides and the services
  recreated. The old value returns `403 forbidden` from the gateway and
  surfaces to Cadets as `runner-unavailable`, never a Pass (locked by
  `lib/server/piston.test.ts` and `tests/unit/run-route.test.ts`).

## Configuration placement (secret values never enter the repo)

| Value | Runner side | Site side |
|---|---|---|
| `RUNNER_KEY` (the one secret) | `/srv/javaquest-runner/.env`, mode 600, read by `compose.yml` into the gateway env | Site app server env `RUNNER_KEY`, same value, server-side only (never `NEXT_PUBLIC_`, never baked into the image — `Containerfile` leaves it unset) |
| `RUNNER_URL` (plain config) | — | Site app server env `RUNNER_URL=http://javaquest-runner-gateway:80` |

No secret value appears below, in `compose.yaml`, or anywhere in git.

## Rotate the key (operator runbook)

```sh
ssh hetzner1
NEW_KEY="$(openssl rand -base64 48 | tr -d '\n')"
printf 'RUNNER_KEY=%s\n' "$NEW_KEY" > /srv/javaquest-runner/.env
chmod 600 /srv/javaquest-runner/.env
# Mirror the same value into the site app server env, then:
cd /srv/javaquest-runner && podman-compose up -d
# ... recreate the site app so it picks up the new env ...
# Old key must now fail:
curl -s -o /dev/null -w '%{http_code}\n' \
  http://javaquest-runner-gateway:80/api/v2/runtimes \
  -H "X-Runner-Key: <old-key>"   # expect 403
```

The key must not contain whitespace: it is interpolated into a
Caddyfile header-matcher line at gateway startup.

## Smoke tests (from the server, over the internal network)

```sh
# 1. No key → 403
podman run --rm --network edge docker.io/library/alpine:3.21 \
  wget -qO- http://javaquest-runner-gateway:80/api/v2/runtimes \
  2>&1 | head -1   # expect a 403 / forbidden answer

# 2. With key → java 15.0.2 listed
curl -s http://javaquest-runner-gateway:80/api/v2/runtimes \
  -H "X-Runner-Key: $RUNNER_KEY"

# 3. Run Java → prints 42
curl -s -X POST http://javaquest-runner-gateway:80/api/v2/execute \
  -H "X-Runner-Key: $RUNNER_KEY" -H 'Content-Type: application/json' \
  -d '{"language":"java","version":"15.0.2","files":[{"content":"public class Main { public static void main(String[] a){ System.out.println(42); } }"}]}'

# 4. Infinite loop → killed at cap (3 s run), no hang
# 5. Network probe (Socket connect) → fails, no outbound network
```

Public refusal (from any machine off the server):

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://satyakisjava.bongbetic.com/api/v2/runtimes
# expect: DNS failure or connection refused — never a runner response
```

Provisioning history (2026-10-31, superseded by #26): the runner was
first provisioned behind the public gateway above with a Coolify
generated key; smoke then showed 403 without key, Java 15.0.2 printing
42 in ~1 s, compile error with code 1, infinite loop SIGKILL at ~3 s,
and `Network is unreachable` on socket connect. That key and that
public route are retired by this ticket.

## Risks owned by parent

- The `piston` container is `privileged`. A sandbox escape means host root.
  The gateway key and Piston caps reduce exposure; they do not remove it.
- Uptime, disk (runtime packages in `piston_data` volume), and image updates
  are manual podman operations.
