// Result-shaping tests (issue #63, spec §4).
// Seam: harness payload to batched result, no WASM needed.
import { describe, expect, it } from "vitest";
import { shapeWorkerResult } from "./python-worker-result";
import { ShipSim, DEFAULT_BOUNDS } from "./ship-sim";

function snapshot() {
  return new ShipSim({
    shipStart: { x: 1, y: 0, z: 2, heading: "east", energy: 10 },
    bounds: { ...DEFAULT_BOUNDS },
    entities: [],
  }).snapshot();
}

describe("shapeWorkerResult", () => {
  it("passes a plain harness dict through with the run header", () => {
    const trace = [{ step: 1, line: 1, kind: "line", locals: {}, shipDelta: null }];
    const result = shapeWorkerResult(
      { status: "ok", trace, stdout: "hi", error: null, stopReason: "none" },
      snapshot(),
      "",
    );
    expect(result.status).toBe("ok");
    expect(result.trace).toBe(trace);
    expect(result.stdout).toBe("hi");
    expect(result.initial.ship).toMatchObject({ x: 1, z: 2 });
  });

  it("converts a Pyodide payload via toJs and destroys it", () => {
    let destroyed = false;
    const result = shapeWorkerResult(
      {
        toJs: () => ({ status: "error", trace: [], stdout: "", error: { kind: "error", line: 2, excType: "NameError", message: "x" }, stopReason: "error" }),
        destroy: () => { destroyed = true; },
      },
      snapshot(),
      "fallback",
    );
    expect(result.stopReason).toBe("error");
    expect(result.error).toMatchObject({ line: 2, excType: "NameError" });
    expect(destroyed).toBe(true);
  });

  it("falls back to error on malformed payloads", () => {
    const result = shapeWorkerResult(undefined, snapshot(), "captured");
    expect(result.status).toBe("error");
    expect(result.stopReason).toBe("error");
    expect(result.stdout).toBe("captured");
  });
});
