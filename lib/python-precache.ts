// Versioned precache manifest for Python Mission assets (issue #63).
// Service worker = cache layer, web worker = execution layer. Registration
// stays lazy: call precachePythonAssets on first Python Mission entry, never
// on `/`. Full service-worker wiring lands with deploy hardening (#75).

import { HARNESS_URL, PYODIDE_PRECACHE_BUCKET, pyodideCoreUrls } from "./python-worker-config";

/** Every same-origin URL a Python Mission needs offline, version-pinned. */
export const PYTHON_PRECACHE_URLS: string[] = [...pyodideCoreUrls(), HARNESS_URL];

/** Cache bucket for the precache (matches the versioned bucket). */
export const PYTHON_PRECACHE_BUCKET = PYODIDE_PRECACHE_BUCKET;

export type PrecacheOutcome = "cached" | "unsupported" | "failed";

/**
 * Fetch every precache URL into the versioned Cache Storage bucket.
 * No-op (`unsupported`) on the server or without the Cache API.
 */
export async function precachePythonAssets(): Promise<PrecacheOutcome> {
  if (typeof caches === "undefined") return "unsupported";
  try {
    const bucket = await caches.open(PYTHON_PRECACHE_BUCKET);
    await bucket.addAll(PYTHON_PRECACHE_URLS);
    return "cached";
  } catch {
    return "failed";
  }
}
