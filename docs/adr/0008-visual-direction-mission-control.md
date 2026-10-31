# ADR-0008 — Visual direction: Mission control

**Status:** Accepted (parent, 2026-11-01)
**Decides:** GitHub issue "Space-robot visual direction and level 1 slice"
**Implements:** Look and layout for FR-001 (level map) and FR-003 (lesson
screen); presentation side of NFR-015 (novice first pass) and NFR-016
(WCAG 2.1 AA)

## Context

The SRS and map fix a space-robot quest theme for ages 9–12 that must read
as appealing, not babyish, with the whole lesson loop (story, objective,
starter code, hint, Run, output) on one screen (FR-003). A throwaway
prototype (`prototype/level1-slice/`) rendered three structural variants of
the Level 1 screen behind one `?variant=` switch: A "Mission control"
(planet map as a left rail), B "Quest log" (map path across the top, story
first, editor below the fold), C "Cockpit console" (editor first and
largest, map strip at the bottom). The parent reacted to the prototype on
2026-11-01 and picked variant A, reporting that the slice works. Exact
unaided first-pass timing was not reported, so formal NFR-015 evidence
(RC-003) is still owed at QA; this ADR locks only the visual direction.

## Decision

Version 1 uses the **Mission control** direction on every learner view:

- **Layout:** ordered planet map as a persistent left rail; story and robot
  buddy in a centre column; editor, Run controls, and output in the main
  column — all visible without scrolling at 1024 px width (FR-003).
- **Palette (from the prototype, AA-checked):** deep navy background
  `#0b1e2d`, panel `#123047`, body text `#f2f7fa`, primary action amber
  `#ffc53d` with near-black text, passed-state green `#146c43`. Computed
  contrast for body text, Run button, output, and locked-planet pairs all
  pass WCAG AA (lowest 6.57:1 in this variant); the automated AA scan of
  NFR-016 is still owed at QA.
- **Type:** Verdana/Geneva for learner prose, Trebuchet MS for headings,
  monospace only for code and output. Minimum body size 17 px, line-height
  1.55; learner sentences stay inside the AS-001 20-word budget.
- **Robot buddy:** Bolt, a simple geometric SVG robot with a speech bubble
  carrying hints and run feedback (FR-007 child-readable line first).
- **State language:** planets read locked / open / passed in text, never by
  colour alone, matching FR-001 and FR-002.

The prototype is the visual reference, not code to promote: build tickets
rewrite it properly inside the Next.js app (ADR-0001, ADR-0007). The
prototype remains as a primary source for the reaction, to be captured on a
throwaway branch; it never merges to main as production code.

## Consequences

- Map view and lesson player tickets inherit fixed layout, tokens, and type;
  reviewers can diff built screens against prototype variant A.
- The left rail costs horizontal room on narrow screens; below the SRS
  1024 px design width the rail wraps to a horizontal strip, as the
  prototype does under 820 px.
- Later views (playground, arena, progress) reuse the same navy/amber
  tokens and Bolt, keeping one visual system (map Notes, space-robot theme).

## Rejected alternatives

- **B "Quest log":** warm and readable, but story-first ordering pushes the
  editor and Run below the fold, breaking the one-screen loop of FR-003.
- **C "Cockpit console":** editor-first suits confident coders, but hides
  the mission text and planet map that a first-time 9-year-old needs in
  view for NFR-015.
