// Python worker config (issue #63, spec §§3,5, research #31).
// Glossary: Ship, Ship API, World State, Seed, Mission.
// Pure core: no framework, DOM, or worker imports. Single source for the
// pinned Pyodide version, versioned same-origin paths, caps, and filenames.

/** Exact-pinned Pyodide version (research #31: 314.0.7 = Python 3.14.2). */
export const PYODIDE_VERSION = "314.0.7";

/** Same-origin versioned base path for self-hosted Pyodide assets. */
export const PYODIDE_BASE_PATH = `/pyodide/v${PYODIDE_VERSION}/`;

/** Minimal runtime set measured in research #31 (~6.24 MB brotli wire). */
export const PYODIDE_CORE_FILES = [
  "pyodide.asm.wasm",
  "python_stdlib.zip",
  "pyodide.asm.mjs",
  "pyodide-lock.json",
  "pyodide.mjs",
] as const;
export type PyodideCoreFile = (typeof PYODIDE_CORE_FILES)[number];

/** Pinned jsDelivr fallback base (research #31). Self-host is primary. */
export const PYODIDE_CDN_FALLBACK_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** Learner filename compiled under; tracebacks show `File "mission.py"`. */
export const LEARNER_FILENAME = "mission.py";

/** Caps from ADR-0013 / spec §5 (worker-enforced). */
export const MAX_SHIP_STEPS = 500;
export const MAX_TRACE_EVENTS = 500;
export const MAX_WALL_SECONDS = 3;

/** Main-thread outer deadline: budget plus grace for interrupt handling. */
export const WORKER_TIMEOUT_MS = MAX_WALL_SECONDS * 1000 + 500;

/** Versioned Cache Storage bucket for the service-worker precache. */
export const PYODIDE_PRECACHE_BUCKET = `pyodide-${PYODIDE_VERSION}`;

/** Same-origin URL for one self-hosted Pyodide core file. */
export function pyodideAssetUrl(file: PyodideCoreFile): string {
  return `${PYODIDE_BASE_PATH}${file}`;
}

/** Same-origin URL of the harness source (vendored beside the runtime). */
export const HARNESS_URL = `${PYODIDE_BASE_PATH}python-harness.py`;

/** All same-origin core asset URLs (precache manifest source). */
export function pyodideCoreUrls(): string[] {
  return PYODIDE_CORE_FILES.map(pyodideAssetUrl);
}
