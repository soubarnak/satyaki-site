# Research: Email OTP delivery and account database on Coolify

Status: research complete, 2026-11-04. Ticket: GitHub issue #32 (map #29).
Unblocks: #35 Decide auth, safeguarding, and session model; #36 Decide progress, stars, and save-code sync model.

## Question

> What delivers 6-digit email OTPs and stores accounts on the present
> Coolify family server at zero/low added cost? Cover: SMTP or
> transactional provider options and deliverability to school/parent
> inboxes, secret handling, OTP storage/expiry/rate limits, and
> database choice (managed Postgres, SQLite, or other) for users,
> per-language code, stars, and progress. Recommend one stack with
> migration path.

## Recommendation in one paragraph

Send OTP mail through a transactional provider API over HTTPS —
Resend on its free tier first (3,000 emails/month, 100/day, $0 as of
2026-11-04, [resend.com/pricing](https://resend.com/pricing)) — from a
verified sending subdomain with SPF, DKIM, and DMARC all published;
store accounts, OTP hashes, sessions, per-language code, stars, and
progress in a Coolify one-click PostgreSQL database on the existing
`bongbetic` server, reached from Next.js route handlers via
`pg` (node-postgres) with Drizzle migrations, OTPs stored only as a
keyed hash with the locked 10-minute expiry, single use, strict
attempt and resend limits, and Coolify scheduled `pg_dump` backups to
S3-compatible storage. Self-hosted SMTP is rejected: outbound mail
ports are blocked by default on mainstream cloud hosts and a single
family-server IP has no sender reputation, so OTPs to parent and
school inboxes would be the first thing filtered. The fallback is
Amazon SES ($0.10 per 1,000 outbound emails, à la carte,
[aws.amazon.com/ses/pricing](https://aws.amazon.com/ses/pricing/))
behind the same one-function `sendOtpEmail()` seam in `lib/server/` —
an env-and-DNS swap, not a rewrite — with SQLite on a Coolify volume
as the database fallback only if a Postgres resource proves
unavailable.

## Grounding

Current state, verified by reading the files on 2026-11-04:

- Next.js `16.4.3`, React `19.3.0`, TypeScript `^5`; dependencies are
  only `next`, `react`, `react-dom` — no database, no auth, no email
  code, no Three.js/Monaco/Pyodide yet (`package.json`).
- `next.config.ts` uses `output: "standalone"`; the production image
  is built from `Containerfile` with podman, never Docker
  (`podman build -f Containerfile -t javaquest-site .`), runs as
  non-root user `javaquest`, and deliberately leaves `RUNNER_URL` /
  `RUNNER_KEY` unset in the image — both are server-side Coolify
  configuration, never `NEXT_PUBLIC_` (`Containerfile`,
  `lib/server/env.ts`). This is the established secret pattern to
  extend.
- Progress today is one `localStorage` JSON record; total points are
  derived, never stored; every field is sanitised on load
  (`lib/progress.ts`, `lib/progress-storage.ts`,
  `docs/adr/0006-progress-storage-schema.md`). An in-memory
  sliding-window rate limiter already exists server-side, keyed by
  SHA-256 hashes of client IPs (`lib/server/rate-limit.ts`).
- The Piston runner is internal-only on the shared `coolify`
  network behind a key-checking gateway; cost observed at deploy
  time was zero added hosting cost on the existing server
  (`deploy/piston/README.md`, `deploy/piston/compose.yaml`).
- Coolify live state (MCP overview, 2026-11-04): one server
  `bongbetic` (reachable), `javaquest-site` running healthy at
  `https://satyakisjava.bongbetic.com`, JavaQuest project present,
  **zero standalone databases exist today** — the account database
  is greenfield.

Destination facts that drive the answer (map #29, locked): register
with email + password, log in with username; email verification is a
6-digit OTP with 10-minute expiry; the account is source of truth
when logged in; `localStorage` plus export/import save code is the
logged-out fallback; ages 10–13; per-language (Python + Java) code,
stars, and progress must sync. Ticket #30 already decided the
execution side; this ticket owns only delivery + storage. Auth
library, session shape, and safeguarding rules belong to #35;
star/sync semantics belong to #36. What follows is the data-layer
and delivery decision those tickets build on.

## Email delivery: self-hosted SMTP vs transactional provider

### Why not send from the family server itself

Direct sending needs outbound TCP 25 to receiving mail servers, a
clean IP reputation, matching forward/reverse DNS (PTR), and
published SPF/DKIM/DMARC. Two primary sources close this door at
zero effort budget:

- Hetzner states it blocks ports 25 and 465 by default on all
  cloud servers; unblocking needs one month as a customer, a paid
  first invoice, and a case-by-case limit request; port 587 to
  *external mail delivery services* is not blocked
  ([docs.hetzner.com/cloud/servers/faq](https://docs.hetzner.com/cloud/servers/faq/)).
  Whether the present `bongbetic` host is Hetzner Cloud was not
  verified (see Unverified), but the policy is industry-typical,
  and even with port 25 open the remaining problems below stand.
- Google's sender guidelines require, for **all** senders to Gmail:
  SPF or DKIM authentication, valid forward and reverse DNS, TLS
  transmission, and spam rate below 0.3%; senders over 5,000/day
  must add DMARC and both SPF and DKIM
  ([support.google.com/mail/answer/81126](https://support.google.com/mail/answer/81126?hl=en)).
  SPF itself is the mechanism by which a domain "explicitly
  authorize[s] the hosts that are allowed to use their domain
  names" ([RFC 7208](https://www.rfc-editor.org/rfc/rfc7208.html)).
  A fresh single-IP sender satisfies the DNS paperwork yet still
  starts with no reputation; school and parent inboxes are exactly
  the inboxes where an unknown sender's "your code is 123456" mail
  dies silently. Running Postfix/Exim, DKIM signing, PTR, bounce
  handling, and blocklist monitoring on the same box that serves
  the site also puts the learner domain's reputation one incident
  away from collateral damage.

A transactional provider inverts this: the app makes one outbound
HTTPS call (or SMTP submission on 587) and the provider owns IPs,
queues, retries, bounce/suppression handling, and DKIM signing.
Postmark's pricing page, for example, lists "High quality, vetted
IPs" and "DKIM, SPF, DMARC Authentication" as plan features
([postmarkapp.com/pricing](https://postmarkapp.com/pricing)) — the
shape every candidate below shares.

### Candidates, official pricing as of 2026-11-04 (USD, ex-tax)

| Provider | Free tier (official page) | First paid step | Notes |
| --- | --- | --- | --- |
| [Resend](https://resend.com/pricing) | $0 — 3,000 emails/mo, **100/day cap**, 3 domains, 30-day retention | Pro $20/mo for 50,000/mo, no daily limit | Recommended start. Daily cap is the one launch-day risk (below). |
| [Brevo](https://www.brevo.com/pricing/) | $0 — "up to 300 emails per day" once the account is approved for sending; transactional via REST API or SMTP on all plans | Paid tiers on same page | Highest free *daily* allowance found. Credible swap-in if 100/day bites. |
| [Amazon SES](https://aws.amazon.com/ses/pricing/) | No permanent free sending tier on the current pricing page; new AWS accounts get up to $200 Free Tier credits (free plan 6 months, credits usable within 12 months) | $0.10 / 1,000 outbound emails (à la carte) + $0.12/GB attachments; the same page lists tiered monthly-plan rates above $0.10 at low volumes — confirm the applicable rate at adoption | Cheapest at any real volume; most setup burden (AWS account, identity verification). Named fallback. |
| [Postmark](https://postmarkapp.com/pricing) | $0 — 100 emails/mo developer plan, never expires | Basic $15/mo for 10,000/mo | Reputation-focused, but free tier is test-only and first paid step costs more per email than Resend/SES. Not chosen. |

Volume reality check: OTP mail is bounded by registrations plus
resends (and later password resets — #35 owns that flow). One
classroom of ~30 cadets registering inside one lesson, with a
resend each, is ~60 emails — inside Resend's 100/day free cap;
two such classes on one day, or a public launch spike, is not.
That arithmetic, not deliverability, is the free tier's binding
constraint, and it is why the provider must sit behind an interface:
`sendOtpEmail({ to, code })` in `lib/server/`, one implementation
per provider, chosen by env. Migration Resend → SES/Brevo then is:
new provider account, publish its SPF include + DKIM CNAMEs on the
same sending subdomain, swap `EMAIL_API_KEY` in Coolify, redeploy.
No code path, template, or OTP logic changes.

Deliverability practices that hold for any provider: send from a
dedicated subdomain (e.g. `send.bongbetic.com`) so OTP reputation
never touches the root domain; publish SPF **and** DKIM **and** a
DMARC record from day one even though Google only mandates all
three above 5,000/day; keep the OTP email plain, short, and
single-purpose (subject naming the site, code in the first line, no
marketing content, no link farm); use a human-recognisable From
name. No provider publishes a verifiable deliverability percentage
for school filters, so none is claimed here.

## OTP storage, expiry, and rate limits

Per the OWASP Multifactor Authentication Cheat Sheet, OTPs "are
authentication secrets and should be handled with password-like
hygiene"; at minimum an implementation SHOULD enforce a short TTL,
ensure single use, apply strict attempt limits, and invalidate on
success, and SHOULD NOT log OTP values or store them long-term in
plaintext; on resend, generate a new OTP and overwrite the old
record; generation must use a cryptographically secure RNG. OWASP
recommends hashing OTPs at rest while warning that a 6-digit code
has "~1 million possibilities", so a plain hash gives little
offline-attack resistance — hashing protects against accidental
disclosure and shrinks the blast radius of a brief database
exposure during the validity window
([cheatsheetseries.owasp.org — Multifactor Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)).

Concrete data-layer design handed to #35 (values marked ◂ are
proposals of this research, not sourced constants):

- Table `email_otps(id, user_id, code_hash, purpose, expires_at,
  attempts, consumed_at, created_at)`. One active row per
  (user, purpose): a resend deletes/replaces the prior row per
  OWASP.
- Code = `crypto.randomInt(0, 1_000_000)`, zero-padded to 6
  digits. At rest store `HMAC-SHA256(code, OTP_PEPPER)` — a keyed
  hash, so a database-only leak cannot be brute-forced over the
  1M space without the server secret; compare in constant time.
  Plaintext exists only in the outbound email and request memory;
  never logged (Coolify already redacts env values in logs by
  default — see Secrets — but the code must not log the OTP
  itself).
- `expires_at = created_at + 10 minutes` (locked). Verification
  rejects expired, consumed, or superseded codes identically;
  success sets `consumed_at` and `users.email_verified_at` in one
  transaction, then the code can never verify again.
- Attempts: increment on every wrong code; invalidate the row at
  ◂5 failed attempts (child must request a new code). Resend:
  ◂60-second cooldown, ◂max 5 sends per email per hour and a
  per-IP hourly cap, enforced with database counts (durable
  across restarts) and complemented by the existing hashed-IP
  in-memory limiter pattern (`lib/server/rate-limit.ts`).
  Expired/consumed rows are pruned by a scheduled delete (Coolify
  scheduled task or lazy delete on next issue — #35 picks).
- Responses stay generic ("if that email can register, a code is
  on its way") so the endpoint does not enumerate accounts; the
  kid-facing wording is #35's.

## Database choice: Coolify Postgres vs SQLite vs other

### Coolify one-click PostgreSQL — chosen

Coolify deploys each standalone database as a container with
generated credentials, a persistent data volume, an internal
connection URL, and health checks; PostgreSQL is listed for
"relational data, extensions, and transactional workloads" with
scheduled backups and dashboard restore, backups being
engine-native dumps uploadable to S3-compatible storage — while
"you still own server security and regular restore tests"
([coolify.io/docs/databases](https://coolify.io/docs/databases)).
The PostgreSQL resource defaults to internal port `5432`, image
PostgreSQL 18 (`postgres:18-alpine`; 17/16 also selectable),
username/database `postgres`, and Coolify advises keeping private
networking and not exposing `5432` publicly
([coolify.io/docs/databases/postgresql](https://coolify.io/docs/databases/postgresql)).
The Postgres resource must be created on the same Coolify
destination as `javaquest-site` so the app reaches it via its
internal URL over that private destination network (distinct
from the shared `coolify` network the Piston gateway uses via
`connect_to_docker_network`, `deploy/piston/compose.yaml`):
zero new hosts, zero new paid services, one new container on
`bongbetic`.

Why it fits this workload: accounts, OTPs, sessions, and
progress are small relational rows with uniqueness constraints
(username, email) and concurrent classroom writes (30 cadets
saving code and passing levels inside the same minute). Postgres
gives row-level concurrency, transactions for "verify OTP +
mark verified + open session" atomicity, and `pg_dump` backups
with dashboard restore. Driver layer for Next.js 16 route
handlers on Node ≥20.9: `pg` (node-postgres) supports pooling,
promises/async-await, transactions, and "all current and LTS
versions of node" ([node-postgres.com](https://node-postgres.com/)).
Put Drizzle ORM over it for a typed schema and checked-in
migrations; Drizzle's PostgreSQL getting-started path supports
the node-postgres driver directly
([orm.drizzle.team/docs/get-started-postgresql](https://orm.drizzle.team/docs/get-started-postgresql)).
Plain `pg` + SQL migration files is an acceptable thinner
alternative; either way the data layer lives behind repository
functions in `lib/server/db/`, and the auth library decision
(#35) consumes those, not raw tables. Local development uses
podman, never Docker: `podman run --name jq-db -e
POSTGRES_PASSWORD=dev -p 127.0.0.1:5432:5432
docker.io/library/postgres:18-alpine` (image line per Coolify's
default; pin by digest as the Containerfile already does for
Node).

### SQLite — assessed, kept as fallback

SQLite's own guidance: it "works great" for low-to-medium
traffic websites ("any site that gets fewer than 100K hits/day
should work fine"), but a client/server engine works better for
many network clients, write-intensive or multi-server sites, and
high concurrency ([sqlite.org/whentouse](https://www.sqlite.org/whentouse.html)).
WAL mode lets readers and one writer proceed concurrently but
all processes must be on the same host and it does not work over
a network filesystem ([sqlite.org/wal](https://www.sqlite.org/wal.html)).
On Coolify specifically, SQLite support is **experimental**:
apps reach the files through a volume mount (no connection URL)
and "the application must run as user `65532` or root to access
the files" ([coolify.io/docs/databases/sqlite](https://coolify.io/docs/databases/sqlite))
— which conflicts with the shipped image's non-root `javaquest`
user (`Containerfile`). The DIY variant (SQLite file on an app
Persistent Storage volume) is legitimate — Coolify mounts data
outside the replaceable container at a chosen destination path —
but Coolify is explicit that "persistent storage is not a
backup" and storage is local to the one server
([coolify.io/docs/applications/configuration/persistent-storage](https://coolify.io/docs/applications/configuration/persistent-storage)).
SQLite would work for launch scale; it loses on experimental
Coolify support, single-writer serialisation of classroom save
bursts, preview/prod file separation, and having to hand-roll
what Postgres backups already give. It remains the fallback:
same repository interface, Drizzle also speaks SQLite, file on
a named volume at e.g. `/app/data/app.db` in WAL mode.

### Other options, briefly

MySQL/MariaDB/MongoDB are also Coolify one-click resources with
scheduled backups ([coolify.io/docs/databases](https://coolify.io/docs/databases))
but offer nothing this schema needs over Postgres. Hosted
databases (Neon/Supabase etc.) add an external dependency, a
second account holding children's data, and egress latency for
zero benefit while the existing family server already runs the
app (whether it has CPU/RAM/disk headroom for one more small
Postgres container is unchecked — see Unverified).
Redis/KeyDB/Dragonfly have no scheduled backups in Coolify and
are the wrong shape for accounts; a cache is not needed at this
scale (the in-memory limiter already covers the one hot path).

### Schema sketch (data layer only — #36 owns semantics)

```
users(id uuid pk, username citext unique, email citext unique,
      password_hash text, email_verified_at timestamptz null,
      created_at, updated_at)
email_otps(id, user_id fk, purpose, code_hash, expires_at,
      attempts int, consumed_at null, created_at)
sessions(...)                     -- shape owned by #35
level_progress(user_id fk, level_id int, language text
      check (language in ('python','java')),
      passed bool, stars smallint 0..3, best_code text,
      updated_at, pk (user_id, level_id, language))
saved_code(user_id fk, slot text, language, code text,
      updated_at, pk (user_id, slot, language))  -- playground/arena drafts
```

Per-language rows (not per-language columns) keep Python and
Java progress independent, matching the locked dual-language
model; `best_code`/`code` are bounded text (cap enforced in the
route handler). Totals stay derived where ADR-0006 derived
them; whether stars are stored or derived is #36's call. The
logged-out `localStorage` record and export/import save code
remain untouched; first login merges/uploads local progress
per the sync rules #36 decides.

## Secret handling

Extend the existing `RUNNER_KEY` pattern exactly:

- New server-only env on the `javaquest-site` Coolify app:
  `DATABASE_URL` (Postgres URL internal, copied from the
  database resource), `RESEND_API_KEY` (or provider equivalent),
  `OTP_PEPPER` (`openssl rand -base64 48`, mirroring the runner
  key rotation runbook in `deploy/piston/README.md`), plus
  whatever session secret #35 names. None carry `NEXT_PUBLIC_`;
  none are baked into the image (`Containerfile` leaves secrets
  unset today — keep it that way).
- Coolify env vars distinguish build-time vs runtime scope
  (defaults both `true`; set secrets `buildtime=false` so they
  never enter build layers), production and preview have
  separate values — preview must get its **own** database and
  its own email key/sandbox domain, never production data — and
  "Hide all values" log redaction is the default, with locked
  values getting stricter matching
  ([coolify.io/docs/applications/configuration/environment-variables](https://coolify.io/docs/applications/configuration/environment-variables)).
  Shared-variable references (`{{environment.X}}`) exist if a
  second resource later needs the same value. Rotation follows
  the runner precedent: set new value in Coolify on every holder,
  redeploy, verify old value fails.
- The Postgres password is Coolify-generated at resource
  creation and lives only in Coolify + the app's `DATABASE_URL`;
  the resource stays on private networking, port `5432` never
  published. Passwords are hashed with a memory-hard KDF
  (algorithm choice is #35's); the database only ever stores
  hashes for passwords and OTPs alike.

## Migration path

1. **Now → accounts launch:** create the Coolify PostgreSQL
   resource in the JavaQuest production environment; add
   `pg` + Drizzle; migrations checked into the repo and applied
   on deploy; `localStorage` fallback untouched, so a database
   outage degrades to today's behaviour for logged-out play.
2. **Email growth:** Resend free → Resend Pro ($20/mo) or swap
   to SES/Brevo behind `sendOtpEmail()`; DNS-only + env-only
   change (above).
3. **Host move:** Coolify **Import backup** restores a `pg_dump`
   into a new resource; rebuild the app from the same
   `Containerfile` with podman on the new host and repoint
   `DATABASE_URL`. User-level portability already exists via
   export/import save codes.
4. **Scale beyond one server:** Postgres is the portable asset —
   the same dump restores into any managed Postgres; SQLite
   would have made this step a data conversion instead.

## Unverified — do not plan against as facts

- Free CPU/RAM/disk headroom on `bongbetic` for one more small
  Postgres container: no utilisation metrics were read. Check
  before creating the database resource; the recommendation
  assumes a small Postgres fits comfortably but does not
  evidence it.
- Whether the `bongbetic` server is Hetzner Cloud, and the
  actual port 25/465 state of its account: no host-provider
  document for this server was read and no outbound-25 probe was
  run. The Hetzner FAQ is cited as the typical cloud policy; the
  recommendation does not depend on it.
- Amazon SES initial sandbox limits and production-access
  approval process/timing: not read from an AWS primary page in
  this pass.
- Any deliverability percentage for Resend/Brevo/SES/Postmark,
  and school mail-filter behaviour specifically: no primary
  source publishes verifiable figures; school allowlisting
  requests may still be needed operationally.
- Expected registration volume per day at launch (drives the
  Resend 100/day free-cap risk): unknown; treat the provider
  swap as a same-day operational lever, not an afterthought.
- Prices are USD list prices from official pages as of
  2026-11-04, excluding tax and any INR/card conversion.
- S3-compatible backup destination cost: no destination exists
  yet (zero databases on the instance) and no storage provider
  page was priced; local-only backups are a single-disk risk
  until one is chosen.
- OTP attempt (5), resend cooldown (60s), and hourly caps (5/hr)
  are this research's proposed starting values, not sourced
  constants; #35 should tune them with the safeguarding model.
- `better-sqlite3` and Prisma specifics were not inspected;
  only `pg` and Drizzle primary docs were read for the driver
  recommendation.

## Implications for downstream tickets

### #35 Decide auth, safeguarding, and session model

Hands it: the delivery provider and swap seam, the
`email_otps` design (hashed, single-use, 10-minute, attempt/
resend limits), the `users` table shape, the secret inventory
and Coolify placement, and the rule that preview never touches
production data or sends production email. #35 still owns: auth
library vs hand-rolled (consuming `lib/server/db/` either way),
password hashing algorithm and policy, session/token shape and
lifetimes, username-login mechanics after email+password
registration, password-reset flow (reusing `purpose` on
`email_otps`), parental-consent/safeguarding rules for ages
10–13, and tuning the proposed OTP limits.

### #36 Decide progress, stars, and save-code sync model

Hands it: per-(user, level, language) progress rows and
per-language saved-code storage in Postgres, transactional
writes for pass+stars+code landing together (the server-side
echo of ADR-0006's one-key write), and scheduled dump backups.
#36 still owns: whether stars are stored or derived, merge
rules when local `localStorage` progress meets an account
(first-login upload, conflict winner), offline write queueing,
export/import save-code format evolution, and code-size caps
per slot.

## Sources

Primary, fetched 2026-11-04: [Coolify Databases](https://coolify.io/docs/databases) ·
[Coolify PostgreSQL](https://coolify.io/docs/databases/postgresql) ·
[Coolify SQLite](https://coolify.io/docs/databases/sqlite) ·
[Coolify Environment Variables](https://coolify.io/docs/applications/configuration/environment-variables) ·
[Coolify Persistent Storage](https://coolify.io/docs/applications/configuration/persistent-storage) ·
[Hetzner Cloud servers FAQ](https://docs.hetzner.com/cloud/servers/faq/) ·
[Resend Pricing](https://resend.com/pricing) ·
[Amazon SES Pricing](https://aws.amazon.com/ses/pricing/) ·
[Brevo Pricing](https://www.brevo.com/pricing/) ·
[Postmark Pricing](https://postmarkapp.com/pricing) ·
[OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) ·
[Google Email sender guidelines](https://support.google.com/mail/answer/81126?hl=en) ·
[RFC 7208 (SPF)](https://www.rfc-editor.org/rfc/rfc7208.html) ·
[SQLite: Appropriate Uses](https://www.sqlite.org/whentouse.html) ·
[SQLite: Write-Ahead Logging](https://www.sqlite.org/wal.html) ·
[node-postgres](https://node-postgres.com/) ·
[Drizzle ORM — PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql).
Repo files read: `package.json`, `Containerfile`,
`next.config.ts`, `lib/server/env.ts`, `lib/server/rate-limit.ts`,
`lib/progress.ts` (via search), `deploy/piston/README.md`,
`docs/adr/0006-progress-storage-schema.md`. Live Coolify overview
via MCP, 2026-11-04.
