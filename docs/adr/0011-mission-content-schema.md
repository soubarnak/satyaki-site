# ADR-0011 — Mission content schema: typed data, declarative checks

**Status:** Accepted (2026-11-05)
**Decides:** [Decide level content model for 25 levels and boss gates](https://github.com/soubarnak/satyaki-site/issues/37), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)

## Context

Space Coder has 25 Missions in five Planets, each Planet closed by a
Boss Gate, in Python 3 and Java. Content must be authorable without
code changes, yet the cockpit, state grader, progress record, and
skill radar all consume it. Progress keys off Mission identity
(ADR-0010), Pass is World State (ADR-0009), and v1 (`lib/levels.ts`)
showed a typed in-repo content file works, but its exact-output and
concept-token fields are the model being replaced.

## Decision

Content lives in typed TypeScript data modules, one per Planet, each
exporting one Planet record, five Mission records, and one Boss Gate
record. The TypeScript types plus build tests are the schema
validator. No database, CMS, JSON content, or runtime schema library.

Every Mission carries a permanent slug (for example `p2-m3`), never
reused or renumbered, plus `planet` and `position`; progress keys off
the slug. A Planet record carries `id`, `slug`, `name`, `themeId`,
`planetConceptId`, and its ordered Mission slugs, with no story text.

Each Mission carries exactly one new `conceptId` and the Planet
concept (`planetConceptId`), both from closed enums shared by both
languages; `tier` (`intro`, `core`, `stretch`, defaulting from
position); `title`, `story` (max 280 characters), `briefing` (one
sentence), and `objectives` (one to three Cadet-facing goals); starter
code for both Python and Java; a declarative world layout; a seed
pool; declarative Pass checks; `par` (`maxSteps`, `maxEnergy`);
`star3Concept` (a reference to the Planet concept only); three hints;
and a Rosetta Pair. The schema is closed: no time estimates,
prerequisites, media paths, or translated text in v1; a new field
needs a new decision.

Starter code: the editable region is marked `YOUR CODE BELOW` /
`YOUR CODE ABOVE` as language comments (`#` in Python, `//` in Java).
Java starter code carries a Training Wheels stage: `full-scaffold`
(full class and main given; Planets 1–2), `partial` (skeleton given;
Planets 3–4), or `minimal` (comment prompt only; Planet 5),
overridable per Mission. Build validation requires that starter code
parses and that markers appear exactly once where the stage needs
them.

Layout is `shipStart` (position, heading, starting energy) plus a
declarative entity list (`type`, `id`, position, typed props). Grid,
coordinate, and collision rules belong to the Ship API decision.
Content holds one authored layout and a pool of integer seeds; the
first seed is the practice layout the Cadet sees, the rest are hidden
grading layouts. Seed variation is generated deterministically from
the authored layout; there are no per-seed authored layouts in v1.

Pass checks are declarative only: stable `id`, Cadet-facing `label`,
`statePath`, comparator, expected value, and timing (`final` or
`intermediate`). Each objective maps to one or more check ids. No
per-Mission grading code is allowed in content; check semantics,
Star 2 par interpretation, the Star 3 AST mapping, seed counts by
tier, and failed-check feedback belong to the state grader decision.

Hints are exactly three tiers (nudge, stronger, near-solution), the
same text for both languages, unlocked in order on demand with no
failed Run required; each viewed tier counts toward stored hints
used. A Rosetta Pair is a per-language snippet (max 12 lines, must
parse) using the Planet concept, plus one shared one-line note,
revealed only after a Pass.

A Boss Gate is its own record type. Part A is five quiz items in
fixed authored order, each `choice`, `spot-bug`, or `predict-state`,
with a prompt, three or four options, the correct index, and a
one-line explanation; four of five passes, with unlimited retries
and no cooldown, and Part B unlocks only after Part A passes. Part B
is one coding challenge reusing the Mission fields for layout, Pass
checks, both starter codes, three hints, and seed pool; it has no
par, Star 3 concept, Rosetta Pair, or tier, and awards no Stars.

Every Mission and Boss Part B requires one reference solution per
language, stored outside shipped content; a build test runs each
solution on every seed and it must Pass. Content without passing
reference solutions is invalid. Reference solutions never ship to
Cadets (the v1 rule).

## Consequences

- Authors add or fix Missions by editing one Planet data file; the
  type checker and build tests reject malformed content.
- Renumbering or reordering Missions cannot corrupt saved progress,
  because progress keys off permanent slugs.
- The grader, cockpit, radar, and future build tickets all read one
  schema; Ship API entity vocabulary and grader semantics plug into
  fixed shapes without reopening content.
- Authoring cost stays flat: one layout, one check list, and two
  starter codes per Mission, with generated seed variation.

## Rejected alternatives

- JSON content plus a runtime schema library or CMS: adds a second
  validator and an editing surface the type checker already covers.
- Per-Mission grading code: authoring would need code changes and
  review per Mission, and content could break the grader contract.
- Per-seed authored layouts: multiplies authoring and testing cost
  by the seed pool size for variation a generator provides.
- One layout per language or per-language stories: breaks the locked
  Python/Java parity of one shared 25-Mission journey.
