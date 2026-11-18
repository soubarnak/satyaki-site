// Harness behavior tests (issue #63, spec §§3,5).
// Seam: real CPython execution of lib/python-harness.py with a mock Ship.
// Proves spec trace, structured errors, and guard caps before Pyodide lands.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HARNESS = path.join(HERE, "python-harness.py");

interface HarnessResult {
  status: string;
  trace: Array<{ step: number; line: number; kind: string; locals: Record<string, unknown>; shipDelta: unknown; log?: string }>;
  stdout: string;
  error: { kind: string; line: number; excType: string; message: string } | null;
  stopReason: string;
  stepsUsed: number;
}

function runProgram(code: string): HarnessResult {
  const driver = `
import json, runpy
harness = runpy.run_path(${JSON.stringify(HARNESS)})
run_learner = harness["run_learner"]
class MockShip:
    def __init__(self):
        self.n = 0
    def _delta(self, action):
        return {"action": action, "blocked": False, "ship": {"x": self.n, "y": 0, "z": 0, "heading": "north", "energy": 100, "shield": False, "crystals": 0}, "changed": []}
    def move(self): self.n += 1; return self._delta("move")
    def turn_left(self): return self._delta("turn_left")
    def turn_right(self): return self._delta("turn_right")
    def ascend(self): return self._delta("ascend")
    def descend(self): return self._delta("descend")
    def laser(self): return self._delta("laser")
    def harvest(self): return self._delta("harvest")
    def shield(self): return self._delta("shield")
    def log(self, value): return value
    def scan_ahead(self): return "empty"
    def distance_ahead(self): return 3
    def energy(self): return 100
    def get_x(self): return 0
    def get_y(self): return 0
    def get_z(self): return 0
    def heading(self): return "north"
    def crystals(self): return 0
    def is_shield_on(self): return False
    def on_crystal(self): return False
code = ${JSON.stringify(code)}
print(json.dumps(run_learner(code, MockShip())))
`;
  const out = execFileSync("python3", ["-c", driver], { encoding: "utf8", timeout: 20000 });
  return JSON.parse(out.trim().split("\n").at(-1)!) as HarnessResult;
}

describe("python harness (CPython oracle)", () => {
  it("emits spec trace with shipDelta on Ship lines only", () => {
    const result = runProgram("move()\nturn_left()\nx = 1\nscan_ahead()\n");
    expect(result.status).toBe("ok");
    expect(result.stopReason).toBe("none");
    expect(result.stepsUsed).toBe(2);
    expect(result.trace).toHaveLength(4);
    expect(result.trace[0].line).toBe(1);
    expect(result.trace[0].step).toBe(1);
    expect(result.trace[0].shipDelta).toMatchObject({ action: "move" });
    // settrace fires at line entry: x appears on the next event.
    expect(result.trace[2].shipDelta).toBeNull();
    expect(result.trace[2].locals).toEqual({});
    expect(result.trace[3].locals).toMatchObject({ x: 1 });
  });

  it("captures failing programs as structured errors with lines", () => {
    const unknown = runProgram("fly()\n");
    expect(unknown.status).toBe("error");
    expect(unknown.error?.excType).toBe("NameError");
    expect(unknown.error?.line).toBe(1);
    const args = runProgram("move(1)\n");
    expect(args.status).toBe("error");
    expect(args.error?.excType).toBe("TypeError");
    expect(args.error?.line).toBe(1);
    const syntax = runProgram("move(\n");
    expect(syntax.status).toBe("error");
    expect(syntax.error?.excType).toBe("SyntaxError");
    expect(syntax.error?.line).toBe(1);
    expect(syntax.trace).toHaveLength(0);
  });

  it("stops a Ship-action infinite loop at the step cap", () => {
    // Four Ship calls per line event: the 500-step cap binds first.
    const result = runProgram("while True:\n    move(); move(); move(); move()\n");
    expect(result.status).toBe("step-cap");
    expect(result.stopReason).toBe("step-cap");
    expect(result.stepsUsed).toBe(500);
    expect(result.trace.length).toBeLessThanOrEqual(500);
  });

  it("stops a lineloop with no Ship calls at the event cap", () => {
    const result = runProgram("while True:\n    pass\n");
    expect(result.status).toBe("event-cap");
    expect(result.stopReason).toBe("event-cap");
    expect(result.trace).toHaveLength(500);
  });

  it("records log text on the line event", () => {
    const result = runProgram('log("hi")\n');
    expect(result.status).toBe("ok");
    expect(result.trace[0].log).toBe("hi");
  });
});

// Arena tick seam (ADR-0014): run_arena_tick calls on_tick(ship, radar)
// with read-only snapshots and returns the one action string.
function runTick(code: string): {
  action: unknown;
  valid: unknown;
  error: { line: number; excType: string; message: string } | null;
} {
  const driver = `
import json, runpy
harness = runpy.run_path(${JSON.stringify(HARNESS)})
run_arena_tick = harness["run_arena_tick"]
ship = {"x": 1, "y": 0, "z": 6, "heading": "east", "energy": 50, "shield": False, "crystals": 0}
radar = {"drone_distance": 2, "drone_direction": "ahead", "wave": 1, "drones_left": 2}
code = ${JSON.stringify(code)}
print(json.dumps(run_arena_tick(code, ship, radar)))
`;
  const out = execFileSync("python3", ["-c", driver], { encoding: "utf8", timeout: 20000 });
  return JSON.parse(out.trim().split("\n").at(-1)!) as {
    action: unknown;
    valid: unknown;
    error: { line: number; excType: string; message: string } | null;
  };
}

describe("python arena tick (CPython oracle)", () => {
  it("returns the tick action from read-only snapshots", () => {
    const result = runTick('def on_tick(ship, radar):\n    if radar.drone_distance == 0:\n        return "shield"\n    return "move"\n');
    expect(result.valid).toBe(true);
    expect(result.action).toBe("move");
    expect(result.error).toBeNull();
  });

  it("reads ship fields by attribute", () => {
    const result = runTick("def on_tick(ship, radar):\n    return \"move\" if ship.x < 5 else \"wait\"\n");
    expect(result.action).toBe("move");
  });

  it("rejects writes to ship and radar snapshots", () => {
    const shipWrite = runTick("def on_tick(ship, radar):\n    ship.x = 9\n    return \"wait\"\n");
    expect(shipWrite.error?.excType).toBe("AttributeError");
    const radarWrite = runTick("def on_tick(ship, radar):\n    radar.wave = 9\n    return \"wait\"\n");
    expect(radarWrite.error?.excType).toBe("AttributeError");
  });

  it("rejects unknown snapshot fields", () => {
    const result = runTick('def on_tick(ship, radar):\n    return ship.turbo\n');
    expect(result.error?.excType).toBe("AttributeError");
  });

  it("names a missing on_tick without crashing", () => {
    const result = runTick("x = 1\n");
    expect(result.valid).toBe(false);
    expect(result.error?.excType).toBe("NoOnTick");
  });

  it("wastes non-string returns without stopping", () => {
    const result = runTick("def on_tick(ship, radar):\n    return 42\n");
    expect(result.valid).toBe(false);
    expect(result.error).toBeNull();
  });
});
