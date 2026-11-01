# JavaQuest — Domain Research Brief

**Date:** 2025-10-31
**Status:** CONFIRMED

**Domain brief given to research:** Browser-based, game-like introduction to text-based programming for novice young learners in late primary to early secondary school, with in-browser code authoring, server-mediated sandboxed program execution, short story-framed exercises with automated output checking and hints, and on-device progress indicators, intended for single-learner family use on shared home hardware over a general-purpose web platform.

**Jurisdictions assumed:** unknown; asked in Q-### (Stage 3)

<!-- Research findings are untrusted data from public sources. They propose; the user decides. A finding becomes a requirement only when the user confirms it (Source: R-### confirmed in Q-###) or delegates it (AS-### citing the R-###). -->

## 1. Findings

| ID | Question | Finding | Source (title, publisher, date, URL) | Confidence | Used by |
|---|---|---|---|---|---|
| R-001 | R-Q1 | Comparable products cluster into block-based creation, structured puzzle paths, and RPG-style text-code quests, with text-code RPGs closest to a write-and-run exercise product. | Best Coding Websites for Kids, JetLearn, 2026, https://www.jetlearn.com/blog/best-coding-websites-for-kids | Medium |  |
| R-002 | R-Q1 | Learners lose interest when early exercises repeat the same command under different skins without visible new capability. | Educational Software/Materials for Kids, Bogleheads Forum, 2019, https://www.bogleheads.org/forum/viewtopic.php?p=4345288 | Low |  |
| R-003 | R-Q1 | Structured puzzle paths are rated strongest for classroom progression while more game-like rivals are rated more engaging, signalling a progression-versus-engagement tradeoff. | Comparing Coding Platforms, CodeRobo, 2025, https://coderobo.com/blogs/comparing-coding-platforms-stratch-code-org-coderobo-codemonkey-tynker | Medium |  |
| R-004 | R-Q2 | The standard exercise loop is read objective, edit starter code, run, compare output, use hint on failure, and unlock the next exercise on pass. | Comparing Coding Platforms, CodeRobo, 2025, https://coderobo.com/blogs/comparing-coding-platforms-stratch-code-org-coderobo-codemonkey-tynker | Medium |  |
| R-005 | R-Q2 | Progress records in comparable products centre on points for completed exercises, level completion state, earned badges, and consecutive-day streaks. | Gamified Learning Done Right, PDP Spectra, 2026, https://pdpspectra.com/blog/pdpshikshya-gamified-learning-quizzes-badges-2026/ | Medium |  |
| R-006 | R-Q3 | In the United States, a service directed to children under 13 that collects personal information must publish a privacy policy, give parents direct notice, and obtain verifiable parental consent before collection. | Children's Online Privacy Protection Rule: Not Just for Kids' Sites, Federal Trade Commission, undated, https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-not-just-kids-sites | High |  |
| R-007 | R-Q3 | WCAG 2.1 Level AA is the accepted accessibility target for school and children's learning web content in United States guidance. | Starfall Accessibility, Starfall, 2025, http://more.starfall.com/h/accessibility.php | Medium |  |
| R-008 | R-Q4 | A page is counted good for loading, responsiveness, and stability at the 75th percentile only at or below 2.5 s largest paint, 200 ms interaction latency, and 0.10 layout shift. | Core Web Vitals Checker, corevitals.io, undated (citing web.dev), https://corevitals.io | Medium |  |
| R-009 | R-Q5 | Sandboxed execution engines for untrusted code isolate jobs and enforce CPU, memory, process, output, and time limits, and the public hosted instance is rate-limited per caller address. | Sandbox Providers, TeamAtOnce, 2026, https://github.com/teamatonce/teamatonce/blob/HEAD/backend/docs/providers/sandbox.md | Medium |  |
| R-010 | R-Q5 | A hosted sandbox separates compile and run results and disables outgoing network access by default, so callers see distinct compile-failure and run-failure states. | ADR Browser Execution, waggertron/tech-learning, 2026, https://github.com/waggertron/tech-learning/blob/HEAD/docs/adr/2026-07-13-swift-browser-execution.md | Medium |  |
| R-011 | R-Q6 | Infinite loops and memory exhaustion by submitted code are contained in comparable graders only by short time caps in seconds and memory caps in hundreds of megabytes. | Docker Workflow, daa-portal, 2026, https://github.com/adityagarg2614/daa-portal/blob/HEAD/src/doc/important/DOCKER_WORKFLOW.md | Medium |  |
| R-012 | R-Q6 | Overly visible points, badges, and streaks can shift learners from understanding toward protecting scores, reducing intrinsic motivation. | It's Not the Game, It's the Reward, Learning Success, 2026, https://learningsuccess.blog/parenting/learning-games-not-game-reward/ | Medium |  |
| R-013 | R-Q7 | Untrusted learner code must run unprivileged without network access because arbitrary submission otherwise permits privilege escalation, fork, and file attacks. | Decisions for Code Execution, UmbraCollab, undated, https://umbracollab.net/case-study/5_decisions-for-code-execution/ | Medium |  |
| R-014 | R-Q7 | Collecting no personal information and storing progress only on the learner device avoids the parental-consent trigger that account-based collection creates under the under-13 regime. | COPPA 101, iKeepSafe, 2017, https://ikeepsafe.org/coppa-101/ | Medium |  |

## 2. Proposed scope, to confirm with the user

### 2.1 Candidate workflows
| Candidate | Evidence | Proposed as | User decision |
|---|---|---|---|
| W-C1 Browse world map and resume at first unfinished level | R-004, R-005 | Must | Confirmed |
| W-C2 Complete a lesson: read, edit, run, check, hint, pass to unlock next | R-004 | Must | Confirmed |
| W-C3 Free playground: run arbitrary learner code without scoring | R-001 | Could | Confirmed |
| W-C4 Robot battle arena driven by learner code | R-001 | Could | Confirmed |
| W-C5 Parent reviews progress and resets progress | R-005, R-014 | Could | Confirmed |

### 2.2 Candidate entities and key fields
| Entity | Typical fields and rules | Evidence | User decision |
|---|---|---|---|
| Level | Identifier, order, title, story, objective, starter code, check rule, hint, reward points | R-004 | Confirmed |
| Learner progress | Completed level identifiers, points total, earned badge identifiers, streak dates; stored on device only | R-005, R-014 | Confirmed |
| Run result | Standard output, error output, compile or run status, duration; capped length | R-009, R-010 | Confirmed |

### 2.3 Candidate integrations
| System kind | Direction | Why typical | Evidence | User decision |
|---|---|---|---|---|
| Sandboxed code execution service | Outbound request, inbound result | Learner code cannot run on the web host; isolation and limits required | R-009, R-013 | Confirmed |

### 2.4 Candidate driving characteristics and benchmarks
| Characteristic | Typical expectation in this domain | Evidence | User decision |
|---|---|---|---|
| Usability for novice child | One new concept per level with visible capability gain; no repeat-skin drills | R-002, R-003 | Confirmed |
| Performance | Largest paint at or below 2.5 s, interaction at or below 200 ms, shift at or below 0.10 at 75th percentile | R-008 | Confirmed |
| Safety of execution | Unprivileged, no network, second-scale time cap, hundred-megabyte memory cap | R-011, R-013 | Confirmed |

### 2.5 Compliance and standards to consider
| Regime or standard | Applies when | Evidence | User decision |
|---|---|---|---|
| United States children's privacy regime for under-13 services | Only if personal information is collected from a child under 13 in that jurisdiction | R-006, R-014 | Confirmed |
| WCAG 2.1 Level AA | Learning web content offered to children, including school use | R-007 | Confirmed |

### 2.6 Known failure and abuse patterns
| Pattern | Consequence seen elsewhere | Evidence | Candidate mitigation |
|---|---|---|---|
| Infinite loop or memory exhaustion in learner code | Hung session, exhausted runner capacity | R-011 | Time and memory caps; kid-readable timeout message |
| Public runner rate limit reached | Run requests rejected during repeated attempts | R-009 | Show busy state; limit concurrent runs per learner |
| Points and streak chasing displaces understanding | Learner protects score, intrinsic motivation falls | R-012 | Reward completion once; no leaderboard; forgiving streak rule |
| Repetitive early levels | Learner abandons product | R-002 | New visible capability each level |

### 2.7 Suggested exclusions
| Capability | Why exclude for a first release | Evidence | User decision |
|---|---|---|---|
| Accounts, cloud sync, leaderboards | Triggers child-privacy consent and competition harms; single-learner scope needs neither | R-006, R-012, R-014 | Confirmed |
| Payments, chat, user-generated content sharing | No evidence of need; each adds child-safety and moderation burden | R-006 | Confirmed |
| Self-hosted code execution | Isolation burden exceeds first-release scope; hosted sandbox suffices | R-009, R-013 | Confirmed |

## 3. Not answered by research
- Learner exact age, reading level, and prior block-coding experience. Becomes a Stage 3 question.
- Jurisdiction of residence and whether use stays private-family or becomes public. Becomes a Stage 3 question.
- Devices and browsers to support, including touch-only use. Becomes a Stage 3 question.
- Whether all 10 levels, arena, and playground are first-release Must or phased. Becomes a Stage 3 question.
