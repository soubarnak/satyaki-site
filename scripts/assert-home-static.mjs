// Build-output proof for issues #68/#69: `/` is static with no three/monaco
// bytes and the prerendered HTML holds the map with no loading gate.
// Heavy deps ship only as Mission-route async chunks (slim Monaco +
// three/R3F behind `next/dynamic` `ssr: false`). Run after `next build`:
// `node scripts/assert-home-static.mjs`.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;
const NEXT = join(ROOT, ".next");

function fail(message) {
  console.error(`assert-home-static: FAIL: ${message}`);
  process.exit(1);
}

// Markers for real library bytes (not FAQ/help strings).
const HEAVY = [
  "monaco-editor/editor/",
  "editorWebWorkerMain",
  "WebGLRenderer",
  "__R3F",
];

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

// 2. Home route closure: per-route manifests list exactly the chunks `/`
// needs. None may carry heavy bytes; the Orbit map chunk must be among them.
const homeManifest = join(NEXT, "server", "app", "page", "build-manifest.json");
const homeRefs = join(NEXT, "server", "app", "page_client-reference-manifest.js");
if (!existsSync(homeManifest)) fail("no home build manifest");
if (!existsSync(homeRefs)) fail("no home client-reference manifest");
const listed = JSON.parse(readFileSync(homeManifest, "utf8")).rootMainFiles ?? [];
const refs = readFileSync(homeRefs, "utf8");
const refChunks = [...refs.matchAll(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g)].map((m) =>
  m[0].replace("/_next/", ""),
);
const closure = [...new Set([...listed, ...refChunks])];
if (closure.length === 0) fail("home chunk closure is empty");
let mapChunk = 0;
for (const rel of closure) {
  const file = join(NEXT, rel);
  if (!existsSync(file)) fail(`home chunk missing: ${rel}`);
  const src = readFileSync(file, "utf8");
  if (src.includes("Orbit map")) mapChunk += 1;
  for (const marker of HEAVY) {
    if (src.includes(marker)) fail(`${rel} carries heavy bytes (${marker})`);
  }
}
if (mapChunk === 0) fail("no / page chunk found in the home closure");

// 3. Inventory (informational): heavy chunks exist as separate async files.
const chunksDir = join(NEXT, "static", "chunks");
const { readdirSync } = await import("node:fs");
const heavy = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (full.endsWith(".js")) {
      const src = readFileSync(full, "utf8");
      if (HEAVY.some((marker) => src.includes(marker))) {
        const raw = statSync(full).size;
        heavy.push(`${full.replace(`${ROOT}/`, "")} raw=${raw} gzip=${gzipSync(readFileSync(full)).length}`);
      }
    }
  }
};
walk(chunksDir);

console.log(
  `assert-home-static: OK: ${htmlFile} holds the map; ${closure.length} home chunk(s) clean of three/monaco.`,
);
console.log(`assert-home-static: heavy async chunks (${heavy.length}):`);
for (const line of heavy) console.log(`assert-home-static:   ${line}`);
