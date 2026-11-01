# JavaQuest — Software Requirements Specification

**Status:** DRAFT
**Version:** 0.3

| Version | Date | Author | Approver | Status | Changes |
|---|---|---|---|---|---|
| 0.1 | 2025-10-31 | SRS Architect | — | DRAFT | Initial draft |
| 0.2 | 2025-10-31 | SRS Architect | — | DRAFT | Add AS-002 arena tuning recommendation for OQ-001; no scope change |
| 0.3 | 2026-11-01 | SRS Architect | — | DRAFT | Architecture lock amendments from ADR-0001 to ADR-0007: CR-001, CR-002, CR-004, NFR-002, IR-002, DR-003; no scope change |

<!-- Status values: DRAFT, INCOMPLETE, REVIEW, APPROVED. INCOMPLETE means elicitation was cut short and §11 lists every gap. -->
<!-- A section that does not apply gets one line under its heading: "Not applicable: <reason>". Never delete or renumber a section. -->
<!-- Requirement blocks are level-3 or level-4 headings "<ID> — <Title>" followed by the fields shown, in the order shown. Copy a block, never improvise one. -->

## 1. Introduction

### 1.1 Purpose
This document specifies what JavaQuest shall do for a novice learner aged 9 to 12 years and for a supervising parent, so that design, build, and test work can proceed without further questions to the author.

### 1.2 Scope
JavaQuest is a browser-based learning product in which a learner writes Java programs, runs them in a sandbox, and advances through 10 story-framed levels plus a playground and a robot arena, with progress held only on the learner device and no learner accounts inside the boundary.

### 1.3 Goals and success metrics

| ID | Goal | Metric | Target | Measured by |
|---|---|---|---|---|
| G-001 | Learner completes the full quest | Levels passed by one learner within 60 days of first use | 10 levels in 60 days | Parent reads on-device progress at day 60 |
| G-002 | Learner returns without prompting | Distinct calendar days with 1 or more lesson runs in any 14-day window | 6 days per 14-day window | Parent reads on-device streak dates |

### 1.4 Definitions
See Appendix B.

### 1.5 References
Research brief `javaquest-research.md`; client product brief supplied 2025-10-31 (title: JavaQuest build brief); WCAG 2.1; India Digital Personal Data Protection Act 2023.

## 2. Overall description

### 2.1 Product perspective and system context
JavaQuest replaces unstructured tutorial watching with write-run-check practice. It extends no existing system.

| Actor / system | Kind | Interaction | Interface |
|---|---|---|---|
| Learner | Human role | Reads levels, edits code, runs code, views progress | IR-001 |
| Parent | Human role | Views progress, resets progress | IR-001 |
| Sandboxed code execution service | External system | Receives learner program, returns run result | IR-002 |

### 2.2 Personas and roles

| Role | Persona (fictional) | Needs | Permission tier | Expected concurrent users |
|---|---|---|---|---|
| Learner | Riya, age 10, first text language | Pass levels in order, retry without penalty | Edit and run own code; view own progress | 2 |
| Parent | Kabir, supervising adult at home | Confirm progress, reset progress on request | View progress; reset progress after confirmation | 1 |

### 2.3 Operating environment
Desktop and laptop browsers are the primary client; small touch screens show story and progress with code editing as best effort. English (India) text only; dates use the device local calendar. Use requires network reach to the execution service for every Run action.

### 2.4 Assumptions

| ID | Assumption | Reason the decision fell to SRS Architect | Impact if wrong | Status |
|---|---|---|---|---|
| AS-001 | Learner reads English sentences of up to 20 words without help | Unanswered at draft time; exact reading level not tested | FR-004, NFR-015 | Proposed |
| AS-002 | Opponent health 40, attack damage 2 per adjacent facing hit, start 5 cells apart in a straight lane with stationary opponent; reference win uses 24 executed commands (4 moves plus 20 attacks) | User asked SRS Architect for a possible recommendation on OQ-001; playtest not yet run | FR-011 | Proposed |

### 2.5 Dependencies
The sandboxed code execution service in IR-002 must accept Java programs and enforce time and memory caps. No other external system, team, or approval is required for version 1.

## 3. Core workflows

### WF-001 — Browse map and resume quest
- **Actor:** Learner
- **Goal:** G-001
- **Trigger:** Learner opens the learn view.
- **Preconditions:** None.
- **Main path:**
  1. System shows 10 levels in order with locked, open, and passed states plus total points.
  2. Learner selects an open or passed level.
  3. System opens that level in WF-002.
- **Alternate and failure paths:**
  - No saved progress: system shows level 1 open and levels 2 to 10 locked with 0 points.
  - Learner selects a locked level: system keeps the map shown and states the prior level to pass first.
- **Outcome:** Chosen level is shown ready to attempt.
- **Frequency and volume:** 10 opens per day; peak 2 per minute.
- **Consistency and durability needs:** A pass recorded on this device shows on the next map view on the same device with 0 s delay; loss on storage clear is accepted in DR-008.
- **Realised by:** FR-001, FR-002, FR-015

### WF-002 — Complete a lesson level
- **Actor:** Learner
- **Goal:** G-001
- **Trigger:** Learner opens an open level.
- **Preconditions:** Level is open or passed.
- **Main path:**
  1. System shows story, objective, starter code, and Run control.
  2. Learner edits code and selects Run.
  3. System runs the program in the sandbox and shows output or a child-readable error.
  4. On pass, system records completion once, awards points once, unlocks the next level, and shows success.
- **Alternate and failure paths:**
  - Compile or run error: system shows a mapped child-readable message plus raw error text, with no points change.
  - Output passes but required concept absent: system withholds pass and names the missing concept.
  - Runner down or busy: system blocks the run, shows a retry message, and awards no pass.
  - Learner requests hint: system shows the level hint with no points change.
- **Outcome:** Level is passed once with points and next level open, or level stays open for retry.
- **Frequency and volume:** 50 runs per day; peak 5 runs per minute from one device.
- **Consistency and durability needs:** Points and unlock apply together or not at all on the device; a shown pass is never withdrawn by a later failed run.
- **Realised by:** FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-014, FR-016

### WF-003 — Practise in the playground
- **Actor:** Learner
- **Goal:** G-002
- **Trigger:** Learner opens the playground view.
- **Preconditions:** None.
- **Main path:**
  1. System shows an empty editor with an example program.
  2. Learner edits code and selects Run.
  3. System runs the program and shows output or a child-readable error.
- **Alternate and failure paths:**
  - Runner down or busy: system blocks the run and shows a retry message.
  - Program exceeds caps: system stops the run and shows the cap message in FR-007.
- **Outcome:** Run result shown; quest progress unchanged.
- **Frequency and volume:** 20 runs per day; peak 5 runs per minute from one device.
- **Consistency and durability needs:** Playground runs write no progress record; no durability guarantee applies.
- **Realised by:** FR-009

### WF-004 — Battle in the robot arena
- **Actor:** Learner
- **Goal:** G-001
- **Trigger:** Learner opens the arena after passing level 9.
- **Preconditions:** Levels 1 to 9 passed.
- **Main path:**
  1. System shows robot commands, starter code, and a battle board.
  2. Learner edits code and selects Run.
  3. System runs the program, replays robot moves on the board, and declares win or loss by the arena rule.
  4. On first win, system records level 10 passed and awards its points once.
- **Alternate and failure paths:**
  - Learner opens arena before level 9 pass: system shows the lock reason and no editor.
  - Program error or cap breach: system shows the mapped message and records no win.
- **Outcome:** Win records quest complete; loss leaves level 10 open for retry.
- **Frequency and volume:** 10 runs per day; peak 2 runs per minute from one device.
- **Consistency and durability needs:** A win and its points apply together or not at all on the device, as in WF-002.
- **Realised by:** FR-010, FR-011

### WF-005 — Parent reviews and resets progress
- **Actor:** Parent
- **Goal:** G-002
- **Trigger:** Parent opens the progress view.
- **Preconditions:** Parent has the learner device.
- **Main path:**
  1. System shows levels passed, points, badges, streak dates, and a storage-loss warning.
  2. Parent selects reset and confirms.
  3. System clears progress and shows the map at 0 points with level 1 open.
- **Alternate and failure paths:**
  - Parent cancels confirmation: system keeps progress unchanged.
  - No saved progress: system shows zeros and disables reset.
- **Outcome:** Progress summary shown, or progress cleared after confirmation.
- **Frequency and volume:** 2 opens per day; peak 1 per minute.
- **Consistency and durability needs:** Reset clears every progress field together; a partial clear is never shown.
- **Realised by:** FR-012, FR-013

## 4. Functional requirements

### World map

#### FR-001 — Show ordered level map
- **Priority:** Must
- **Workflow:** WF-001
- **Goal:** G-001
- **Statement:** When the learner opens the learn view, the system shall show 10 levels in fixed order, each marked locked, open, or passed.
- **Rationale:** Ordered progression is the quest structure confirmed in research candidate W-C1.
- **Source:** R-004 confirmed in Q-002
- **Acceptance criteria:**
  - AC-1 (main): Given levels 1 to 3 passed, when the learner opens the learn view, then levels 1 to 3 show passed, level 4 shows open, and levels 5 to 10 show locked.
  - AC-2 (failure): Given no saved progress, when the learner opens the learn view, then level 1 shows open, levels 2 to 10 show locked, and points show 0.
- **Status:** Active

#### FR-002 — Enforce level locks
- **Priority:** Must
- **Workflow:** WF-001
- **Goal:** G-001
- **Statement:** If the learner selects a locked level, then the system shall keep the map shown and name the level to pass first.
- **Rationale:** Lock order prevents skipping a concept that later levels build on.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given level 4 is the first unfinished level, when the learner selects level 6, then the map stays shown and text names level 4.
  - AC-2 (boundary): Given level 9 passed, when the learner selects level 10, then the arena opens under WF-004.
- **Status:** Active

### Lesson player

#### FR-003 — Present level content
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-001
- **Statement:** When a level opens, the system shall show its story, objective, starter code, hint control, Run control, and output area on one screen without horizontal scrolling at 1024 px width.
- **Rationale:** The read-edit-run loop in R-004 needs every element in view for a novice.
- **Source:** R-004 confirmed in Q-002
- **Acceptance criteria:**
  - AC-1 (main): Given level 2 is open, when the learner opens level 2 at 1024 px width, then story, objective, starter code, hint, Run, and output area are all visible.
  - AC-2 (failure): Given level data fails to load, when the learner opens the level, then the system shows a load-error message with a retry control and no editor.
- **Status:** Active

#### FR-004 — Use one new concept per level
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-001
- **Statement:** The system shall present exactly 1 new Java concept in each level objective, in this order: print, variables, branch, loop, method, class, array, combined loops, debug repair, combined quest.
- **Rationale:** Repeat drills under new skins cause abandonment (R-002).
- **Source:** R-002 confirmed in Q-003
- **Acceptance criteria:**
  - AC-1 (main): Given the 10 shipped levels, when an inspector lists each objective concept, then each level names 1 concept and the order matches the statement order.
  - AC-2 (boundary): Given level 10, when an inspector reads its objective, then it names combined use only and introduces no new concept term.
- **Status:** Active

#### FR-005 — Run learner program in sandbox
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-001
- **Statement:** When the learner selects Run, the system shall submit the current editor text to the sandboxed execution service and show the returned output, error text, and run duration.
- **Rationale:** Real output is the feedback signal for every lesson.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given a program that prints a hero name, when the learner selects Run, then the output area shows that name and a duration value.
  - AC-2 (failure): Given the execution service returns an error, when the run ends, then the output area shows the error state and prints no pass mark.
- **Status:** Active

#### FR-006 — Judge pass by output plus concept
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-001
- **Statement:** When a run ends, the system shall mark the level passed only when output meets the level check and the required concept token is present in the submitted code.
- **Rationale:** Output alone admits printing a keyword without using the concept.
- **Source:** Q-007
- **Acceptance criteria:**
  - AC-1 (main): Given output meets the check and code contains the concept token, when the run ends, then the level shows passed.
  - AC-2 (failure): Given output meets the check and code lacks the concept token, when the run ends, then the level stays open and text names the missing concept.
- **Status:** Active

#### FR-007 — Map errors to child-readable messages
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-001
- **Statement:** If a run ends in compile error, runtime error, time cap, or memory cap, then the system shall show 1 mapped child-readable sentence for that class plus the raw error text.
- **Rationale:** A novice cannot act on raw compiler text alone.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given a null dereference at runtime, when the run ends, then the first error line is the mapped sentence for that class and raw text follows.
  - AC-2 (failure): Given an unmapped error class, when the run ends, then the system shows a generic try-again sentence plus raw text and records no pass.
- **Status:** Active

#### FR-008 — Award level points once
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-002
- **Statement:** When a level is first passed, the system shall add that level point value to total points exactly 1 time.
- **Rationale:** Repeat awards invite score farming over learning (R-012).
- **Source:** R-012 confirmed in Q-003
- **Acceptance criteria:**
  - AC-1 (main): Given a level worth 100 points not yet passed, when the learner passes it, then total points rise by 100.
  - AC-2 (boundary): Given that level already passed, when the learner passes it again, then total points do not change.
- **Status:** Active

### Playground and arena

#### FR-009 — Run unscored playground code
- **Priority:** Must
- **Workflow:** WF-003
- **Goal:** G-002
- **Statement:** When the learner selects Run in the playground, the system shall run the editor text and show the result without changing points, locks, badges, or streak dates.
- **Rationale:** Free practise was confirmed for version 1 in Q-005.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given any program in the playground, when the learner selects Run, then output shows and progress values equal their pre-run values.
  - AC-2 (failure): Given a program with a compile error, when the learner selects Run, then the mapped error shows and progress values still equal pre-run values.
- **Status:** Active

#### FR-010 — Gate arena on level 9
- **Priority:** Must
- **Workflow:** WF-004
- **Goal:** G-001
- **Statement:** While fewer than 9 levels are passed, the system shall show the arena as locked with the count of levels still to pass.
- **Rationale:** The arena combines prior concepts and is level 10 of the quest.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given 9 levels passed, when the learner opens the arena, then the editor and board show.
  - AC-2 (boundary): Given 8 levels passed, when the learner opens the arena, then no editor shows and text states 1 level remains.
- **Status:** Active

#### FR-011 — Replay arena battle and judge win
- **Priority:** Must
- **Workflow:** WF-004
- **Goal:** G-001
- **Statement:** When an arena run ends without error, the system shall replay each robot command on the board in submission order and declare win only when the opponent health reaches 0 within 100 commands.
- **Rationale:** Visible replay ties code order to outcome for the final quest.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given commands that reduce opponent health to 0 in 100 or fewer commands, when replay ends, then win shows and level 10 shows passed.
  - AC-2 (failure): Given 101 commands without opponent health at 0, when replay stops, then loss shows and level 10 stays open.
- **Status:** Active

### Progress, badges, and streaks

#### FR-012 — Show parent progress summary
- **Priority:** Must
- **Workflow:** WF-005
- **Goal:** G-002
- **Statement:** When the progress view opens, the system shall show levels passed out of 10, total points, badge names earned, streak dates, and a warning that clearing browser storage erases progress.
- **Rationale:** On-device-only storage loses data on clear; the parent accepted that loss with warning.
- **Source:** Q-010
- **Acceptance criteria:**
  - AC-1 (main): Given 4 levels passed, when the parent opens the progress view, then 4 of 10, points, badges, dates, and the warning all show.
  - AC-2 (failure): Given no saved progress, when the parent opens the progress view, then zeros show and reset is disabled.
- **Status:** Active

#### FR-013 — Reset progress after confirmation
- **Priority:** Must
- **Workflow:** WF-005
- **Goal:** G-002
- **Statement:** When the parent confirms reset, the system shall clear passed levels, points, badges, and streak dates in one action.
- **Rationale:** A fresh start on a shared device needs one complete clear.
- **Source:** Q-010
- **Acceptance criteria:**
  - AC-1 (main): Given saved progress, when the parent confirms reset, then the map shows 0 points with only level 1 open.
  - AC-2 (failure): Given saved progress, when the parent cancels reset, then every progress value equals its pre-action value.
- **Status:** Active

#### FR-014 — Award named badges once
- **Priority:** Should
- **Workflow:** WF-002
- **Goal:** G-002
- **Statement:** When its earning event first occurs, the system shall award each named badge (First Print, Loop Master, Bug Hunter) exactly 1 time.
- **Rationale:** Named milestones mark capability gains named in the product brief.
- **Source:** Q-005
- **Acceptance criteria:**
  - AC-1 (main): Given no badge earned, when the learner first passes the print level, then First Print appears in the progress view.
  - AC-2 (boundary): Given First Print already earned, when the learner passes that level again, then the badge list does not change.
- **Status:** Active

#### FR-015 — Record forgiving streak
- **Priority:** Should
- **Workflow:** WF-001
- **Goal:** G-002
- **Statement:** When the learner runs code on a new local calendar day, the system shall add that date to streak dates and shall keep the prior count after exactly 1 missed day.
- **Rationale:** Harsh streak loss creates score protection (R-012).
- **Source:** R-012 confirmed in Q-012
- **Acceptance criteria:**
  - AC-1 (main): Given runs on day 1 and day 2, when day 2 ends, then streak dates contain both dates.
  - AC-2 (boundary): Given a run on day 1, no run on day 2, and a run on day 3, when day 3 run ends, then the streak count includes day 1 and day 3 without reset to 1.
- **Status:** Active

#### FR-016 — Provide free hints
- **Priority:** Must
- **Workflow:** WF-002
- **Goal:** G-001
- **Statement:** When the learner selects the hint control, the system shall show the level hint with no change to points, badges, or locks.
- **Rationale:** Hint cost punishes help-seeking; free hints were confirmed in Q-012.
- **Source:** Q-012
- **Acceptance criteria:**
  - AC-1 (main): Given a level open, when the learner selects hint, then hint text shows and points equal pre-action points.
  - AC-2 (failure): Given hint text missing for a level, when the learner selects hint, then a no-hint message shows and the editor text is unchanged.
- **Status:** Active

## 5. Non-functional requirements

### 5.0 Driving architectural characteristics

| Rank | Characteristic | Why it drives this system | Primary NFRs |
|---|---|---|---|
| 1 | Usability | A 9 to 12 year old novice must reach a first pass without adult help | NFR-015 |
| 2 | Security | Public submission of untrusted programs creates harm if isolation fails | NFR-004 |
| 3 | Performance | Slow feedback breaks the run-retry loop that teaches each concept | NFR-001 |
| 4 | Cost | Zero hosting spend is a hard product limit | NFR-003 |

<!-- NFR block. Place instances under the subsection 5.1 to 5.8 that matches the Category. -->

### 5.1 Performance and capacity

#### NFR-001 — Page speed at 75th percentile
- **Category:** Performance
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** While serving up to 10 learners per day, the system shall meet the paint, latency, and shift limits in Target at the 75th percentile.
- **Target:** Largest paint at or below 2.5 s, interaction latency at or below 200 ms, layout shift at or below 0.10 at 75th percentile on desktop
- **Verification:** Test — field measurement over 28 days after launch
- **Rationale:** Domain benchmark R-008 sets the good-page limits.
- **Source:** R-008 confirmed in Q-003
- **Status:** Active

#### NFR-002 — Run feedback time
- **Category:** Performance
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** When the execution service responds within its caps, the system shall show the run result within the limit in Target for 95 of 100 runs.
- **Target:** p95 at or below 8000 ms from Run selection to result shown, excluding learner program run time capped at 5000 ms
- **Verification:** Test — 100 timed runs of shipped starter programs
- **Rationale:** The CR-004 run route ceiling is 10 s; feedback must land inside it.
- **Source:** Q-011
- **Status:** Active

#### NFR-003 — Capacity and run cost ceiling
- **Category:** Performance
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** While daily learners stay at or below 10, the system shall operate within the cost ceiling in Target.
- **Target:** 0 currency units per month hosting spend at 10 learners per day and 500 runs per day
- **Verification:** Inspection — monthly host bill shows 0 charges
- **Rationale:** Free-tier operation was mandated in the product brief.
- **Source:** Q-011
- **Status:** Active

### 5.2 Security and privacy

#### NFR-004 — Isolated program execution
- **Category:** Security
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** The system shall execute every learner program only inside the sandbox with the caps in Target and with 0 outbound network calls from the program.
- **Target:** 5000 ms wall time, 256 MB memory, 0 outbound network calls, 100% of runs
- **Verification:** Test — submit loop, memory, and network probe programs; each stops at cap
- **Rationale:** Untrusted code isolation follows R-011 and R-013.
- **Source:** Baseline B-12
- **Status:** Active

#### NFR-005 — Clean learner-facing errors
- **Category:** Security
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall show 0 stack traces from the web host, 0 host file paths, and 0 service version strings in learner-facing error text.
- **Target:** 0 occurrences in 50 forced error cases
- **Verification:** Test — force 50 error cases and inspect shown text
- **Rationale:** Host diagnostics leak internals to the public.
- **Source:** Baseline B-06
- **Status:** Active

#### NFR-006 — No secrets in client or logs
- **Category:** Security
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall store 0 credentials, keys, or session values in browser storage, page text, or client-shipped code.
- **Target:** 0 findings in shipped client bundle scan
- **Verification:** Inspection — scan shipped bundle and storage keys
- **Rationale:** Public clients disclose every shipped value.
- **Source:** Baseline B-07
- **Status:** Active

#### NFR-007 — Hidden internal surface
- **Category:** Security
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall expose 0 administrative or debug operations to unauthenticated callers.
- **Target:** 0 of listed debug operations reachable without operator sign-in
- **Verification:** Test — unauthenticated probe of each listed operation returns refusal
- **Rationale:** Public reach turns debug surface into attack surface.
- **Source:** Baseline B-09
- **Status:** Active

#### NFR-008 — Encrypted transport
- **Category:** Security
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall serve every page and run exchange over encrypted transport at or above the version in Target.
- **Target:** TLS 1.2 minimum on 100% of exchanges
- **Verification:** Test — protocol scan of public address
- **Rationale:** Learner code crosses the public network on every run.
- **Source:** Baseline B-10
- **Status:** Active

#### NFR-009 — Run rate limit
- **Category:** Security
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** If one client exceeds the run limit in Target, then the system shall refuse added runs with a busy message until the window passes.
- **Target:** 20 runs per client per 60 s window; refusal from run 21 in window
- **Verification:** Test — send 25 runs in 60 s; runs 21 to 25 refused
- **Rationale:** The shared execution service throttles callers (R-009).
- **Source:** Baseline B-12
- **Status:** Active

#### NFR-010 — Output shown as text only
- **Category:** Security
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** The system shall render program output as plain text in 100% of cases, executing 0 markup or script contained in output.
- **Target:** 0 executions in 20 output injection probes
- **Verification:** Test — programs print markup and script text; page shows text only
- **Rationale:** Learner output is untrusted content shown in the page.
- **Source:** Baseline B-13
- **Status:** Active

#### NFR-011 — Collect no personal information
- **Category:** Privacy
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall collect, transmit to servers, and retain 0 items of learner personal information.
- **Target:** 0 personal-information fields in forms, requests, and stored records
- **Verification:** Inspection — field inventory against §7.5 shows 0 such fields
- **Rationale:** Zero collection keeps the under-13 consent trigger dormant (R-014).
- **Source:** Baseline B-14
- **Status:** Active

#### NFR-012 — Authentication baseline withdrawn
- **Category:** Security
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall require authentication on every non-public operation.
- **Target:** 100% of non-public operations
- **Verification:** Test — unauthenticated call sweep
- **Rationale:** No accounts exist; every learner operation is public by design, so B-01 to B-05 have no subject.
- **Source:** Baseline B-01
- **Status:** Withdrawn (no accounts or non-public learner operations in version 1)

#### NFR-013 — Server audit and backup baseline withdrawn
- **Category:** Security
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall keep a server audit log and scheduled backups of server-held records.
- **Target:** 90 days audit retention; daily backup
- **Verification:** Inspection — log and backup records
- **Rationale:** No server-held learner records exist; B-08, B-15 to B-19 have no subject in version 1.
- **Source:** Baseline B-18
- **Status:** Withdrawn (no server-held learner records in version 1)

### 5.3 Scalability

Not applicable: capacity is fixed at 10 learners per day in NFR-003; growth past that count needs a new version.

### 5.4 Availability, reliability and continuity

#### NFR-014 — Pass integrity under faults
- **Category:** Reliability
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** If any run fault occurs, then the system shall record 0 false passes in 100 fault-injected runs.
- **Target:** 0 false passes per 100 fault runs covering timeout, busy, and error classes
- **Verification:** Test — fault injection run set with progress diff
- **Rationale:** A false pass teaches a wrong result and unlocks untaught concepts.
- **Source:** Q-010
- **Status:** Active

### 5.5 Observability and supportability

Not applicable: no operator team or server records exist in version 1; the parent observes progress in WF-005.

### 5.6 Usability, accessibility and localization

#### NFR-015 — Novice first-pass usability
- **Category:** Usability
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** A first-time learner aged 9 to 12 shall reach a first level pass within the limit in Target without adult help.
- **Target:** 15 minutes maximum, 4 of 5 observed learners succeed
- **Verification:** Demonstration — observed sessions with 5 learners in band
- **Rationale:** Unaided first success is the adoption gate for G-001.
- **Source:** Q-004
- **Status:** Active

#### NFR-016 — Accessibility conformance
- **Category:** Accessibility
- **Priority:** Should
- **Applies to:** System-wide
- **Statement:** The system shall conform to the named standard in Target on map, lesson, playground, arena, and progress views.
- **Target:** WCAG 2.1 Level AA, 0 violations at A and AA in automated scan of 5 views
- **Verification:** Test — automated scan plus keyboard-only pass of WF-002
- **Rationale:** Learning content target follows R-007.
- **Source:** R-007 confirmed in Q-002
- **Status:** Active

#### NFR-017 — Single locale
- **Category:** Localization
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall present 100% of learner text in English (India) in version 1.
- **Target:** 1 locale; 0 learner strings in other locales
- **Verification:** Inspection — string inventory shows 1 locale
- **Rationale:** One locale was confirmed in Q-013.
- **Source:** Q-013
- **Status:** Active

### 5.7 Maintainability, portability and compatibility

#### NFR-018 — Desktop browser compatibility
- **Category:** Compatibility
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** The system shall support the 2 most recent major versions of each browser in Target at launch.
- **Target:** 2 recent major versions each of Chrome, Edge, Firefox, Safari on desktop
- **Verification:** Test — WF-002 pass in each listed browser version
- **Rationale:** Home hardware varies; desktop-first scope was confirmed in Q-008.
- **Source:** Q-008
- **Status:** Active

### 5.8 Compliance and legal

#### NFR-019 — Child privacy by zero collection in India
- **Category:** Compliance
- **Priority:** Must
- **Applies to:** System-wide
- **Statement:** While operating for India-resident children, the system shall process 0 items of child personal data as counted in Target.
- **Target:** 0 personal-data items processed server-side per Data Protection Act field inventory
- **Verification:** Inspection — data inventory signed by parent owner
- **Rationale:** India jurisdiction was confirmed in Q-009; zero collection avoids verifiable-consent processing.
- **Source:** Q-009
- **Status:** Active

## 6. Interface requirements

<!-- IR block. Place instances under the subsection 6.1 to 6.4 that matches the Kind. -->

### 6.1 User interfaces

#### IR-001 — Browser learning interface
- **Kind:** UI
- **Priority:** Must
- **Applies to:** WF-001
- **Counterpart:** Learner and parent on desktop browser
- **Direction:** Both
- **Statement:** The system shall exchange level content, editor text, run results, and progress values with the learner and parent through browser pages.
- **Data exchanged:** Level fields, editor text, run result fields, progress fields per DR-001 to DR-005
- **Authentication model:** None; no accounts in version 1
- **Volume and frequency:** 500 page views per day at 10 learners per day
- **Failure behaviour when unavailable:** Browser shows host error; no progress write occurs
- **Source:** Q-008
- **Status:** Active

### 6.2 External systems consumed

#### IR-002 — Sandboxed execution service
- **Kind:** Consumed
- **Priority:** Must
- **Applies to:** WF-002
- **Counterpart:** Self-hosted sandboxed code execution service on the family server
- **Direction:** Both
- **Statement:** The system shall send learner program text with language and version fields to the execution service and shall receive output, error, status, and duration fields in return.
- **Data exchanged:** Program text, language name, runtime version out; standard output, error output, exit status, duration in per DR-005
- **Authentication model:** Key credential held server-side only by the web host; the browser never calls the service directly
- **Volume and frequency:** 500 runs per day; peak 5 runs per minute
- **Failure behaviour when unavailable:** Run blocked with retry message; 0 passes awarded per FR-005 failure path
- **Source:** Q-017
- **Status:** Active

### 6.3 Interfaces exposed to others

#### IR-003 — Server-mediated run operation
- **Kind:** Exposed
- **Priority:** Must
- **Applies to:** WF-002
- **Counterpart:** JavaQuest browser client
- **Direction:** Both
- **Statement:** The system shall accept program text from its own browser client, forward it to IR-002, and return the run result fields to that client.
- **Data exchanged:** Program text in; standard output, error output, status, duration out per DR-005
- **Authentication model:** Public operation listed by name here; rate-limited per NFR-009
- **Volume and frequency:** 500 calls per day; 20 calls per client per 60 s maximum
- **Failure behaviour when unavailable:** Client shows busy or retry message; editor text preserved
- **Source:** Q-005
- **Status:** Active

### 6.4 Hardware and OS interfaces

Not applicable: version 1 uses standard browser input and display only.

## 7. Data requirements

### 7.1 Entity inventory and relationships

| Entity | Purpose | Key relationships | Owner role | Classification (§7.5) |
|---|---|---|---|---|
| Level | One teachable concept with check and hint | 10 levels in fixed order; 1 level gates the next | Learner | Public |
| Learner progress | On-device record of passes, points, badges, streak dates | 1 record per browser store; references level identifiers | Learner | Internal |
| Run result | Transient outcome of one program execution | Many results per level attempt; never stored past display | Learner | Internal |

<!-- DR block. Place instances under the subsection 7.2 to 7.7 that matches the Kind. -->

### 7.2 Field validity rules

#### DR-001 — Program text limits
- **Kind:** Field rule
- **Priority:** Must
- **Applies to:** Run result.program text
- **Statement:** The system shall accept program text only when its length is from 1 to 20000 characters inclusive.
- **Rule:** Text, 1 to 20000 characters, required, set by learner per run; longer or empty input rejected with a length message and no run submitted.
- **Verification:** Test — boundary lengths 0, 1, 20000, 20001 characters
- **Rationale:** Bounds protect the shared runner from oversize submissions.
- **Source:** Baseline B-11
- **Status:** Active

#### DR-002 — Level point value
- **Kind:** Field rule
- **Priority:** Must
- **Applies to:** Level.points
- **Statement:** The system shall accept a level point value only when it is an integer from 10 to 500 inclusive.
- **Rule:** Integer 10 to 500, required, fixed at content publication; out-of-range content rejected at build check.
- **Verification:** Test — boundary values 9, 10, 500, 501
- **Rationale:** Bounded rewards keep totals comparable across levels.
- **Source:** Q-005
- **Status:** Active

#### DR-003 — Total points range
- **Kind:** Field rule
- **Priority:** Must
- **Applies to:** Learner progress.total points
- **Statement:** The system shall compute total points as the sum of point values of passed levels, an integer from 0 to 5000 inclusive, and shall store no total points value.
- **Rule:** Integer 0 to 5000, computed on read from the stored passed-level list, starts at 0, rises only by FR-008 and FR-011 first passes; stored level identifiers outside 1 to 10 or duplicated are dropped on load before computation.
- **Verification:** Test — seed stored passed lists: empty, levels 1 to 10, duplicate and out-of-range identifiers; load map and check computed totals
- **Rationale:** A stored total reset beside intact passes could never be re-earned under FR-008; derivation keeps points consistent with passes when local storage is hand-edited.
- **Source:** Q-019
- **Status:** Active

#### DR-004 — Streak date validity
- **Kind:** Field rule
- **Priority:** Should
- **Applies to:** Learner progress.streak dates
- **Statement:** The system shall store each streak date as a device-local calendar date in year-month-day form with no duplicates.
- **Rule:** Date list, unique, sorted ascending, set by system on first run of a local day; duplicate or malformed stored dates dropped on load.
- **Verification:** Test — seed duplicate and malformed dates; load shows deduplicated sorted list
- **Rationale:** Streak counting in FR-015 needs one entry per day.
- **Source:** Q-012
- **Status:** Active

#### DR-005 — Run output cap
- **Kind:** Field rule
- **Priority:** Must
- **Applies to:** Run result.output
- **Statement:** The system shall display at most 10000 characters of standard output plus at most 10000 characters of error output per run, marking truncation when capped.
- **Rule:** Text capped at 10000 characters per stream, transient, set by execution service; excess replaced by a truncation mark.
- **Verification:** Test — program printing 20000 characters shows 10000 plus mark
- **Rationale:** Unbounded output freezes the lesson page.
- **Source:** Baseline B-12
- **Status:** Active

### 7.3 Volumes and growth

#### DR-006 — Content and progress volumes
- **Kind:** Volume
- **Priority:** Must
- **Applies to:** Level
- **Statement:** The system shall ship with 10 levels and shall hold 1 progress record per browser store.
- **Rule:** 10 level records on day one with 0 growth in version 1; 1 progress record per device browser; run results transient at 500 per day peak.
- **Verification:** Inspection — shipped content count equals 10
- **Rationale:** Fixed curriculum bounds build and test scope.
- **Source:** Q-005
- **Status:** Active

### 7.4 Retention and deletion

#### DR-007 — On-device retention and deletion
- **Kind:** Retention
- **Priority:** Must
- **Applies to:** Learner progress
- **Statement:** The system shall retain the progress record on the device until parent reset in FR-013 or browser storage clear deletes it, completing reset deletion within 5 s.
- **Rule:** Retain until reset or clear; deletion trigger is confirmed reset; completion within 5 s; no server copy exists to delete.
- **Verification:** Test — confirm reset and reload within 5 s shows zero state
- **Rationale:** Parent accepted storage-clear loss in Q-010.
- **Source:** Q-010
- **Status:** Active

### 7.5 Privacy and classification

| Entity / field | Classification | Legal basis | Retention | Deletion trigger | Residency |
|---|---|---|---|---|---|
| Level (all fields) | Public | Not applicable: published lesson content | Life of release | Content revision | No constraint |
| Learner progress (all fields) | Internal | Not applicable: no personal data; device-local game state only | Until reset or storage clear per DR-007 | Parent reset or storage clear | Learner device only |
| Run result.program text | Internal | Not applicable: learner exercise code sent for execution only | Transient display only | Page close or next run | No constraint |

### 7.6 Migration and seed data

Not applicable: no prior system data exists; the 10 levels ship as initial content under DR-006.

### 7.7 Consistency and durability per workflow

#### DR-008 — Same-device read-after-write for progress
- **Kind:** Consistency
- **Priority:** Must
- **Applies to:** WF-001
- **Statement:** When a pass is recorded, the system shall show that pass on the next map view on the same device with 0 s staleness.
- **Rule:** Read-after-write on same device; cross-device visibility not offered; staleness window 0 s same device.
- **Verification:** Test — pass a level, open map, confirm state without reload delay
- **Rationale:** A vanished pass would read as lost work to a child.
- **Source:** Q-010
- **Status:** Active

#### DR-009 — Accepted loss on storage clear
- **Kind:** Durability
- **Priority:** Must
- **Applies to:** WF-002
- **Statement:** If browser storage is cleared, then the system shall start from zero progress and shall show the storage-loss warning state of FR-012 on next progress view.
- **Rule:** Loss window is total on storage clear by accepted decision; pass confirmation shown at write time with no server durability.
- **Verification:** Demonstration — clear storage, reload, confirm zero state
- **Rationale:** Zero-cost single-device scope trades durability for zero accounts.
- **Source:** Q-010
- **Status:** Active

## 8. Constraints

#### CR-001 — Mandated web stack
- **Kind:** Technology mandate
- **Priority:** Must
- **Statement:** The system shall be built with the client-mandated stack of Next.js 16.4.3 App Router with TypeScript, Tailwind CSS with shadcn/ui, Monaco Editor, and Framer Motion.
- **Rationale:** Client mandated the stack in the product brief; parent locked the current stable Next.js on 2026-10-31 and pinned version 16.4.3 exactly at architecture lock.
- **Source:** Q-016
- **Status:** Active

#### CR-002 — Free hosting and mediated execution
- **Kind:** Hosting
- **Priority:** Must
- **Statement:** The system shall deploy on the family Coolify server at 0 added hosting cost with exactly 1 secret value held server-side, and shall run Java only through a server-mediated call to a self-hosted sandbox, never on the web host.
- **Rationale:** Parent ruled out Vercel on 2026-10-31; the self-hosted sandbox on the existing family server keeps hosting spend at 0, keeps execution off the web host, and needs 1 server-side key credential.
- **Source:** Q-017
- **Status:** Active

#### CR-003 — No database in version 1
- **Kind:** Technology mandate
- **Priority:** Must
- **Statement:** The system shall use 0 server databases in version 1, holding progress only in browser storage.
- **Rationale:** Client mandated local-only progress for the first release.
- **Source:** JavaQuest build brief
- **Status:** Active

#### CR-004 — Run function time ceiling
- **Kind:** Hosting
- **Priority:** Must
- **Statement:** The system shall complete or abort every server-mediated run operation within 10000 ms.
- **Rationale:** Self-imposed ceiling kept from the product brief after the move to Coolify, where no host limit imposes it; it bounds run feedback inside NFR-002.
- **Source:** Q-018
- **Status:** Active

## 9. Out of scope

| ID | Excluded capability | Reason | Revisit when |
|---|---|---|---|
| OS-001 | Learner accounts and cloud sync | Triggers child consent duties; single-device scope suffices (R-014) | Multi-device use demanded by 2 or more families |
| OS-002 | Leaderboards and public rankings | Competition harms motivation for this age band (R-012) | Never |
| OS-003 | Payments and in-app purchases | No revenue goal in G-001 or G-002 | Never |
| OS-004 | Chat and sharing of learner content | Moderation burden with no learning gain for version 1 | Teacher-supervised use requested |
| OS-005 | Languages other than Java and locales other than English (India) | One language and one locale bound content cost | Second learner cohort needs another language |
| OS-006 | Native phone or tablet applications | Browser delivery meets desktop-first scope in Q-008 | Touch-only cohort exceeds desktop cohort |

## 10. Acceptance and release criteria

| ID | Criterion | Verification | Owner role |
|---|---|---|---|
| RC-001 | All Must FR acceptance criteria pass in Chrome current version | Test | Parent |
| RC-002 | NFR-004 cap probes and NFR-014 fault set pass with 0 breaches | Test | Parent |
| RC-003 | One learner aged 9 to 12 passes level 1 unaided within 15 minutes | Demonstration | Parent |
| RC-004 | Public address serves over TLS 1.2 or above with 0 host charges in first month | Inspection | Parent |

## 11. Open questions

| ID | Question | Blocks | Asked on | Owner |
|---|---|---|---|---|
| OQ-001 | What opponent health value and damage per attack command make the arena winnable in 20 to 60 commands for a level 9 graduate? | FR-011 | 2025-10-31 | Parent |

## Appendix A. Elicitation log

| ID | Question | Answer | Resulting IDs | Rationale / reference |
|---|---|---|---|---|
| Q-001 | Confirm intake restatement and storage notice | Confirmed | G-001, G-002 | Stage 1 intake |
| Q-002 | Confirm research workflows, runner, compliance candidates | Confirmed as proposed | FR-001, FR-003, NFR-016 | Research brief §2.1, §2.3, §2.5 |
| Q-003 | Confirm research entities, drivers, failures, exclusions | Confirmed as proposed | FR-004, FR-008, OS-001 | Research brief §2.2, §2.4, §2.6, §2.7 |
| Q-004 | Learner age band | Age 9 to 12 | NFR-015, AS-001 | R-006 child band |
| Q-005 | First-release cut | 10 levels plus arena plus playground | FR-002, FR-005, FR-009, FR-011, DR-006 | Overrides brief Build-Now 3-level note; scope risk stated |
| Q-006 | Who may use it | Public anyone | NFR-004, NFR-009 | Public raises abuse scope; risk stated |
| Q-007 | Pass rule | Output plus concept in code | FR-006 | Output-only admits keyword printing |
| Q-008 | Devices for code editing | Laptop and desktop first | IR-001, NFR-018 | Touch typing error risk stated |
| Q-009 | Home country for child privacy | India | NFR-019 | Jurisdiction binds duties |
| Q-010 | Progress loss and runner-down behaviour | Loss accepted with warning; block run with retry, no fake pass | FR-012, FR-013, DR-007, DR-009, NFR-014 | Consistency questions 6 and 7 |
| Q-011 | Public peak for version 1 | Up to 10 learners per day | NFR-002, NFR-003 | Capacity row in characteristics checklist |
| Q-012 | Hint cost and streak rule | Free hints; forgiving streak | FR-015, FR-016 | R-012 motivation evidence |
| Q-013 | Lesson language | English only | NFR-017, OS-005 | Localization row in characteristics checklist |
| Q-014 | Measurable win | Finish 10 levels in 60 days | G-001 | Area 1 success number |
| Q-015 | Opponent health and damage for arena (OQ-001) | User asked for a possible recommendation; values recorded as assumption pending playtest | AS-002 | 20 hits forces loop use; 100-command cap in FR-011 leaves headroom |
| Q-016 | Next.js version after the CR-001 version 14 mandate | Pin current stable Next.js 16.4.3 exactly, no version range | CR-001 | Architecture lock 2026-11-01; ADR-0001 |
| Q-017 | Hosting and runner credential after Vercel ruled out | Family Coolify server at 0 added cost; 1 secret value held server-side for the self-hosted sandbox | CR-002, IR-002 | Parent decision 2026-10-31; ADR-0002 |
| Q-018 | Keep the 10 s run ceiling with no free-plan limit | Kept as a self-imposed cap on Coolify | CR-004, NFR-002 | ADR-0003 |
| Q-019 | Stored or derived total points | Derived from passed levels; no stored total | DR-003 | FR-008 award-once makes a reset stored total unrecoverable; ADR-0006 |

## Appendix B. Glossary

| Term | Definition | Standard borrowed (if any) | Notes |
|---|---|---|---|
| Level | One ordered exercise teaching exactly 1 new Java concept | None | FR-004 |
| Pass | State where output check and concept check both hold for a level | None | FR-006 |
| Points | Integer reward added once per first pass, summed as total points | None | DR-003 |
| Badge | Named one-time milestone marker shown in progress view | None | FR-014 |
| Streak date | Device-local calendar date with 1 or more runs | None | DR-004 |
| Starter code | Initial editor text shipped with a level | None | FR-003 |
| Concept token | Required code text proving the level concept was used | None | FR-006 |
| Sandbox | Isolated execution place outside the web host with time and memory caps | None | NFR-004 |
| Playground | Unscored editor where runs change no progress | None | WF-003 |
| Arena | Level 10 battle board where robot commands replay in order | None | WF-004 |

## Appendix C. Traceability

| ID | Type | Realises / applies to | Source | Design section | Test IDs |
|---|---|---|---|---|---|
| WF-001 | WF | G-001 | Q-002 | | |
| WF-002 | WF | G-001 | Q-002 | | |
| WF-003 | WF | G-002 | Q-005 | | |
| WF-004 | WF | G-001 | Q-005 | | |
| WF-005 | WF | G-002 | Q-002 | | |
| FR-001 | FR | WF-001, G-001 | R-004 confirmed in Q-002 | | |
| FR-002 | FR | WF-001, G-001 | Q-005 | | |
| FR-003 | FR | WF-002, G-001 | R-004 confirmed in Q-002 | | |
| FR-004 | FR | WF-002, G-001 | R-002 confirmed in Q-003 | | |
| FR-005 | FR | WF-002, G-001 | Q-005 | | |
| FR-006 | FR | WF-002, G-001 | Q-007 | | |
| FR-007 | FR | WF-002, G-001 | Q-005 | | |
| FR-008 | FR | WF-002, G-002 | R-012 confirmed in Q-003 | | |
| FR-009 | FR | WF-003, G-002 | Q-005 | | |
| FR-010 | FR | WF-004, G-001 | Q-005 | | |
| FR-011 | FR | WF-004, G-001 | Q-005 | | |
| FR-012 | FR | WF-005, G-002 | Q-010 | | |
| FR-013 | FR | WF-005, G-002 | Q-010 | | |
| FR-014 | FR | WF-002, G-002 | Q-005 | | |
| FR-015 | FR | WF-001, G-002 | R-012 confirmed in Q-012 | | |
| FR-016 | FR | WF-002, G-001 | Q-012 | | |
| NFR-001 | NFR | System-wide | R-008 confirmed in Q-003 | | |
| NFR-002 | NFR | WF-002 | Q-011 | | |
| NFR-003 | NFR | System-wide | Q-011 | | |
| NFR-004 | NFR | WF-002 | Baseline B-12 | | |
| NFR-005 | NFR | System-wide | Baseline B-06 | | |
| NFR-006 | NFR | System-wide | Baseline B-07 | | |
| NFR-007 | NFR | System-wide | Baseline B-09 | | |
| NFR-008 | NFR | System-wide | Baseline B-10 | | |
| NFR-009 | NFR | WF-002 | Baseline B-12 | | |
| NFR-010 | NFR | WF-002 | Baseline B-13 | | |
| NFR-011 | NFR | System-wide | Baseline B-14 | | |
| NFR-012 | NFR | System-wide | Baseline B-01 | | |
| NFR-013 | NFR | System-wide | Baseline B-18 | | |
| NFR-014 | NFR | WF-002 | Q-010 | | |
| NFR-015 | NFR | WF-002 | Q-004 | | |
| NFR-016 | NFR | System-wide | R-007 confirmed in Q-002 | | |
| NFR-017 | NFR | System-wide | Q-013 | | |
| NFR-018 | NFR | System-wide | Q-008 | | |
| NFR-019 | NFR | System-wide | Q-009 | | |
| IR-001 | IR | WF-001 | Q-008 | | |
| IR-002 | IR | WF-002 | Q-017 | | |
| IR-003 | IR | WF-002 | Q-005 | | |
| DR-001 | DR | Run result.program text | Baseline B-11 | | |
| DR-002 | DR | Level.points | Q-005 | | |
| DR-003 | DR | Learner progress.total points | Q-019 | | |
| DR-004 | DR | Learner progress.streak dates | Q-012 | | |
| DR-005 | DR | Run result.output | Baseline B-12 | | |
| DR-006 | DR | Level | Q-005 | | |
| DR-007 | DR | Learner progress | Q-010 | | |
| DR-008 | DR | WF-001 | Q-010 | | |
| DR-009 | DR | WF-002 | Q-010 | | |
| CR-001 | CR | System-wide | Q-016 | | |
| CR-002 | CR | System-wide | Q-017 | | |
| CR-003 | CR | System-wide | JavaQuest build brief | | |
| CR-004 | CR | System-wide | Q-018 | | |

## Appendix D. Threat model

**Assets:** Learner progress record; lesson pass integrity; public pages reputation; shared runner capacity.
**Actors:** Learner, parent, anonymous network user, automated bot, compromised execution service.
**Trust boundaries:** Browser to web host; web host to execution service; browser storage to page code.

| ID | Boundary | STRIDE | Threat / abuse case | Asset | Mitigated by | Residual risk |
|---|---|---|---|---|---|---|
| TH-001 | Web host to execution service | D | Bot floods run operation to exhaust shared runner quota | Runner capacity | NFR-009, DR-001 | None |
| TH-002 | Web host to execution service | E | Learner program probes network and files to escape sandbox | Host integrity | NFR-004, IR-002 | None |
| TH-003 | Browser to web host | T | Output text injected as markup runs in victim browser | Page integrity | NFR-010 | None |
| TH-004 | Browser to web host | I | Error text discloses host paths and versions to public | Host internals | NFR-005, NFR-007 | None |
| TH-005 | Browser storage to page code | T | Hand-edited progress values forge passes and points on own device | Pass integrity on own device | DR-003 | None |

## Appendix E. Change history

| Version | Added | Changed | Withdrawn | Reason |
|---|---|---|---|---|
| 0.3 | None | CR-001 (Next.js 16.4.3 exact pin), CR-002 (Coolify hosting, 1 server-side secret), CR-004 (rationale: self-imposed cap), NFR-002 (rationale: CR-004 ceiling), IR-002 (self-hosted service, server-side key credential), DR-003 (derived total points) | None | Architecture lock after Vercel ruled out 2026-10-31; decisions recorded in ADR-0001 to ADR-0007 |



