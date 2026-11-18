// Bundle the Mission language workers for the browser (issues #63/#64,
// consumed by #69 acceptance: Run must execute in a real page).
//
// Why not `new Worker(new URL(...))`: Turbopack copies that reference as a
// raw static asset, keeping the `.ts` extension. Browsers serve/reject it
// with a video MIME type, so module workers never start. esbuild compiles
// each worker entry (plus its `@/lib/*` imports) to version-stable
// `public/workers/*.js`, which browsers load as JavaScript.
//
// Usage:
//   node scripts/bundle-workers.mjs          # bundle both workers
//   node scripts/bundle-workers.mjs --check  # verify presence, no build
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const projectRequire = createRequire(join(process.cwd(), "package.json"));
const { buildSync } = projectRequire("esbuild");

const ROOT = process.cwd();
const DEST = join(ROOT, "public", "workers");
const ENTRIES = [
  ["workers/python-worker.ts", "python-worker.js"],
  ["workers/java-worker.ts", "java-worker.js"],
];

async function main() {
  const checkOnly = process.argv.includes("--check");
  if (checkOnly) {
    const missing = ENTRIES.map(([, out]) => out).filter(
      (out) => !existsSync(join(DEST, out)) || statSync(join(DEST, out)).size === 0,
    );
    if (missing.length > 0) {
      console.error(`Missing worker bundles in ${DEST}: ${missing.join(", ")}`);
      process.exit(1);
    }
    console.log(`Worker bundles present (${ENTRIES.length} files).`);
    return;
  }
  mkdirSync(DEST, { recursive: true });
  for (const [entry, out] of ENTRIES) {
    buildSync({
      entryPoints: [join(ROOT, entry)],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2020",
      minify: true,
      sourcemap: false,
      outfile: join(DEST, out),
      alias: { "@": ROOT },
      logLevel: "warning",
    });
    console.log(`bundled ${entry} to public/workers/${out}`);
  }
}

await main();
