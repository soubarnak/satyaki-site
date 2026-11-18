// Java binding tests (issue #64, ADR-0012 name table).
// Seam: synchronous camelCase Ship surface over the real ShipSim.
import { describe, expect, it } from "vitest";
import { createJavaShipModule, validateJavaRunRequest, JAVA_SHIP_NAMES } from "./java-worker-binding";
import { DEFAULT_BOUNDS, SHIP_NAME_TABLE, ShipSim, type ShipDelta } from "./ship-sim";

function sim() {
  return new ShipSim({ shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 100 }, bounds: { ...DEFAULT_BOUNDS }, entities: [] });
}

describe("java ship module", () => {
  it("exposes the full camelCase name table", () => {
    const shipModule = createJavaShipModule(sim());
    expect(Object.keys(shipModule).sort()).toEqual([...JAVA_SHIP_NAMES].sort());
    expect(Object.keys(shipModule)).toHaveLength(Object.keys(SHIP_NAME_TABLE).length);
  });

  it("runs Ship steps in-worker and forwards deltas", () => {
    const deltas: ShipDelta[] = [];
    const shipModule = createJavaShipModule(sim(), { onShipDelta: (delta) => deltas.push(delta) });
    const delta = shipModule["move"]() as ShipDelta;
    expect(delta.action).toBe("move");
    expect(deltas).toHaveLength(1);
    expect(deltas[0].ship).toMatchObject({ x: 5, z: 6 });
  });

  it("reads sensors with zero steps and no delta", () => {
    const deltas: ShipDelta[] = [];
    const shipModule = createJavaShipModule(sim(), { onShipDelta: (delta) => deltas.push(delta) });
    expect(shipModule["scanAhead"]()).toBe("empty");
    expect(shipModule["energy"]()).toBe(100);
    expect(deltas).toHaveLength(0);
  });

  it("throws on wrong argument counts", () => {
    const shipModule = createJavaShipModule(sim());
    expect(() => shipModule["move"](1)).toThrow(TypeError);
    expect(() => shipModule["log"]()).toThrow(TypeError);
  });

  it("validates run requests against the sim", () => {
    const layout = { shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 10 }, bounds: { ...DEFAULT_BOUNDS }, entities: [] };
    expect(validateJavaRunRequest({ code: "move();", layout }).ok).toBe(true);
    expect(validateJavaRunRequest({ code: 1, layout }).ok).toBe(false);
    expect(validateJavaRunRequest({ code: "x".repeat(40_000), layout }).ok).toBe(false);
  });
});
