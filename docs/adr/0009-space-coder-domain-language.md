# ADR-0009 — Space Coder domain language: Mission, world-state Pass, Stars

**Status:** Accepted (2026-11-04)
**Decides:** [Lock domain language and glossary for Space Coder](https://github.com/soubarnak/satyaki-site/issues/34), part of [Satyaki Space Coder — way to dual-language 3D platform spec](https://github.com/soubarnak/satyaki-site/issues/29)

## Context

Version 1 shipped as JavaQuest for ages 9–12: ten Java-only text Levels
where Pass meant an output check plus a concept-token check on code text.
The Space Coder rework is dual-language (Python 3 and Java) and 3D, for
ages 10–13, with grading on World State. Every later decision ticket on
the map (Ship API, grader, mission content, progress, cockpit) needs one
vocabulary, and keeping the v1 words would silently keep the v1 meanings.

## Decision

`GLOSSARY.md` is rewritten to the Space Coder language:

- Product name is **Satyaki Space Coder**; JavaQuest is retired except in
  historical references. The site URL does not change.
- Audience is ages **10–13** inclusive.
- **Level** becomes **Mission** in learner text, code, and content.
  A **Planet** is five Missions; a **Boss Gate** closes each Planet.
- **Pass** is a required final or intermediate **World State** holding —
  never code text, never stdout. Pass awards **Star 1**; Star 2 is a Pass
  within par; Star 3 is a Pass using the Planet concept. Exact par,
  concept-check, and seed rules are the grader ticket's, not this ADR's.
- **Concept token**, **Content pack**, and **Badge** are deleted with no
  successor term. Stars (and later hangar unlocks) are the only reward
  language; mission content schema is the content ticket's.
- **Bolt** is retired. Any guide voice is named by the cockpit prototype.
- **Cadet** is the learner in learner-facing text; **Account** is the
  verified login record in auth/developer text only. One Account holds
  one Cadet's progress in v1.
- **Save Code** is the export/import progress string for logged-out use
  and device moves — explicitly not a backup or recovery code, since it
  proves no identity. Format and sync rules are the progress ticket's.
- **Ship API** is identical across languages in meaning and argument
  order, named snake_case in Python and camelCase in Java. The concrete
  command set is the Ship API ticket's; the glossary records only the
  naming convention.
- **Playground** (ungated, no Pass, no Stars) and **Arena** (challenges
  outside the 25-Mission path) are defined as spaces; their contracts
  are a later ticket's.

## Consequences

- ADR-0006 and ADR-0008 keep their storage and visual decisions as v1
  record, but their ages 9–12 and output-based Pass wording is
  superseded *in language* by this ADR. Replacement storage and visual
  decisions come from the progress, auth, and prototype tickets.
- Code, content, and UI still say Level/Bolt/Badge today; renaming them
  is build work after the map hands off, not part of this decision.
- Later tickets must use the glossary terms or amend the glossary
  through their own resolution — no silent synonyms.
