// Build-output proof for issue #68: `/` is static with no three/monaco
// chunks and the prerendered HTML holds the map with no loading gate.
// Run after `next build`: `node scripts/assert-home-static.mjs`.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const NEXT = join(ROOT, ".next");

function fail(message) {
  console.error(`assert-home-static: FAIL: ${message}`);
  process.exit(1);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else yield full;
  }
}

if (!existsSync(NEXT)) fail("no .next output; run `next build` first");

// 1. Prerendered `/` HTML exists and holds the map (Turbopack emits index.html).
const candidates = [
  join(NEXT, "server", "app", "index.html"),
  join(NEXT, "server", "app", "page.html"),
];
const htmlFile = candidates.find((f) => existsSync(f));
if (!htmlFile) fail(`no prerendered / HTML found (tried ${candidates.join(", ")})`);
const html = readFileSync(htmlFile, "utf8");
for (const needle of ["Orbit map", "Volta", "Skill Radar", "Daily Recall Drill"]) {
  if (!html.includes(needle)) fail(`prerendered / HTML misses ${JSON.stringify(needle)}`);
}
if (html.includes("Loading your quest map")) fail("prerendered / HTML shows a loading gate");

// 2. Home page chunks carry the map but no three/monaco bytes.
const chunksDir = join(NEXT, "static", "chunks");
const homeChunks = [];
for (const file of walk(chunksDir)) {
  if (!file.endsWith(".js")) continue;
  const src = readFileSync(file, "utf8");
  if (src.includes("Orbit map")) homeChunks.push(file);
  if (src.includes("monaco-editor")) fail(`${file} carries monaco bytes`);
  if (src.includes("WebGLRenderer")) fail(`${file} carries three bytes`);
}
if (homeChunks.length === 0) fail("no / page chunk found under .next/static/chunks");

console.log(`assert-home-static: OK: ${htmlFile} holds the map; ${homeChunks.length} page chunk(s) clean.`);
