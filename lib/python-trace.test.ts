// Trace shape tests (issue #63, ADR-0012, spec §4).
// Seam: trace validation and locals sanitizing at the worker boundary.
import { describe, expect, it } from "vitest";
import { emptyPythonResult, isPythonRunResult, isTraceEvent, sanitizeLocals, sanitizeLocalValue } from "./python-trace";

describe("trace events", () => {
  it("accepts a Ship line and a plain line", () => {
    expect(
      isTraceEvent({ step: 1, line: 2, kind: "line", locals: {}, shipDelta: { action: "move", blocked: false, ship: {}, changed: [] } }),
    ).toBe(true);
    expect(isTraceEvent({ step: 0, line: 1, kind: "line", locals: { x: 1 }, shipDelta: null })).toBe(true);
  });

  it("rejects error frames and non-line kinds", () => {
    expect(isTraceEvent({ kind: "error", line: 1, excType: "X", message: "y" })).toBe(false);
    expect(isTraceEvent({ step: 0, line: 1, kind: "call", locals: {}, shipDelta: null })).toBe(false);
  });

  it("keeps JSON-safe locals and drops the rest", () => {
    expect(sanitizeLocalValue(3)).toBe(3);
    expect(sanitizeLocalValue("hi")).toBe("hi");
    expect(sanitizeLocalValue(undefined)).toBe(undefined);
    expect(sanitizeLocalValue([1, 2])).toEqual([1, 2]);
    const locals = sanitizeLocals({ x: 1, __name__: "m", big: "y".repeat(500) });
    expect(locals["x"]).toBe(1);
    expect("__name__" in locals).toBe(false);
    expect((locals["big"] as string).length).toBe(200);
  });

  it("builds a valid blank result for guard paths", () => {
    const blank = emptyPythonResult("time-cap", "TimeCap", "budget exceeded");
    expect(blank.stopReason).toBe("time-cap");
    expect(blank.trace).toHaveLength(0);
    expect(isPythonRunResult(blank)).toBe(true);
  });

  it("validates a batched run result", () => {
    const result = {
      status: "ok",
      trace: [{ step: 0, line: 1, kind: "line", locals: {}, shipDelta: null }],
      stdout: "",
      stopReason: "none",
      initial: { ship: { x: 0, y: 0, z: 0, heading: "north", energy: 10, shield: false, crystals: 0 }, entities: {} },
      bounds: { maxX: 12, maxY: 5, maxZ: 12 },
    };
    expect(isPythonRunResult(result)).toBe(true);
    expect(isPythonRunResult({ ...result, trace: [{ kind: "error", line: 1 }] })).toBe(false);
  });
});
