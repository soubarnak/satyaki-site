# JavaQuest — hosting and Java sandbox research

> **Superseded in part 2026-10-31:** parent ruled out Vercel; the complete site now deploys on the family Coolify server. Vercel Hobby findings (F-1, F-2) are kept as history. The sandbox decision (self-hosted Piston) stands and is live.

**Date:** 2026-10-31
**Status:** Findings verified against primary sources; path chosen by parent 2026-10-31
**Resolves:** Wayfinder ticket "Verify Vercel Hobby and Java sandbox constraints"
**SRS refs:** CR-002, CR-004, IR-002, IR-003, NFR-002, NFR-003, NFR-004, NFR-009

## Findings

| ID | Claim | Primary source |
|---|---|---|
| F-1 | Vercel Hobby includes 100 GB Fast Data Transfer and 1,000,000 function invocations per month; function maximum duration on Hobby is 300 s. JavaQuest keeps its own 10 s run-route ceiling (CR-004), well inside the plan limit. | [Vercel Hobby plan docs](https://vercel.com/docs/plans/hobby) (fetched 2026-10-31) |
| F-2 | Hobby is restricted to non-commercial, personal use. JavaQuest is a free family learning site with no payments (OS-003), so it fits. Any future commercial use forces a paid plan. | [Vercel fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage), cited from the Hobby plan page |
| F-3 | The public Piston API (`emkc.org`) is whitelist-only since 15 Feb 2026. Authorization needs a token, granted only for "good cause non-commercial educational projects", requested from EngineerMan on Discord. Live test 2026-10-31: `POST /api/v2/piston/execute` returned the whitelist rejection message. | [Piston README, Public API section](https://github.com/engineer-man/piston#public-api); live API response |
| F-4 | Piston still lists a Java runtime (version 15.0.2) on the public instance. | Live `GET https://emkc.org/api/v2/piston/runtimes` response, 2026-10-31 |
| F-5 | At SRS volume (10 learners/day, 500 runs/day, NFR-003), Hobby allowances in F-1 are not a binding constraint. The binding constraints are the SRS self-imposed caps: 8 s result time (NFR-002), 5 s program wall time (NFR-004), 20 runs per client per 60 s (NFR-009). | Derived from F-1 and SRS §5 |

## Decision (parent, 2026-10-31, revised same day)

1. **Primary:** self-hosted Piston on the family Coolify server at `https://satyakisjava.bongbetic.com`, behind a gateway that requires a shared `X-Runner-Key` header. The browser calls the site run route (IR-003), never Piston directly. The runner key is one server-side value per Coolify service (runner + site app); CR-002 is rewritten for Coolify (parent ruled out Vercel 2026-10-31), ("0 required environment values" becomes 1) — amendment lands in the architecture ticket. Deploy artifacts: `deploy/piston/`.
2. **Dropped:** Piston public-API whitelist (was primary in the first decision; parent preferred owning the runner).
3. Build proceeds behind the IR-003 run interface before the runner is live; no fake passes when the runner is unavailable (NFR-014).

Alternatives weighed 2026-10-31: Wandbox public API (verified working, no key, OpenJDK 21/22; community service with no SLA or published rate limit), CheerpJ in-browser JVM (free for personal/FOSS use from the vendor CDN; large first-load cost and a major SRS architecture change), Judge0 hosted free tier (about 50-100 runs/day, below the SRS 500/day volume), Judge0 self-hosted (needs cgroup v1, i.e. a GRUB change and reboot, plus Postgres/Redis; Piston needs cgroup v2 and one container).

## Not verified

- Coolify host CPU architecture and cgroup version — check commands are in `deploy/piston/README.md`; Piston needs x86_64 and cgroup v2.
- Self-hosted Piston latency and cap behaviour under the SRS probe set — verified by smoke tests after deploy (ticket "Provision self-hosted Piston on Coolify").
- In-browser JVM (CheerpJ) compile speed — not pursued; path not chosen. Its Community Licence is free for personal and FOSS projects from the vendor CDN ([CheerpJ licensing](https://cheerpj.com/docs/licensing)).
