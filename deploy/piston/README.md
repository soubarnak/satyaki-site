# Self-hosted Piston runner (Coolify)

Domain: `https://satyakisjava.bongbetic.com` — Java execution for JavaQuest (SRS IR-002).
Only the site Next.js run route (Coolify app) may call it, with header `X-Runner-Key`.

## Host prerequisites (check before deploy)

Run on the Coolify server:

```sh
uname -m                        # need x86_64
stat -fc %T /sys/fs/cgroup       # need cgroup2fs (cgroup v2); tmpfs = v1, Piston will fail
```

## Deploy record (done 2026-10-31 via Coolify MCP)

- Coolify project `JavaQuest`, service `javaquest-piston` (UUID in Coolify UI).
- Created from `compose.yaml`; gateway FQDN set to
  `https://satyakisjava.bongbetic.com:80` (port suffix = container port),
  then full service redeploy so Traefik picked up the route + TLS.
- Coolify generated the runner key as env `SERVICE_PASSWORD_64_RUNNERKEY`.
  Parent copies that value into the site app env `RUNNER_KEY` in Coolify.
- Java runtime installed once (image ships none):

```sh
curl -X POST https://satyakisjava.bongbetic.com/api/v2/packages \
  -H "X-Runner-Key: $RUNNER_KEY" -H 'Content-Type: application/json' \
  -d '{"language":"java","version":"15.0.2"}'
```

- Smoke results 2026-10-31: 403 without key; Java 15.0.2 prints 42 in ~1 s;
  compile error returned with code 1; infinite loop killed (SIGKILL, status
  TO) at ~3 s; socket connect fails "Network is unreachable".
- Rotate before production: the key transited the provisioning agent session.
  In Coolify env UI, regenerate `SERVICE_PASSWORD_64_RUNNERKEY`, redeploy the
  service, set the new value on the site app. No code change needed.

## Smoke tests

```sh
# 1. No key → 403
curl -s -o /dev/null -w '%{http_code}\n' https://satyakisjava.bongbetic.com/api/v2/runtimes

# 2. With key → java 15.0.2 listed
curl -s https://satyakisjava.bongbetic.com/api/v2/runtimes -H "X-Runner-Key: $RUNNER_KEY"

# 3. Run Java → prints 42
curl -s -X POST https://satyakisjava.bongbetic.com/api/v2/execute \
  -H "X-Runner-Key: $RUNNER_KEY" -H 'Content-Type: application/json' \
  -d '{"language":"java","version":"15.0.2","files":[{"content":"public class Main { public static void main(String[] a){ System.out.println(42); } }"}]}'

# 4. Infinite loop → killed at cap (3 s run), no hang
# 5. Network probe (Socket connect) → fails, no outbound network
```

## Risks owned by parent

- The `piston` container is `privileged`. A sandbox escape means host root.
  The gateway key and Piston caps reduce exposure; they do not remove it.
- Uptime, disk (runtime packages in `piston_data` volume), and image updates
  are manual Coolify operations.
