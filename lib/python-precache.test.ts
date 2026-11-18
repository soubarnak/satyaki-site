// Precache tests (issue #63, spec §3): versioned offline manifest.
import { describe, expect, it } from "vitest";
import { PYTHON_PRECACHE_BUCKET, PYTHON_PRECACHE_URLS, precachePythonAssets } from "./python-precache";
import { HARNESS_URL, PYODIDE_BASE_PATH, PYODIDE_VERSION } from "./python-worker-config";

describe("python precache manifest", () => {
  it("lists versioned same-origin urls including the harness", () => {
    expect(PYODIDE_VERSION).toBe("314.0.7");
    expect(PYTHON_PRECACHE_BUCKET).toBe("pyodide-314.0.7");
    expect(PYTHON_PRECACHE_URLS).toContain(`${PYODIDE_BASE_PATH}pyodide.asm.wasm`);
    expect(PYTHON_PRECACHE_URLS).toContain(HARNESS_URL);
    expect(PYTHON_PRECACHE_URLS.every((url) => url.startsWith("/"))).toBe(true);
  });

  it("no-ops where the Cache API is missing", async () => {
    await expect(precachePythonAssets()).resolves.toBe("unsupported");
  });
});
