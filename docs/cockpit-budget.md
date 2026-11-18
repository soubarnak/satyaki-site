# Mission cockpit budget note (issue #69, against issue #33)

Measured from `next build` output, 2026-11-18 (gzip via node zlib).
Pinned versions: `monaco-editor@0.57.0`, `three@0.187.0`,
`@react-three/fiber@9.8.2`, `react@19.3.0`, `next@16.4.3`.

## Slim Monaco (Mission route only, dynamic `ssr: false`)

| Asset | Raw | Gzip |
|---|---|---|
| Editor core (`editor.api` + Python/Java registers + one `editor.worker`) | 2,373,054 | 586,563 |
| Python language (lazy, on first Python model) | 3,831 | 1,524 |
| Java language (lazy, on first Java model) | 3,211 | 1,451 |
| Worker stubs (2 files) | 837 | 412 |
| Self-hosted stylesheet (`public/monaco/v0.57.0/editor.main.css`, font inlined, no CDN) | 390,829 | 127,302 |
| **Monaco total** | **2,771,762** | **~717,000** |

Against the #33 budget: the naive full Monaco build (~3.12 MB gzip over
96 published assets) is avoided — this route ships ~0.70 MB gzip, 77%
smaller. The core is the documented slim floor: `editor.api` carries the
standalone browser services (diff/bracket/format ride along; no
all-language bundle — verified zero `abap`/`monaco-lsp`/`editor.main`
bytes in the chunk), plus only the two learner languages and exactly one
`editor.worker`. A custom sub-`editor.api` build would be further work and
is out of scope.

## Language workers (Mission route, lazy on first Run)

| Asset | Raw | Gzip |
|---|---|---|
| `public/workers/python-worker.js` (esbuild, Pyodide binding + trace) | 12,070 | 3,983 |
| `public/workers/java-worker.js` (esbuild, Cadet Java interpreter) | 264,247 | 77,547 |

Built by `scripts/bundle-workers.mjs` (esbuild, `prebuild`/`predev`);
plain `/workers/*.js` URLs so browsers get the JavaScript MIME type.
(Turbopack copies `new URL(../workers/*.ts)` as a raw `.ts` asset with a
video MIME type, which module workers refuse — verified in-browser.)

## Headless verification (2026-11-18, Playwright Chromium + SwiftShader)

One pass over the public interface on `/missions/p1-m1`, all green:
Python and Java passing programs replay (3 gold ticks each), line
highlight follows loop re-hits (`1,2,1,2,1,3` Python; `4,5,4,5,4,7`
Java), step-back re-folds from the folded World State, play/pause/step/
reset and 1x/2x/4x through the transport, manual Top-down/Chase/Free-orbit
cameras, HUD pose readout, hover inspection naming the square, Training
Wheels badge on the Java toggle, collapsible console, post-pass Rosetta
Pair. R3F canvas paints 42.52% non-background pixels; rAF holds 60.3 fps
under software GL; zero console errors and zero failed requests.
Screenshots in `/tmp/w3d-cockpit/` (scratch only, not committed).

Import paths for 0.57.0 (the package export map doubles an `esm/vs/`
prefix, so the slim entry is): `monaco-editor/editor/editor.api`,
`monaco-editor/languages/definitions/python/register`,
`monaco-editor/languages/definitions/java/register`,
worker `monaco-editor/editor/editor.worker`.

## Simulator (Mission route only, dynamic `ssr: false`)

| Asset | Raw | Gzip |
|---|---|---|
| three 0.187.0 + React Three Fiber 9.8.2 (no drei anywhere) | 927,568 | 244,219 |

Matches the #33 estimate (243 KB gzip combined). `frameloop="demand"`,
`dpr` capped [1, 1.5], no postprocessing, manual cameras only.

## Home route

`node scripts/assert-home-static.mjs` (page-level, via the route
manifests): prerendered `/` HTML holds the Orbit map with no loading
gate, and all 9 home-route chunks are clean of three/monaco bytes. The
heavy chunks above load only from `/missions/[slug]`. WebGL2-missing
pins to the poster note plus the 2D SVG/text replay on the same trace.
