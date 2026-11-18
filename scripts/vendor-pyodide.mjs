// Vendor pinned Pyodide runtime next to the harness (issue #63).
// Self-host primary, pinned CDN fallback (research #31). No dependencies.
// Wiring the download into Containerfile/CI belongs to deploy hardening
// (#75); this ticket ships the versioned path, the script, and the headers.
//
// Usage:
//   node scripts/vendor-pyodide.mjs          # download + copy harness
//   node scripts/vendor-pyodide.mjs --check  # verify presence, no network
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const VERSION = "314.0.7";
const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`;
const CORE = ["pyodide.asm.wasm", "python_stdlib.zip", "pyodide.asm.mjs", "pyodide-lock.json", "pyodide.mjs"];
const DEST = join(process.cwd(), "public", "pyodide", `v${VERSION}`);
const HARNESS_SRC = join(process.cwd(), "lib", "python-harness.py");

async function main() {
  const checkOnly = process.argv.includes("--check");
  const missing = [...CORE, "python-harness.py"].filter((file) => !existsSync(join(DEST, file)));
  if (checkOnly) {
    if (missing.length > 0) {
      console.error(`Missing Pyodide assets in ${DEST}: ${missing.join(", ")}`);
      process.exit(1);
    }
    console.log(`Pyodide ${VERSION} assets present (${CORE.length} core + harness).`);
    return;
  }
  mkdirSync(DEST, { recursive: true });
  for (const file of CORE) {
    const target = join(DEST, file);
    if (existsSync(target) && statSync(target).size > 0) {
      console.log(`keep ${file}`);
      continue;
    }
    console.log(`fetch ${file}`);
    const response = await fetch(`${BASE}${file}`);
    if (!response.ok) throw new Error(`Fetch failed: ${file} (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const { writeFileSync } = await import("node:fs");
    writeFileSync(target, buffer);
  }
  copyFileSync(HARNESS_SRC, join(DEST, "python-harness.py"));
  console.log(`vendored Pyodide ${VERSION} to ${DEST}`);
}

await main();
