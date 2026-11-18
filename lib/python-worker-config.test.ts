// Python worker config tests (issue #63, spec §§3,5).
// Seams: pinned version/path/caps. Expected values are spec literals.
import { describe, expect, it } from "vitest";
import {
  LEARNER_FILENAME,
  MAX_SHIP_STEPS,
  MAX_TRACE_EVENTS,
  MAX_WALL_SECONDS,
  PYODIDE_BASE_PATH,
  PYODIDE_CDN_FALLBACK_BASE,
  PYODIDE_CORE_FILES,
  PYODIDE_PRECACHE_BUCKET,
  PYODIDE_VERSION,
  WORKER_TIMEOUT_MS,
  pyodideAssetUrl,
  pyodideCoreUrls,
} from "./python-worker-config";
import { MAX_TRACE_EVENTS as GRADER_EVENTS, MAX_SHIP_STEPS as GRADER_STEPS, MAX_WALL_SECONDS as GRADER_SECONDS } from "./grader";

describe("pyodide pin and paths", () => {
  it("pins 314.0.7 under a versioned same-origin path", () => {
    expect(PYODIDE_VERSION).toBe("314.0.7");
    expect(PYODIDE_BASE_PATH).toBe("/pyodide/v314.0.7/");
    expect(pyodideAssetUrl("pyodide.asm.wasm")).toBe("/pyodide/v314.0.7/pyodide.asm.wasm");
    expect(pyodideCoreUrls()).toHaveLength(5);
    expect(pyodideCoreUrls().every((url) => url.startsWith(PYODIDE_BASE_PATH))).toBe(true);
  });

  it("keeps the pinned CDN URL as fallback only", () => {
    expect(PYODIDE_CDN_FALLBACK_BASE).toBe("https://cdn.jsdelivr.net/pyodide/v314.0.7/full/");
  });

  it("precaches under a versioned bucket", () => {
    expect(PYODIDE_PRECACHE_BUCKET).toBe("pyodide-314.0.7");
    expect(PYODIDE_CORE_FILES).toContain("pyodide.asm.wasm");
    expect(PYODIDE_CORE_FILES).toContain("python_stdlib.zip");
  });

  it("caps match the grader and use mission.py tracebacks", () => {
    expect(MAX_SHIP_STEPS).toBe(500);
    expect(MAX_TRACE_EVENTS).toBe(500);
    expect(MAX_WALL_SECONDS).toBe(3);
    expect(GRADER_STEPS).toBe(MAX_SHIP_STEPS);
    expect(GRADER_EVENTS).toBe(MAX_TRACE_EVENTS);
    expect(GRADER_SECONDS).toBe(MAX_WALL_SECONDS);
    expect(LEARNER_FILENAME).toBe("mission.py");
    expect(WORKER_TIMEOUT_MS).toBeGreaterThan(MAX_WALL_SECONDS * 1000);
  });
});
