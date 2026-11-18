// Spec trace types for the Python worker (issue #63, ADR-0012, spec §4).
// Glossary: Ship, World State, Seed. Pure core: no framework, DOM, or
// worker imports. Shape matches the Java worker contract (issue #64):
// run header plus one event per executed learner line.

import type { Bounds, ErrorFrame, ShipDelta } from "./ship-sim";

/** One executed learner line. `step` counts Ship actions only. */
export interface TraceEvent {
  step: number;
  line: number;
  kind: "line";
  locals: Record<string, unknown>;
  shipDelta: ShipDelta | null;
  /** `log(value)` text for this line, when called. */
  log?: string;
}

/** Run header: World State before step 1. */
export interface TraceHeader {
  initial: {
    ship: { x: number; y: number; z: number; heading: string; energy: number; shield: boolean; crystals: number };
    entities: Record<string, Record<string, unknown>>;
  };
  bounds: Bounds;
}

/** Worker stop reason (spec §5 result shape). */
export type PythonStopReason = "none" | "error" | "step-cap" | "event-cap" | "time-cap";

/** One batched run result per Run press (practice Seed first upstream). */
export interface PythonRunResult {
  status: "ok" | PythonStopReason;
  trace: TraceEvent[];
  stdout: string;
  error?: ErrorFrame;
  stopReason: PythonStopReason;
  initial: TraceHeader["initial"];
  bounds: Bounds;
}

/** Max JSON string length kept per local value. */
export const MAX_LOCAL_STRING = 200;
/** Max entries kept per list/dict local. */
export const MAX_LOCAL_ITEMS = 20;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Keep only JSON-safe scalars plus shallow small lists/dicts. */
export function sanitizeLocalValue(value: unknown): unknown {
  if (value === null) return null;
  const type = typeof value;
  if (type === "number" || type === "boolean") return Number.isFinite(value) ? value : String(value);
  if (type === "string") {
    const text = value as string;
    return text.length > MAX_LOCAL_STRING ? text.slice(0, MAX_LOCAL_STRING) : text;
  }
  if (type === "undefined" || type === "function" || type === "symbol") return undefined;
  if (Array.isArray(value)) {
    return (value as unknown[]).slice(0, MAX_LOCAL_ITEMS).map((entry) => sanitizeLocalValue(entry));
  }
  if (isPlainRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value).slice(0, MAX_LOCAL_ITEMS)) {
      const clean = sanitizeLocalValue(entry);
      if (clean !== undefined) out[key] = clean;
    }
    return out;
  }
  return `[${Array.isArray(value) ? "list" : type}]`;
}

/** Filter a frame-locals dict: drop dunders, cap count, sanitize values. */
export function sanitizeLocals(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith("__")) continue;
    if (kept >= MAX_LOCAL_ITEMS) break;
    const clean = sanitizeLocalValue(value);
    if (clean === undefined) continue;
    out[key] = clean;
    kept += 1;
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Blank result for guard/timeout paths: readable stop, empty trace. */
export function emptyPythonResult(stop: PythonStopReason, excType: string, message: string): PythonRunResult {
  return {
    status: stop,
    trace: [],
    stdout: "",
    error: { kind: "error", line: 0, excType, message },
    stopReason: stop,
    initial: { ship: { x: 0, y: 0, z: 0, heading: "north", energy: 0, shield: false, crystals: 0 }, entities: {} },
    bounds: { maxX: 12, maxY: 5, maxZ: 12 },
  };
}

/** Narrow check for one trace event; used at the worker boundary. */
export function isTraceEvent(value: unknown): value is TraceEvent {
  if (!isRecord(value)) return false;
  if (typeof value["step"] !== "number" || typeof value["line"] !== "number") return false;
  if (value["kind"] !== "line") return false;
  if (!isRecord(value["locals"])) return false;
  const delta = value["shipDelta"];
  if (delta !== null && !isRecord(delta)) return false;
  if ("log" in value && typeof value["log"] !== "string") return false;
  return true;
}

/** Narrow check for the batched run result; rejects oversized traces. */
export function isPythonRunResult(value: unknown): value is PythonRunResult {
  if (!isRecord(value)) return false;
  if (typeof value["status"] !== "string" || typeof value["stopReason"] !== "string") return false;
  if (!Array.isArray(value["trace"]) || !value["trace"].every(isTraceEvent)) return false;
  if (typeof value["stdout"] !== "string") return false;
  if (!isRecord(value["initial"]) || !isRecord(value["bounds"])) return false;
  return true;
}
