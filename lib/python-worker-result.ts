// Shape the harness payload into the batched result (issue #63).
// Pure: shared by the module worker entry; tested without WASM.
import type { WorldSnapshot } from "./ship-sim";
import type { PythonRunResult, PythonStopReason } from "./python-trace";

/** Harness dict with Pyodide's toJs converter, or a plain dict in tests. */
export interface HarnessPayload {
  toJs?(options?: Record<string, unknown>): unknown;
  destroy?(): void;
  [key: string]: unknown;
}

/** Convert the harness return into a spec result; malformed pays error. */
export function shapeWorkerResult(
  payload: HarnessPayload | null | undefined,
  snapshot: WorldSnapshot,
  stdoutFallback: string,
): PythonRunResult {
  const raw =
    payload !== null &&
    typeof payload === "object" &&
    typeof (payload as HarnessPayload)["toJs"] === "function"
      ? ((payload as HarnessPayload).toJs!({ create_proxies: false, dict_converter: Object.fromEntries }) as Record<string, unknown>)
      : ((payload ?? {}) as Record<string, unknown>);
  try {
    (payload as HarnessPayload | null | undefined)?.destroy?.();
  } catch {
    // Ignore teardown failures; the result stands.
  }
  // Pyodide `toJs` turns harness `None` into `undefined` (and may drop
  // the key); the worker contract promises `shipDelta: T | null` on every
  // event, so normalize the missing case here. Clean traces keep their
  // identity.
  function normalizeTraceEvent(entry: unknown): unknown {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    if (record["shipDelta"] !== undefined) return entry;
    return { ...record, shipDelta: null };
  }
  const rawTrace: unknown[] = Array.isArray(raw["trace"]) ? raw["trace"] : [];
  const trace = rawTrace.some((entry) => normalizeTraceEvent(entry) !== entry)
    ? rawTrace.map(normalizeTraceEvent)
    : rawTrace;
  const stopReason = typeof raw["stopReason"] === "string" ? raw["stopReason"] : "error";
  const status = typeof raw["status"] === "string" ? raw["status"] : "error";
  return {
    status: status as PythonRunResult["status"],
    trace: trace as PythonRunResult["trace"],
    stdout: typeof raw["stdout"] === "string" ? raw["stdout"] : stdoutFallback,
    error: (raw["error"] as PythonRunResult["error"]) ?? undefined,
    stopReason: stopReason as PythonStopReason,
    initial: { ship: { ...snapshot.ship }, entities: {} },
    bounds: snapshot.bounds,
  };
}
