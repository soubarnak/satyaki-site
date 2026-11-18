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
  const trace = Array.isArray(raw["trace"]) ? raw["trace"] : [];
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
