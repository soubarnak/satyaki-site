# Satyaki Space Coder — Implementable Spec (v2 platform)

**Status:** Handoff spec, assembled 2026-11-05 from
[Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)
(map #29) by
[Write spec and chart build-ticket DAG (handoff)](https://github.com/soubarnak/satyaki-site/issues/46).
**Audience:** the builder starting the rework. No open decision on
map #29 blocks starting; the two gated slices are named in §12.

## 1. Destination and scope

Rework the site at `satyakisjava.bongbetic.com` in place into
**Satyaki Space Coder**: a dual-language (Python 3 and Java) 3D space
coding platform for Cadets aged 10–13. Twenty-five Missions in five
Planets, each Planet closed by a Boss Gate, plus Playground and
Arena. Accounts with synced progress; logged-out play everywhere
except Arena. The whole site becomes a 3D game; the old site's
layout, look, and structure carry over by default in nothing.

In scope: everything in §§3–11. Out of scope for v1: school/class/
teacher admin, parent dashboards and parent accounts, native mobile
apps, re-hosting or URL change, public gallery, leaderboard, prizes,
spendable Stars, drag-drop world editor, per-Seed authored layouts.
Domain words are fixed by `GLOSSARY.md`; mechanics by ADR-0011 to
ADR-0015. This spec does not reopen them.

Content itself (every Mission's layout, checks, Par, hints, Rosetta
Pair, Boss Gate items) is **not** in this spec. It is the destination
of the separate map
[Satyaki Space Coder — way to 25-Mission content pack spec](https://github.com/soubarnak/satyaki-site/issues/48),
whose Planet documents plug into the schema in §8. Platform build
starts without it; only content integration waits for it (§12).

## 2. Decision index

Every rule below traces to exactly one source. Gists only; the
source is canonical.

| Area | Source |
|---|---|
| Java in browser: bounded Cadet Java TS interpreter over `java-parser` in a Web Worker; Piston fallback/CI oracle | Issue #30, branch `research/java-execution-in-browser` |
| Python: self-hosted pinned Pyodide 314.0.7 in a lazy module Web Worker, `sys.settrace` trace, layered guard | Issue #31, branch `research/python-pyodide-web-worker` |
| OTP delivery + DB: Resend free tier behind `sendOtpEmail()` seam; Coolify one-click Postgres, `pg` + Drizzle | Issue #32, branch `research/email-otp-account-db-coolify` |
| Monaco/R3F cost: heavy JS only on Mission route; home is prerendered 2D; budgets in §10 | Issue #33, branch `research/monaco-r3f-school-hardware` |
| Domain language, ages 10–13, World-State Pass | `GLOSSARY.md`, ADR-0009 |
| Auth, safeguarding, sessions | Issue #35 (constants in §7) |
| Progress record v2, merge, Save Code | ADR-0010 (plus ADR-0014 extensions, §6) |
| Mission content schema, Boss Gate shape | ADR-0011 |
| Ship API (20 names), World State, Seeds | ADR-0012 |
| Grader, Stars, Seed counts, feedback, trust | ADR-0013 |
| Cockpit layout: Variant C, Theatre + drawer | Issue #38, branch `prototype/cockpit-38` |
| Home map: Variant A, Orbit system | Issue #39, branch `prototype/home-map-39` |
| Level 2 v1 bug: starter tail prints `moons` twice | Issue #40 (fix in DAG ticket B17) |
| Branding: hosted URLs only, never commit brand files | Issue #41 (§11) |
| Debugger: Variant A, Line scrubber, frame shape | Issue #44, branch `prototype/debugger-44` |
| Playground, Share Links, Arena | ADR-0014 |
| Skill Radar, Daily Recall Drill | ADR-0015 |

Still-valid v1 record: ADR-0001 (Next.js 16.4.3 exact pin),
ADR-0002/0003/0005 (Piston run route, kept as fallback/oracle).
Superseded for v2: ADR-0004 (server-only error classes; client runs
need the kid-error translator, §5), ADR-0006 (by ADR-0010),
ADR-0007 routes/module names (by §3; its pure-core/test-seam
principles stand), ADR-0008 (v1 visual direction; v2 direction is
the three prototypes above — its WCAG AA duty stands).

**Unverified — never plan against as facts** (from #30–#33):
school-Chromebook timings of any runtime; slim-Monaco exact gzip
(measure at first cockpit build); CheerpJ sizes/stepping; Pyodide
`settrace` overhead; COOP/COEP side effects on Coolify;
`bongbetic` server headroom for Postgres (check before creating);
Resend volume vs the 100/day free cap.

## 3. Architecture

Next.js 16.4.3 (exact pin, ADR-0001), React 19, TypeScript, App
Router, deployed on the present Coolify server at the present URL.
Podman/Containerfile only, never Docker.

### Routes

| Route | Holds |
|---|---|
| `/` | Orbit home map (Variant A): prerendered SVG orbits, Planet panel, Daily Recall Drill card, Skill Radar summary. Zero three/monaco JS. |
| `/missions/[slug]` | Mission cockpit (Variant C) and Boss Gate flow; slug is the permanent Mission slug (ADR-0011). |
| `/playground` | Playground: builder, templates, Creations, Challenge play; `#c=` Share Link landing. |
| `/arena` | Arena battles; Account-only, sign-in prompt when logged out. |
| `/progress` | Skill Radar (full), streak, Hangar, Save Code export/import. |
| `/register`, `/login`, `/verify`, `/reset` | Auth flows of §7. |
| `/api/auth/*`, `/api/progress` | Route handlers over Postgres (§§6–7). Node runtime. |
| `/api/run` | Existing Piston route, demoted to fallback/CI oracle only. |

### Pure core (`lib/`, no framework, DOM, or worker imports)

- `ship-sim`: the one deterministic TypeScript Ship simulation
  (ADR-0012), synchronous JSON-shaped methods, instantiable in a
  worker. Seed generator lives here.
- `content`: Planet/Mission/Boss Gate types and data modules (§8).
- `grader`: Pass checks, Stars, Seed grading, result shape (§5);
  includes the Star 3 AST/CST concept check per language.
- `progress`: v2 record, sanitise, per-field merge, derived
  unlocks/totals/streak, Save Code codec (§6).
- `radar`: Skill Radar scoring and Daily Recall Drill selection
  (ADR-0015), derived on read.
- `playground`: builder validation, goal checks, Share Link codec.
- `arena`: wave/tick battle engine over World State snapshots.
- `trace`: frame folding/replay (state at frame = initial World
  State folded with `shipDelta`s to that frame; no undo state).
- `kid-errors`: shared error translator; every runtime, builder,
  and import failure surfaces through it (§5).

### Workers and rendering

- One module Web Worker per language, created lazily on first
  Mission entry, never on `/`. The Ship sim is instantiated
  **inside** the worker; Ship calls are in-worker synchronous calls
  appending `shipDelta` to the current trace event. The main thread
  only replays trace events into the 3D view.
- Python worker: Pyodide 314.0.7 self-hosted same-origin under a
  versioned path, immutable caching, versioned service-worker
  precache for offline; stdlib only, no `micropip`.
- Java worker: Cadet Java interpreter over `java-parser` CST.
  Subset scope is bounded by the Planet concepts and the ADR-0013
  Star 3 mapping (loop, conditional, function, list) plus variables,
  arithmetic, and Ship/snapshot field access (ADR-0014); the build
  ticket pins the grammar as its first deliverable against
  ADR-0011 starter shapes — no full-Java promise.
- Editor/simulator: slim Monaco (`editor.api` + Python/Java basic
  languages, exactly one `editor.worker`, self-hosted) and three +
  React Three Fiber behind separate `next/dynamic`, `ssr: false`,
  WebGL2-gated boundaries, Mission route only. Drei per-component
  only. Cockpit Variant C: briefing top strip, editor left, wide
  simulator right, collapsible console drawer below.

## 4. Ship, World State, and trace (ADR-0012)

Discrete integer grid: `x` east, `z` north, `y` up; headings
`north/east/south/west`; default bounds 12×12×5, shrinkable, max
16×16×6. Closed entity vocabulary: `asteroid_cracked`,
`asteroid_titanium`, `crystal`, `switch`, `gate` (`linkId`),
`wormhole` (`pairId`), `drone`. Blocked moves spend step + energy,
record `blocked: true`, never fatal. Costs: move/turn/ascend/
descend/harvest/shield 1, laser 2, sensors/`log` 0. The 20-name
Ship API table (Python `snake_case`, Java `camelCase`, same meaning
and argument order) in ADR-0012 is complete for v1.

Grader-readable World State snapshot:
`{ship:{x,y,z,heading,energy,shield,crystals,stepsUsed},
entities:{<id>:{type,x,y,z,...state}}, bounds:{maxX,maxY,maxZ}}`.
`statePath` reads e.g. `ship.crystals`,
`entities.crystal-1.collected`.

Trace: run header `{initial:{ship,entities}, bounds}` plus one
event per executed line `{step, line, kind, locals, shipDelta}`
(`log` text on a `log` field; `step` counts Ship actions only;
`shipDelta` null on non-Ship lines). Error frame:
`{kind:"error", line, excType, message}`; World State at stop stays
readable. Hidden Seeds relocate only crystals, cracked asteroids,
and drone starts via one deterministic PRNG (100-resample cap, then
authored fallback flagged by build test).

Playback (issue #44, Variant A): frame = one executed line; play/
pause, step forward/back, reset, 1x = 650 ms/frame, 2x/4x; gold
ticks mark Ship steps; manual cameras Top-down (default), Chase,
Free orbit, no auto-switching; coordinate HUD plus hover inspection
of any cell. Step-back is pure re-fold; no undo state.

## 5. Runs, grading, and errors (ADR-0013)

One Run press grades the exact editor snapshot in the active
language across every Seed (practice first). Caps per Seed: 500
Ship steps, 500 trace events, 3 s wall clock (worker layers:
in-harness guard, interrupt buffer only where cross-origin
isolation is verified, `Worker.terminate()` + respawn backstop).
Result shape: `{pass, stars, parMet, conceptMet, stopReason,
checks}`; `stopReason` ∈ `none|error|step-cap|event-cap|time-cap`.

- **Star 1 (Pass):** every `final` (program end only) and
  `intermediate` (step 0 and after every Ship action) check passes
  on every Seed. Comparators `eq|ne|gte|lte`, one JSON scalar;
  unresolvable `statePath` fails the check, never crashes. Code
  text/stdout never affect Star 1; any valid logic passes.
- **Star 2:** Star 1 plus practice-Seed `stepsUsed <= par.maxSteps`
  and energy spent `<= par.maxEnergy`.
- **Star 3:** Star 1 plus an executed Cadet-written Planet-concept
  construct in the editable region (closed loop/conditional/
  function/list mapping, ADR-0013) on the practice Seed. Never
  blocks Star 1/2. Stars stack 1+1+1.
- **Seed counts** (practice included): intro 2, core 3, stretch 4;
  Boss Part B 3, no Stars/Par/concept.
- **Feedback:** failed check labels grouped by timing; practice
  intermediate failures may name first failing step; hidden Seeds
  expose per-check booleans only, plus the one fixed
  anti-hardcoding line after a practice-only pass. Post-Pass:
  Par numbers and Planet concept name for missed Stars. Hints
  never reduce Stars. Only the practice trace returns for playback.
- **Trust:** browser grading is authoritative in v1; the server
  stores reported Pass/Stars without re-grading (no prizes, no
  public leaderboard).
- **Kid errors:** unknown Ship name, wrong argument count,
  builder-after-action, unknown colour, runtime errors, and caps
  all stop (or waste, in Arena) with a kid sentence naming the
  line, produced by the one translator in `lib/kid-errors`.
  Exact wording is build work; classes and surfaces are fixed.

Boss Gate: Part A five authored quiz items (`choice`, `spot-bug`,
`predict-state`), 4/5 passes, unlimited retries, gates Part B.
Part B is one coding challenge under Mission run/grader rules with
no Stars. Boss Gates store passed flag, attempts, last attempt
(ADR-0010).

## 6. Progress, sync, radar, drill (ADR-0010, ADR-0014, ADR-0015)

One v2 record shape shared by Postgres, `localStorage`, and Save
Code. Stored: per Mission per language draft (max 32,768 chars,
`updatedAt`) and passing code (replaced only by more Stars; equal
Stars, newer wins); per Mission best Stars per language, Run/Pass
counts, hints used, first/last Pass times, last language; per
Planet Boss Gate flag/attempts/last attempt; streak dates (Mission
Run days, newest 400); equipped Hangar cosmetics; local-only owner
tag (`guest` or Account id). ADR-0014 extensions: Creations (max
20, `c_` + 12 base36 id, title/world/goals/per-language drafts/
`updatedAt`) and Arena record (played, won, best wave, last
language). Save Code carries Creations too.

Derived, never stored: Mission Stars (best across languages),
total Stars (max 75), linear unlocks (Mission → previous Pass;
Boss Gate → five Passes; next Planet → Boss Gate), Hangar unlocks
(thresholds, never spent; catalogue gated, §12), current streak
(survives until one full day missed), Skill Radar.

Merge (one rule for login, Save Code import, multi-device):
Passes/Stars/Boss Gates/streak dates union, higher Stars win,
never downgrade; drafts per Mission+language by `updatedAt`;
Creations by id, newest whole-Creation wins. Login merges only a
`guest` or same-Account local record; a different Account replaces
locally. Save Code: `SSC2.` + base64url(gzip(versioned JSON)) +
short checksum; import previews gains, rejects unknown version or
decoded payload over 2 MiB whole, drops single malformed entries,
applies only on confirm. QR only when it fits.

Sync timing: local autosave 800 ms idle; logged-in sync 3 s idle
and on Run, Pass, page leave; offline queue merges on reconnect.
v1 passes do not convert; v1 streak dates carry over.

Skill Radar: five Planet axes 0–100, always rendered; Mission
contributes best-Stars/3, Planet score is the mean × 100 rounded;
counts/hints/times never score; never decays; derived on read.

Daily Recall Drill: one optional Passed-Mission replay per local
day, pool from the day after Pass, selection order in ADR-0015,
pick frozen in local date+slug state outside the record, weaker
language first, starter-code scratch session (never autosaves over
the draft), no separate reward.

## 7. Accounts and auth (issues #32, #35)

Postgres on the present Coolify server (same destination as the
site), `pg` + Drizzle from Next route handlers; check server
headroom before creating the resource. Scheduled `pg_dump`
backups. Register: parent/guardian email + password; login:
username. Username 4–16 chars, letters/numbers/underscore, starts
with a letter, case-insensitively unique, blocklist-screened,
immutable, the only public name. Password 8–64 chars, no class
rules, rejected if common or containing username/email name part.
One required age/parent-permission checkbox; no real name or date
of birth stored, ever.

OTP: 6 digits, 10-minute expiry, single use, hashed at rest, new
code invalidates the old; 5 wrong attempts kill a code; 60 s
resend cooldown; max 5 codes/hour per email and per IP. Sent by
Resend free tier from an SPF/DKIM/DMARC-verified subdomain behind
the single server seam `sendOtpEmail()` (SES/Brevo are the
migration path when any day nears 100 sends). Unverified Accounts
cannot log in. Password reset is OTP + new password on one screen
(no emailed links) and kills other sessions; forgot-username
emails the username to the parent inbox.

Sessions: 30-day sliding cookie (`httpOnly`, `Secure`,
`SameSite=Lax`), no remember-me; shared-computer mode ends at
browser close and its logout wipes the local progress cache;
normal logout keeps the local mirror. Unlimited concurrent
sessions; password change/reset kills all but current. Login
throttle: 10 failures lock Account+IP 15 minutes; generic errors.
Deletion: password + OTP, 30-day grace (login cancels), then hard
delete; unverified Accounts auto-delete after 7 days; deleted
usernames reserved 90 days; backups rotate deleted rows out
within 30 days. Password-hash algorithm and session storage
mechanics are build choices, not decisions.

## 8. Content contract (ADR-0011)

Typed TypeScript data modules, one per Planet, exporting one
Planet record, five Mission records, one Boss Gate record; TS
types + build tests are the validator (no CMS/JSON/runtime schema
library). Mission: permanent slug, `planet`, `position`, one new
`conceptId` + `planetConceptId` (closed enums), `tier`
(`intro|core|stretch`), `title`, `story` (max 280 chars),
`briefing`, 1–3 `objectives` each mapped to check ids, Python and
Java starters, declarative layout (`shipStart` + entity list),
integer Seed pool (first = practice), declarative Pass checks
(`id`, `label`, `statePath`, comparator, scalar, `final|
intermediate`), `par {maxSteps, maxEnergy}`, `star3Concept`
(Planet concept only), exactly three ordered hints, Rosetta Pair
(max 12 lines per language, revealed post-Pass). Editable region
marked `YOUR CODE BELOW` / `YOUR CODE ABOVE` (`#` / `//`). Java
Training Wheels: `full-scaffold` Planets 1–2, `partial` 3–4,
`minimal` 5, per-Mission override. Closed schema: no time
estimates, prerequisites, media paths, or translations in v1.

Every Mission and Boss Part B needs one reference solution per
language stored outside shipped content; a build test runs each
on every Seed and it must Pass. Solutions never ship.

## 9. Playground, Share Links, Arena (ADR-0014)

Playground: code builder API only (no visual editor), setup phase
before step 1 (0 steps/energy/trace), closed ADR-0012 vocabulary,
`spawn_portal`/`spawn_crystal_ring` are sugar/helpers, max 40
entities, bounds ≤ 16×16×6, no spawn on Ship start; Ship colour
from a closed 6-colour cosmetic palette, separate from Hangar
cosmetics. Full builder name table in ADR-0014, Python/Java parity
as always. Six starter templates: Empty World, Ring Course,
Crystal Harvest, Switch and Gate, Wormhole Maze, Drone Patrol —
each a world plus matching starters in both languages, edited as
copies.

Challenge designer: 1–3 goals from the fixed menu (reach a cell,
collect N crystals, open a gate, flip a switch, survive N steps),
all must hold, ADR-0013 check shape, one layout, no hidden Seeds,
no Stars. Playground itself stays Pass-free.

Share Link: `/playground#c=` + base64url(deflate(JSON)), `v: 1`
payload (layout, goals, starter code, title max 40 chars, starter
max 4,000 chars), 2,000-char total cap, all-or-nothing validated
import, preview-first landing (nothing auto-runs), Start saves a
Creation copy (` copy` suffix on title clash; blocked at the
20-Creation cap with a delete-first message). No server storage,
no checksum/signature in v1.

Arena: Account-only. One tick function — Python
`def on_tick(ship, radar):`, Java `onTick(ship, radar)` — returning
exactly one action string per tick (`move`, `turn_left`,
`turn_right`, `ascend`, `descend`, `laser`, `harvest`, `shield`,
`wait`); invalid returns waste the tick. Read-only `ship`/`radar`
snapshots (fields in ADR-0014; Cadet Java must support read-only
host snapshot fields — build owns this). Five waves, wave `n`
fields `n+1` drones at 1 cell per `max(1, 4-n)` ticks, shield
destroys one drone then drops, laser at Mission cost, energy
refills to 50 per wave, 200-tick total cap, win = clear wave 5.
Replay through the cockpit playback model; record written once at
battle end; abandoned battles write nothing. Java Arena starter
is always full-scaffold. Mission caps apply in Playground and
Arena unchanged.

## 10. Performance and accessibility budgets (issue #33)

Home route: prerendered HTML/SVG, instant paint before progress
arrives, states overlay with no loading gate, zero three/monaco
bytes (asserted in build output). Mission route: 60 fps target,
DPR capped [1, 1.5], `frameloop="demand"` at rest, adaptive quality
below ~50 fps, sustained under 30 fps pins to static poster plus
2D/text trace replay. Device floor is functional: WebGL2 +
hardware acceleration; below it, the 2D map and text replay still
work. Monaco keeps keyboard/screen-reader support and aria labels;
state is never carried by colour alone; `prefers-reduced-motion`
is honoured. These are budgets to enforce in build, not measured
school-hardware facts (§2 unverified list).

## 11. Branding (issue #41)

Link hosted assets only, from `https://bongbetic.com/branding/`
(final URL table in issue #41's resolution: glyph, light/dark
wordmarks, icon pairs, logo/lockup, favicon set, apple touch icon,
webmanifest; all verified HTTP 200). Never commit private brand
files to this public repo. Naming trap from #41: the
`bongbetic-wordmark-dark.*` files are the white-text variant for
dark backgrounds.

## 12. Gates, test seams, and the build DAG

Test seams (pure-core first, per ADR-0007's principles): Vitest
unit suites per `lib/` module seeded from the ADR cases (Ship
rules, Seed guarantees, grader/star matrices, merge/Save Code
corruption sets, radar/drill ordering, share-codec rejection
sets, Arena wave rules); build tests for content validity and
reference solutions on every Seed; route integration tests for
auth/progress APIs against a stub mailer and test Postgres;
Playwright thin pass: open Mission, run a passing program in each
language, see Pass, home map shows it. No automated test calls
live Piston or Resend. Deploy work uses podman/Containerfile and
the existing Coolify flow; Pyodide assets ship same-origin with
the site.

The build is charted as GitHub build tickets with native blocking
edges; the DAG is linked from issue #46's resolution comment.
Waves: (0) v1 Level 2 starter fix; (1) Ship sim, content schema,
progress v2 — in parallel; (2) grader; (3) both language workers;
(4) run orchestration + kid errors; (5) accounts, sync API;
(6) home map, cockpit; (7) Boss Gate, Playground, Arena;
(8) content integration, deploy hardening.

Two slices are gated, neither blocks starting:

- **Hangar catalogue and thresholds** — cosmetic sets per slot
  (hull, trim, thruster, laser colour) and their total-Star
  thresholds were never decided. Graduated to a decision ticket
  on map #29 (see #46 resolution); only the Hangar build ticket
  is blocked by it. Equipped-cosmetic storage (§6) is not gated.
- **25-Mission content** — owned by map #48 (Planet documents);
  only the content-integration build ticket waits for it.

Explicitly deferred past v1 (not fog): teacher/parent surfaces,
offline beyond the Pyodide precache, installable app, school
proxy specifics beyond §10 budgets. They return only under a
redrawn destination.
