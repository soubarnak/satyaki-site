# Mission cockpit budget note (issue #69, against issue #33)

Source measurement, 2026-11-18. No `next build` byte count is claimed here;
the numbers below are the static import proofs the unit suites enforce.

## Slim Monaco

- `components/mission-editor.tsx` carries no `monaco-editor` import. The
  production editor stays a Mission-route-only `next/dynamic` `ssr: false`
  boundary loading slim Monaco (`editor.api` + Python/Java basic languages,
  exactly one `editor.worker`, self-hosted from npm, never the CDN
  default). The textarea fallback in the same module keeps the exact
  executed-line shape, so the Mission route works before the dependency
  lands.
- `tests/unit/mission-cockpit-static.test.ts` fails on any static
  `monaco-editor` import under `app/missions/[slug]/page.tsx`,
  `components/mission-cockpit.tsx`, `components/mission-editor.tsx`,
  `components/mission-simulator.tsx`, or `lib/cockpit-playback.ts`.
- Issue #33 reference to beat at first slim build: naive full Monaco
  ~3.12 MB gzip over 96 assets is the number to avoid; slim mechanism plus
  one worker is the budget path. Record the first real slim gzip here when
  `monaco-editor` lands.

## Home route

- `tests/unit/home-static.test.ts` plus
  `scripts/assert-home-static.mjs` (run after `next build`) prove `/` holds
  the Orbit map with no loading gate and zero three/monaco bytes.
- `tests/unit/mission-cockpit-static.test.ts` proves `/` never imports the
  cockpit: `app/page.tsx` and `components/orbit-home.tsx` contain no
  `mission-cockpit` reference.

## Simulator

- `components/mission-simulator.tsx` carries no `three` / `@react-three`
  import. Production 3D is three + React Three Fiber (0.187.0 + 9.8.2 ≈
  243 KB gzip combined, per issue #33) behind a Mission-route-only
  `next/dynamic` `ssr: false` WebGL2-gated boundary, drei per-component
  only. The 2D SVG replay in the same module uses the identical trace
  stream and is also the below-floor fallback: WebGL2-missing pins to the
  poster note plus 2D/text replay, per spec §10.
