// Vendor the slim-Monaco editor stylesheet self-hosted (issue #69).
// The JS stays bundled from `monaco-editor/esm/...` (editor.api +
// Python/Java registers + one editor.worker); only the CSS ships as a
// versioned same-origin file, since global CSS cannot live in a
// Mission-route chunk. The font is inlined in the CSS as a data: URL,
// so this one file is the whole asset.
//
// Usage:
//   node scripts/vendor-monaco.mjs          # copy the stylesheet
//   node scripts/vendor-monaco.mjs --check  # verify presence, no copy
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

const VERSION = "0.57.0";
const FILE = "editor.main.css";
const SRC = join(process.cwd(), "node_modules", "monaco-editor", "min", "vs", "editor", FILE);
const DEST = join(process.cwd(), "public", "monaco", `v${VERSION}`, FILE);

async function main() {
  const checkOnly = process.argv.includes("--check");
  if (checkOnly) {
    if (!existsSync(DEST) || statSync(DEST).size === 0) {
      console.error(`Missing Monaco stylesheet: ${DEST}`);
      process.exit(1);
    }
    console.log(`Monaco ${VERSION} stylesheet present (${statSync(DEST).size} bytes).`);
    return;
  }
  if (!existsSync(SRC)) throw new Error(`Monaco source missing: ${SRC} (npm install first)`);
  mkdirSync(join(process.cwd(), "public", "monaco", `v${VERSION}`), { recursive: true });
  copyFileSync(SRC, DEST);
  console.log(`vendored Monaco ${VERSION} stylesheet to ${DEST}`);
}

await main();
