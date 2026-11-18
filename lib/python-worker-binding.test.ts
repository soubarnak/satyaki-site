// Binding tests (issue #63, ADR-0012 name table).
// Seam: synchronous in-worker Ship module over the real ShipSim.
import { describe, expect, it } from "vitest";
import { createPythonShipModule, validateRunRequest } from "./python-worker-binding";
import { DEFAULT_BOUNDS, SHIP_NAME_TABLE, ShipSim, type ShipDelta } from "./ship-sim";

function sim() {
  return new ShipSim({ shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 100 }, bounds: { ...DEFAULT_BOUNDS }, entities: [] });
}

describe("python ship module", () => {
  it("exposes the full snake_case name table", () => {
    const shipModule = createPythonShipModule(sim());
    expect(Object.keys(shipModule).sort()).toEqual(Object.keys(SHIP_NAME_TABLE).sort());
    // Table parity is the contract; the count rides with ADR-0012's table.
    expect(Object.keys(shipModule)).toHaveLength(Object.keys(SHIP_NAME_TABLE).length);
  });

  it("runs Ship steps in-worker and forwards deltas", () => {
    const deltas: ShipDelta[] = [];
    const shipModule = createPythonShipModule(sim(), { onShipDelta: (delta) => deltas.push(delta) });
    const delta = shipModule["move"]() as ShipDelta;
    expect(delta.action).toBe("move");
    expect(deltas).toHaveLength(1);
    expect(deltas[0].ship).toMatchObject({ x: 5, z: 6 });
  });

  it("reads sensors with zero steps and no delta", () => {
    const deltas: ShipDelta[] = [];
    const shipModule = createPythonShipModule(sim(), { onShipDelta: (delta) => deltas.push(delta) });
    expect(shipModule["scan_ahead"]()).toBe("empty");
    expect(shipModule["energy"]()).toBe(100);
    expect(deltas).toHaveLength(0);
  });

  it("throws on wrong argument counts", () => {
    const shipModule = createPythonShipModule(sim());
    expect(() => shipModule["move"](1)).toThrow(TypeError);
    expect(() => shipModule["log"]()).toThrow(TypeError);
  });

  it("validates run requests against the sim", () => {
    const layout = { shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 10 }, bounds: { ...DEFAULT_BOUNDS }, entities: [] };
    expect(validateRunRequest({ code: "move()", layout }).ok).toBe(true);
    expect(validateRunRequest({ code: 1, layout }).ok).toBe(false);
    expect(validateRunRequest({ code: "x".repeat(40_000), layout }).ok).toBe(false);
  });
});
