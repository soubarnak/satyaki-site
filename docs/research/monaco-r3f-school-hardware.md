# Research: Monaco and React Three Fiber cost on school hardware

Status: research complete, 2026-11-04. Ticket: GitHub issue #33 (map #29).
Unblocks: #38 (Prototype: 3-pane mission cockpit), #39 (Prototype: instant-render solar system home map), #44 (Decide debugger timeline, playback, and camera model) — conceptual consumers, no native blocking edge.

## Question

> What do Monaco and React Three Fiber cost on typical school hardware? Cover: bundle size and code-splitting so the home map renders instantly, pre-rendered 2D fallback for the solar map, target frame rate for the 3D simulator, device floor (Chromebook class), and accessibility fallbacks. Recommend budgets and loading boundaries.

## Recommendation in one paragraph

Keep both libraries off the home route entirely: ship the solar map as server-rendered DOM/SVG over a pre-rendered image (real links, instant first paint, zero three/monaco bytes), and load Monaco (slim `editor.api` + java/python basic-languages only, self-hosted from npm, one `editor.worker`) and three + React Three Fiber (~243 KB gzip combined, as of 2026-11-04) only inside the mission route behind `next/dynamic` with `ssr: false`. Target 60 fps with DPR capped at `[1, 1.5]`, `frameloop="demand"` when the scene is at rest, and an adaptive-DPR/quality ladder that steps down below ~50 fps and falls to a static poster plus text replay under a sustained 30 fps floor. The fallback if slim Monaco or the WebGL2 floor fails on school devices in prototypes #38/#39: a lightweight textarea/CodeMirror-class editor (not researched here) and a 2D canvas/SVG simulator replaying the same trace stream decided in #30.

## Grounding

Current repo facts, verified by reading the files:

- Next.js 16.4.3, React/ReactDOM 19.3.0, TypeScript ^5, and **zero** of monaco-editor, three, @react-three/fiber, @react-three/drei, or Pyodide today (`package.json`, read 2026-11-04). Every size below is additive cost.
- The image is built from the repo `Containerfile` on a digest-pinned `node:24-bookworm-slim`. Per the repo rule, local and manual builds use podman, never Docker (`Containerfile`: "Build with podman, never Docker"); the hosted production build is Coolify's, which is Docker-based third-party infrastructure we do not control (`Containerfile` line 3 says so itself) — flagged here, not worked around. Nothing in this research changes the image shape — Monaco/three are static client assets served by the existing Next standalone server.
- The runner is self-hosted Piston behind a gateway (`deploy/piston/`, `docs/adr/0002-0004`, `lib/server/piston.ts`, `lib/server/classify.ts`). It stays fallback/CI oracle per #30; it is not in the rendering path.

Destination facts that drive the answer (map #29, decision #30):

1. **Two very different routes.** The home solar map must render instantly for a class of kids on school hardware; the mission cockpit is a deliberate click-in where a one-time heavier load is acceptable. That asymmetry is the whole loading-boundary design.
2. **The 3D sim is trace replay, not a live game engine requirement.** Per #30, runners emit a bounded trace `{ step, line, kind, locals, shipDelta }` (max 500 events, 500-step / 3-second guard) and the debugger UI is pure replay. The scene is small (one ship, one planet area, props), mostly at rest, and every frame shown already exists as data. That makes on-demand rendering, 2D fallback, and text fallback all cheap: a 2D renderer and a text narrator consume the same trace the 3D renderer does.
3. **Only two languages ever appear in the editor: Python and Java.** Monaco never needs its ~80 bundled languages or the TypeScript/JSON/CSS/HTML language-service workers.

## Bundle size: what each library actually costs

Source class for all sizes in this section: Bundlephobia's size API over the published npm artifacts, fetched 2026-11-04. That is a measurement of the first-party npm package, not a vendor-documented number; no vendor publishes official bundle budgets, so this is the primary *artifact* evidence available, and prototype builds in #38/#39 must re-measure.

### Monaco

- Full `monaco-editor@0.57.0` is the expensive case: the published package's assets sum to roughly **3.12 MB gzip** (3,122,103 B summed over all 96 Bundlephobia assets, independently re-summed on review) (main chunk alone 1,063,851 B gzip; a second chunk 1,397,286 B gzip; CSS 27,854 B; codicon font 75,392 B; dozens of language chunks) — https://bundlephobia.com/api/size?package=monaco-editor. Shipping `import * as monaco from 'monaco-editor'` naively means shipping every language and feature the VS Code editor has. This is the number to avoid, not the number to budget.
- The official slimming path exists and is documented by the vendor: import `monaco-editor/esm/vs/editor/editor.api` "if shipping only a subset of the features & languages is desired", and pass `languages` / `features` subsets (with `!` exclusions) to `monaco-editor-webpack-plugin` to generate a smaller bundle — https://github.com/microsoft/monaco-editor/blob/main/webpack-plugin/README.md. The ESM integration guide (official) shows the same packaging with explicit per-language worker entries — https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md.
- Java and Python are *basic languages* (tokenizer + language config, no language service): in the package's own `esm/metadata.js` (0.55.1, verified 2026-11-04), `java` → `vs/basic-languages/java/java.contribution` and `python` → `vs/basic-languages/python/python.contribution`, while only css, html, json, and typescript carry worker entries in that metadata (JavaScript shares the TypeScript worker via the ESM guide's label mapping). So a Python+Java-only editor needs exactly **one** worker: `editor.worker` (`monaco-editor/esm/vs/editor/editor.worker.js`), wired via `self.MonacoEnvironment.getWorkerUrl`/`getWorker` per the ESM guide above. No ts/json/css/html workers, no TS language server in the browser.
- `@monaco-editor/react@4.7.0` itself is tiny (14,060 B min / 4,814 B gzip, wrapper only; monaco-editor is a peer) — https://bundlephobia.com/api/size?package=%40monaco-editor%2Freact — and supports React 19. But its **default downloads monaco from a CDN** at runtime (@monaco-editor/loader), overridable two ways documented in its README: `loader.config({ paths: { vs: '...' } })` to point elsewhere, or since v4.4.0 `loader.config({ monaco })` to use the npm package in your own bundle — https://github.com/suren-atoyan/monaco-react. **Recommendation: self-host from npm, never the CDN default.** School networks filter third-party CDNs unpredictably, a CDN fetch defeats the offline/cache story, and the same Coolify origin already serves everything else. If the wrapper's loader fights Next bundling, dropping the wrapper and calling `monaco.editor.create` directly inside a dynamic client component is equally supported by the vendor ESM guide — the wrapper is convenience, not load-bearing.
- The exact gzip of the *slim* build (editor.core + editor.api + two basic languages + editor.worker + CSS + codicon) was **not measured** in this research; see Unverified. Budget it as a cap to enforce at #38 prototype time (see Budgets), not as a known figure.

### Three.js + React Three Fiber (+ drei)

- `three@0.187.0` (r187): 742,263 B minified / **185,679 B gzip** for the full module build (`build/three.module.js`), zero dependencies — https://bundlephobia.com/api/size?package=three. Three is a single large module; tree-shaking named imports helps some, but plan against ~186 KB gzip until #38 measures a real scene build.
- `@react-three/fiber@9.8.2`: 182,907 B min / **57,680 B gzip**, *excluding* peer `three` and React (already present) — https://bundlephobia.com/api/size?package=%40react-three%2Ffiber. So the realistic 3D stack is **~243 KB gzip on top of React**, before scene code and assets.
- `@react-three/drei@10.7.9` whole-library is 521,499 B gzip (it drags three-stdlib, troika text, hls.js, mediapipe, etc. when imported wholesale) — https://bundlephobia.com/api/size?package=%40react-three%2Fdrei. Drei is used per-component and tree-shakes, but the safe posture for this project is: **do not add drei for the prototype.** The two drei features wanted (adaptive DPR, fps monitoring) sit on documented R3F primitives (`setDpr`, the performance `regress` mechanism, `useFrame` timing) and can be hand-rolled in tens of lines, or drei can be added later with named imports only and a measured delta. Never `import * from '@react-three/drei'`.

## Loading boundaries: home map instant, mission route pays

Next.js official lazy-loading guidance gives the boundary mechanism: `next/dynamic` (a composite of `React.lazy` + Suspense) defers Client Components and libraries so they enter the client bundle only when needed, `dynamic(() => import(...), { ssr: false })` is the client-only form, and `ssr: false` must live in a Client Component (it is rejected in Server Components) — https://nextjs.org/docs/app/guides/lazy-loading. Rules that follow:

1. **Home route (`/`): zero monaco, zero three bytes.** No static import of either library anywhere in the home route's module graph — including type-only-looking re-exports through shared barrels. The map is present in SSR HTML (see 2D fallback next section). Prefetch behaviour must not pull the mission chunks on map hover/idle until measured; if Next link prefetch fetches the mission route's JS, that is a budget violation to catch in #39.
2. **Mission route: two independent dynamic boundaries.** `EditorPane = dynamic(() => import('./EditorPane'), { ssr: false })` and `SimPane = dynamic(() => import('./SimPane'), { ssr: false })` as separate chunks, each with a sized skeleton in the 3-pane layout so load order never shifts the brief pane. The brief/instructions pane is plain server-rendered React and is readable before either chunk lands — a kid on a slow school link reads the mission while the editor downloads. Monaco and R3F must not share a chunk: a WebGL-less device should still get the editor, and an editor failure must not block sim replay of starter traces.
3. **Capability-gate the 3D chunk, don't just catch its crash.** Detect WebGL2 *before* importing SimPane; if absent, render the 2D/poster sim and never fetch three at all. R3F's Canvas also accepts a `fallback` prop rendered when GL is unsupported (https://r3f.docs.pmnd.rs/api/canvas) — use it as the second line of defence, not the first, because by then the chunk is already paid for.
4. **Workers are part of the boundary.** `editor.worker` must be emitted as a separate cached asset routed through `MonacoEnvironment.getWorker`/`getWorkerUrl` (official ESM guide above). The Cadet Java interpreter and Pyodide (#30/#31) already live in their own workers; Monaco's editor worker is a *fourth* background thread on a possibly 2-core device — another reason it loads only on the mission route and is disposed on leave (`monaco.editor` models/editors are `IDisposable` per the official API types).

## Pre-rendered 2D fallback for the solar map (which is also the primary)

The home map is not "3D with a fallback" — the 2D version is the product:

- **Structure:** server-rendered DOM/SVG — 5 planet nodes, 25 level nodes — as real `<a>`/`<button>` elements with level names, lock/complete state from progress, positioned over a pre-rendered static backdrop image. The backdrop is a build-time asset (rendered once from the eventual 3D scene or art-directed as an illustration), served via `next/image`, which provides automatic optimization, responsive `sizes`, `preload` for the LCP image, and blur placeholder support — https://nextjs.org/docs/app/api-reference/components/image.
- **Why this wins:** first paint needs no WebGL context, no shader compile, no bundle parse beyond the app shell; progress state can render server-side for logged-in cadets (account is source of truth) and hydrate from localStorage logged-out without layout overhaul; screen readers and keyboard users get a navigable list of missions for free instead of a canvas (see Accessibility).
- **Progressive enhancement, optional:** a later ticket may layer a WebGL solar map over the same DOM skeleton on capable devices, but #39 should prove the 2D map alone is delightful and instant. If 3D enhancement ever ships, it loads idle-time, after LCP, behind the same WebGL2 gate — never as a replacement for the DOM nodes.
- **The mission sim gets the same treatment one level down:** a pre-rendered poster frame (static image of the level's 3D scene) sits behind/inside the SimPane skeleton, so the pane is never a black rectangle while three downloads or compiles shaders; on fallback devices the poster plus 2D trace replay (ship marker moved on a 2D projection of the same `shipDelta` stream) *is* the sim.

## Frame rate: 60 target, adaptive ladder, 30 floor

Grounded points: three.js/R3F apps "usually run in a game-loop that executes 60 times a second", and the official R3F scaling guidance is to avoid paying that when nothing moves: `frameloop="demand"` renders only when needed (prop changes or explicit `invalidate()`), saving battery and fan noise on weak devices — https://r3f.docs.pmnd.rs/advanced/scaling-performance. Canvas defaults that matter here: `frameloop` default `always`, `dpr` default `[1, 2]`, `antialias=true`, `powerPreference="high-performance"` — https://r3f.docs.pmnd.rs/api/canvas. Drei's `PerformanceMonitor` documents the standard adaptive pattern: sample average fps over iterations, fire `onDecline`/`onIncline` outside a bounds margin (its documented default bounds function is `(refreshrate) => refreshrate > 90 ? [50, 90] : [50, 60]`), gradually alter quality, and `onFallback` after too many flip-flops to pin a fixed baseline — https://drei.docs.pmnd.rs/performances/performance-monitor. `AdaptiveDpr` "cut[s] the pixel-ratio on regress according to the canvas's performance min/max settings" to trade visual quality for performance, optionally pixelated for even faster rendering — https://drei.docs.pmnd.rs/performances/adaptive-dpr.

Budget ladder for the simulator (the 30 fps floor is this research's recommendation, not a vendor number — the vendor-anchored points are 60 loop and ~50 decline threshold):

| Sustained fps | Action |
| --- | --- |
| ≥50 | Full quality: dpr up to 1.5 (cap below the `[1,2]` default — Retina-class dpr 2 quadruples fragment cost for little gain on small school screens), shadows/AA as authored |
| 30–50 (onDecline) | Step down in order: dpr → 1.25 → 1.0 (pixelated if needed), disable shadows, disable antialias/post, simplify materials. Step back up only on sustained incline, with hysteresis |
| <30 sustained, or flip-flop exhaustion | Pin low baseline (onFallback pattern). If still <30: freeze to poster + 2D trace replay for that session, remember the choice, offer "try 3D again" |
| Idle / replay paused | `frameloop="demand"`; render on trace-step change, camera change, or hover only. A paused debugger should cost ~0% GPU — critical when Monaco + workers share a 2-core machine |

Because replay is data-driven (#30), frame rate never affects correctness: stepping shows trace state N regardless of fps, and playback speed is a UI clock, not simulation time. #44 owns that model; this ticket only hands it the fps ladder and the demand-rendering rule.

## Device floor: Chromebook class, defined functionally

The hard technical floor comes from three.js itself: current `WebGLRenderer` "uses WebGL 2 to display scenes. WebGL 1 is not supported since r163" — https://threejs.org/docs/pages/WebGLRenderer.html. There is no supported WebGL1 path in a current three/R3F stack, so **WebGL2 with hardware acceleration is the 3D floor**; below it, the 2D sim is the product, not an error state.

No primary vendor page found in this research pins a single "typical school Chromebook" CPU/GPU/RAM (Google's education pages confirm Chromebooks as the K–12 assessment platform class but do not publish one reference spec) — see Unverified. So define the floor functionally and verify empirically in #38/#39:

- **Must run full experience:** WebGL2 available + hardware-accelerated canvas, ≥1366×768-class viewport, keyboard attached (Chromebook clamshell), a browser new enough for Next 16/React 19 output.
- **Must run degraded (editor + 2D sim + full grading):** no WebGL2, software GL, or sustained <30 fps. Nothing pedagogical may require 3D: pass/fail is trace/state-based per #30, never pixel-based.
- **Test protocol #38/#39 owe:** name 1–2 real floor devices (or a throttled profile approximating a low-end dual-core Celeron/MT-class Chromebook: 4× CPU throttle, dpr 1, 1366×768) and measure cold mission-route load, Monaco first-keystroke latency, and a 500-event replay at each ladder rung. Containerized CI checks, if any, use podman, never Docker, per repo rule.

## Accessibility fallbacks

- **Editor:** Monaco's official API surface includes `accessibilitySupport?: 'auto' | 'off' | 'on'`, `accessibilityPageSize` (lines readable by a screen reader), and `ariaLabel` on editor options (monaco-editor 0.55.1 `editor.api.d.ts`, fetched from the published package 2026-11-04 — https://unpkg.com/monaco-editor@0.55.1/esm/vs/editor/editor.api.d.ts). Ship `accessibilitySupport: 'auto'`, a kid-worded `ariaLabel` per mission, visible focus management between the 3 panes, and full keyboard paths for Run/Step/Scrub *outside* the editor so debugger control never depends on Monaco command-palette knowledge. A plain-textarea "simple editor" toggle (same model value, no Monaco) is the guaranteed screen-reader/touch fallback and doubles as the no-JS-heavy fallback — cheap, because the interpreter consumes text either way.
- **Motion:** honour `prefers-reduced-motion` (MDN: the media feature signals the user prefers minimised non-essential motion — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): no camera fly-throughs, no auto-orbit, playback becomes step/jump between trace states, map transitions become instant. Query it in JS before deciding the initial camera behaviour, not only in CSS.
- **Sim without sight or canvas:** the trace gives a free text channel — current line, `locals`, and `shipDelta` narrated as a step log ("Step 12, line 4: ship moved to (2, 3), fuel 7") in an aria-live polite region during stepping, plus a static results summary on pass/fail. The 2D sim and poster carry real `alt`/figcaption text (next/image requires `alt` — docs above). Colour is never the only channel for ship state; labels/icons duplicate it.
- **Map:** the DOM-first map is the accessibility story — headings, a list of planets/levels, real links, visible focus, completion stated in text ("Level 3, complete"), not only badge colour.

## Budgets (decisions to enforce, not vendor facts)

| Route / concern | Budget |
| --- | --- |
| Home `/` heavy-lib JS | 0 B monaco + 0 B three/fiber in initial or prefetched chunks; backdrop image via next/image with `sizes`, preloaded; map interactive from SSR HTML + app shell only |
| Mission route first load (cold, above React shell) | three+fiber ≤ ~260 KB gzip (measured 243 KB + scene code headroom); slim Monaco chunk + CSS + font + editor.worker capped at a number #38 sets after first slim build — hard fail if the full-language build (~3.12 MB gzip) reappears |
| Workers on mission route | editor.worker only from Monaco (no ts/json/css/html workers); disposed on route leave |
| Sim rendering | dpr `[1, 1.5]`; `frameloop="demand"` at rest; decline ladder at <50 sustained; 2D/poster pin at <30 sustained |
| Assets | No drei in prototype; any later drei named import must show its measured gzip delta in the PR that adds it |
| Enforcement | Record per-route chunk sizes from the Next production build in #38/#39 prototypes and keep them in the PR description; budgets re-checked whenever dependencies change |

## Unverified — do not plan against as facts

- Exact gzip of the slim Monaco build (editor.api + java/python basic-languages + selected features + editor.worker). Only the full-package figure (~3.12 MB gzip total assets; Bundlephobia over npm artifact monaco-editor@0.57.0, 2026-11-04) and the official slimming mechanism are verified. Any "Monaco slim is ~X KB" figure from secondary sources was deliberately not used. #38's first build is the measurement. Version pin note: entry paths and accessibility options in this document were verified against monaco-editor@0.55.1 metadata/`editor.api.d.ts`, while sizes cite the 0.57.0 package; at 0.57.0 the language entries moved (`vs/languages/definitions/java/register`, similarly python — verified on review, still no worker for java/python). #38 must pin one Monaco version and re-cite paths and API at that version.
- Tree-shaken three size for a minimal scene (below the full-module 185,679 B gzip), and per-import drei cost. Both need prototype builds.
- Any specific school-Chromebook spec (CPU model, cores, RAM, GPU, fleet age) and what fraction of the target fleet has working hardware-accelerated WebGL2. No primary vendor reference spec was found; the functional floor above substitutes until real devices are tested.
- Achieved fps, shader-compile time, Monaco parse/initialisation time, and memory use on Chromebook-class hardware. The 60/50 points are vendor-documented loop/monitor defaults; the 30 fps floor and all KB caps are budget decisions from this research, not measurements.
- `monaco-editor-webpack-plugin` (a webpack plugin, per its official README) inside Next.js 16.4.3's default (Turbopack) production build. Untested in this repo; the plain-ESM manual-packaging path in the official integrate-esm guide is the fallback wiring #38 should try if plugin integration resists.
- Whether Next `<Link>` prefetch on the home map pulls mission-route chunks early enough to break the 0-byte rule in production configuration. Needs a network trace in #39.
- School-network bandwidth/latency, CDN filtering behaviour, and resulting real LCP/TTI numbers. The self-host recommendation rests on the verified CDN-default behaviour of @monaco-editor/loader, not on measured school networks.
- Bundlephobia figures may drift with patch releases after 2026-11-04 (observed latest: monaco-editor 0.57.0, three 0.187.0, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, @monaco-editor/react 4.7.0). Pin exact versions like the repo pins Next (ADR-0001) and re-measure at adoption.

## Implications for downstream tickets

- **#38 (Prototype: 3-pane mission cockpit)** gets: two separate `ssr: false` dynamic boundaries (editor, sim) with SSR brief pane; slim-Monaco wiring (editor.api, java+python only, one editor.worker, self-hosted via npm — override @monaco-editor/react's CDN default or skip the wrapper); WebGL2 gate before the three import plus Canvas `fallback`; dpr `[1, 1.5]` and demand frameloop as starting config; textarea simple-editor toggle. It still owns: first slim-Monaco size measurement and cap, Turbopack/worker wiring proof, the named floor device + throttling profile, pane layout and focus management, and per-route chunk reporting.
- **#39 (Prototype: instant-render solar system home map)** gets: DOM/SVG-first map with real level links over a pre-rendered next/image backdrop as the primary artifact (not a fallback), 0-byte heavy-lib rule including prefetch. It still owns: art direction of the backdrop (and whether it is rendered from the 3D scene), progress-state rendering logged-in vs localStorage, prefetch network verification, and any later idle-time 3D enhancement decision.
- **#44 (Decide debugger timeline, playback, and camera model)** gets: trace-replay rendering is fps-independent; 60 target / 50 decline / 30 floor ladder with adaptive DPR → shadows/AA → poster+2D pinning; `frameloop="demand"` for paused/stepped states; reduced-motion = step/jump not flight; aria-live step narration from `{line, locals, shipDelta}`. It still owns: playback speeds, scrub semantics, camera presets vs free-orbit (and their regress cost), and how quality state persists per cadet/device.