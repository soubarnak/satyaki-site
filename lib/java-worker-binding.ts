// In-worker Ship binding for the Cadet Java worker (issue #64, ADR-0012).
// Glossary: Ship, Ship API, World State. Pure core: no DOM, no worker
// globals. The interpreter calls the one in-worker ShipSim synchronously;
// each Ship call runs one sim step (drones patrol) and reports its delta.

import { JAVA_NAMES, ShipSim, isStepName, type AuthoredLayout, type ShipDelta } from "./ship-sim";

/** All 20 v1 Ship names on the Java surface (camelCase). */
export const JAVA_SHIP_NAMES: readonly string[] = JAVA_NAMES;

/** Max learner code accepted per Run press (ADR-0010 draft cap). */
export const MAX_JAVA_CODE_CHARS = 32_768;

export interface JavaRunRequest {
  code: string;
  layout: AuthoredLayout;
}

export function validateJavaRunRequest(value: unknown): { ok: true; request: JavaRunRequest } | { ok: false; message: string } {
  if (typeof value !== "object" || value === null) return { ok: false, message: "Request must be an object." };
  const record = value as Record<string, unknown>;
  if (typeof record["code"] !== "string") return { ok: false, message: "Request code must be a string." };
  if (record["code"].length > MAX_JAVA_CODE_CHARS) {
    return { ok: false, message: `Code exceeds ${MAX_JAVA_CODE_CHARS} chars.` };
  }
  try {
    // Throws RangeError on bad bounds/shipStart/entity cells.
    new ShipSim(record["layout"] as AuthoredLayout);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid layout." };
  }
  return { ok: true, request: { code: record["code"] as string, layout: record["layout"] as AuthoredLayout } };
}

export interface JavaShipModuleHooks {
  onShipDelta?: (delta: ShipDelta) => void;
  onLog?: (text: string) => void;
}

/**
 * Build the synchronous camelCase Ship surface the interpreter calls.
 * Step calls hit the sim (one step, drones patrol) and forward the delta;
 * sensors read with zero steps. Unknown names and wrong counts throw with a
 * learner line attached by the interpreter.
 */
export function createJavaShipModule(sim: ShipSim, hooks: JavaShipModuleHooks = {}): Record<string, (...args: unknown[]) => unknown> {
  const shipModule: Record<string, (...args: unknown[]) => unknown> = {};
  for (const name of JAVA_SHIP_NAMES) {
    shipModule[name] = (...args: unknown[]) => {
      const expected = name === "log" ? 1 : 0;
      if (args.length !== expected) {
        throw new TypeError(`${name}() takes ${expected === 0 ? "no" : "exactly one"} argument${expected === 0 ? "s" : ""} (${args.length} given)`);
      }
      const result = sim.call(name, args);
      if (!result.ok) throw new Error(`${result.error.excType}: ${result.error.message}`);
      if (name === "log") {
        const text = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);
        hooks.onLog?.(text);
        return result.value;
      }
      if (isStepName(name) && result.delta) hooks.onShipDelta?.(result.delta);
      return result.delta ?? result.value;
    };
  }
  return shipModule;
}

/** Read-only Mission `ship.*` fields (ADR-0012 World State). */
export const SHIP_SNAPSHOT_FIELDS = ["x", "y", "z", "heading", "energy", "shield", "crystals"] as const;
export type ShipSnapshotField = (typeof SHIP_SNAPSHOT_FIELDS)[number];

/** Read-only Arena `radar.*` fields, camelCase (ADR-0014). */
export const RADAR_SNAPSHOT_FIELDS = ["droneDistance", "droneDirection", "wave", "dronesLeft"] as const;
export type RadarSnapshotField = (typeof RADAR_SNAPSHOT_FIELDS)[number];

export interface ArenaRadarSnapshot {
  droneDistance: number;
  droneDirection: string;
  wave: number;
  dronesLeft: number;
}

/** Read one `ship.*` field from a live sim; unknown fields stay undefined. */
export function readShipSnapshotField(sim: ShipSim, field: string): unknown {
  const snapshot = sim.snapshot();
  if ((SHIP_SNAPSHOT_FIELDS as readonly string[]).includes(field)) {
    return (snapshot.ship as unknown as Record<string, unknown>)[field];
  }
  return undefined;
}
