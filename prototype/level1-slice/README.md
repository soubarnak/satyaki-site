# PROTOTYPE — Level 1 slice (throwaway)

**Verdict (2026-11-01): Variant A "Mission control" won.** Decision recorded
in `docs/adr/0008-visual-direction-mission-control.md`. This folder is kept
only as the visual reference for that decision; production UI is rebuilt in
the Next.js app, never promoted from here.

Ticket: "Space-robot visual direction and level 1 slice" (map: "JavaQuest — way to shipped Coolify site").

Question this answers: which visual direction works for ages 9–12, and can a
first-time learner pass Level 1 (print) unaided inside 15 minutes (NFR-015 signal)?

## Run it

```sh
cd prototype/level1-slice
node serve.mjs
```

Then open `http://127.0.0.1:8765/?variant=A` in a browser
(also `B`, `C`, or use the black pill at the bottom to flip designs).

No Node? Any static file server in this folder works. Opening `index.html`
as a file also works, except the `?variant=` link then matters less.

Monaco loads from a CDN. With no network, the editor falls back to a plain
text box after 4 seconds; everything else still works.

## Variants

- **A — Mission control:** planet map as a left rail, dark navy, amber Run button.
- **B — Quest log:** planet path across the top, light page, story first, wide editor.
- **C — Cockpit console:** editor first and largest, mission panel on the right, map strip at the bottom.

## Fake parts (on purpose)

- "Run code" is simulated in the browser. It understands only
  `System.out.print/println("...")` with text in quotes. The real runner
  (self-hosted Piston) arrives with the build tickets, not this slice.
- Points, pass state, and badge live in memory only. Reload resets them.
- Planets 2–10 are map furniture; only Level 1 exists.

## Reaction session (what closes the ticket)

1. Seat one learner aged 9–12. Say only: "Open this and try the mission."
2. Do not help. The mission clock in the header times the session.
3. Note: time of first pass (footer shows it), where they got stuck, which
   words they could not read, and which variant they liked after flipping.
4. Parent reaction: does it look right for 9–12 (fun, not babyish)?

Record the answers on the ticket. The winning variant gets rebuilt properly
in the Next.js app; this folder then moves to a throwaway branch.
