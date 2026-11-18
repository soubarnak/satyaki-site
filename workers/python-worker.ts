// Module Web Worker entry for Python Missions (issue #63, spec §3).
// Created lazily on first Python Mission entry, never on `/`. Must run as
// `{ type: "module" }`: Pyodide 314 dropped classic-worker support.
// The one ShipSim lives here; Ship calls are synchronous in-worker calls.
// Main thread receives one batched result per Run press and only replays.

import { ShipSim } from "@/lib/ship-sim";
import { createPythonShipModule, validateRunRequest } from "@/lib/python-worker-binding";
import { HARNESS_URL, MAX_WALL_SECONDS, PYODIDE_BASE_PATH } from "@/lib/python-worker-config";
import { emptyPythonResult, type PythonRunResult } from "@/lib/python-trace";
import { shapeWorkerResult, type HarnessPayload } from "@/lib/python-worker-result";

interface WorkerRequest {
  id: number;
  code: string;
  layout: unknown;
  indexURL?: string;
  interruptBuffer?: SharedArrayBuffer;
}

// Minimal Pyodide surface used here; the pinned runtime has no npm types.
interface Pyodide {
  setStdout(options: { batched(value: string): void }): void;
  setStdin(options: { error: boolean }): void;
  setInterruptBuffer(buffer: SharedArrayBuffer): void;
  registerJsModule?(name: string, module: Record<string, unknown>): void;
  runPythonAsync(code: string): Promise<unknown>;
  globals: Map<string, unknown> & { set(key: string, value: unknown): void; get(key: string): unknown };
  toPy(value: unknown): unknown;
}

let pyodide: Pyodide | null = null;
let harnessLoaded = false;
let stdoutBuffer = "";

async function ensurePyodide(indexURL: string, interruptBuffer?: SharedArrayBuffer): Promise<Pyodide> {
  if (pyodide) {
    if (interruptBuffer) trySetInterrupt(pyodide, interruptBuffer);
    return pyodide;
  }
  const loader = (await import(/* webpackIgnore: true */ `${indexURL}pyodide.mjs`)) as {
    loadPyodide(options: { indexURL: string }): Promise<Pyodide>;
  };
  const instance = await loader.loadPyodide({ indexURL });
  instance.setStdout({ batched: (value: string) => { stdoutBuffer += value; } });
  instance.setStdin({ error: true });
  if (interruptBuffer) trySetInterrupt(instance, interruptBuffer);
  pyodide = instance;
  return instance;
}

function trySetInterrupt(instance: Pyodide, buffer: SharedArrayBuffer): void {
  // Layer 2 of the guard: SIGINT via SharedArrayBuffer only where the
  // document is cross-origin isolated. v1 ships without COOP/COEP, so this
  // is a no-op there and terminate() remains the backstop.
  try {
    instance.setInterruptBuffer(buffer);
  } catch {
    // Degrade to terminate-only.
  }
}

async function ensureHarness(instance: Pyodide): Promise<void> {
  if (harnessLoaded) return;
  const response = await fetch(HARNESS_URL);
  if (!response.ok) throw new Error(`Harness fetch failed: ${response.status}`);
  const source = await response.text();
  await instance.runPythonAsync(source);
  harnessLoaded = true;
}

async function handleRun(message: WorkerRequest): Promise<PythonRunResult> {
  const validated = validateRunRequest({ code: message.code, layout: message.layout });
  if (!validated.ok) {
    return emptyPythonResult("error", "InvalidRequest", validated.message);
  }
  const indexURL = message.indexURL ?? PYODIDE_BASE_PATH;
  stdoutBuffer = "";
  try {
    const instance = await ensurePyodide(indexURL, message.interruptBuffer);
    await ensureHarness(instance);
    const sim = new ShipSim(validated.request.layout);
    const snapshot = sim.snapshot();
    const shipModule = createPythonShipModule(sim);
    instance.globals.set("__ship_module__", shipModule);
    instance.globals.set("__learner_code__", validated.request.code);
    const payload = (await instance.runPythonAsync(
      "run_learner(__learner_code__, __ship_module__)",
    )) as HarnessPayload;
    return shapeWorkerResult(payload, snapshot, stdoutBuffer);
  } catch (error) {
    // In-worker failure (load, harness, timeout interrupt): structured,
    // never a raw throw; the client terminate layer is the final backstop.
    const message_text = error instanceof Error ? error.message : String(error);
    const fallback = emptyPythonResult("time-cap", "WorkerError", message_text.slice(0, 200));
    fallback.stdout = stdoutBuffer;
    return fallback;
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  void handleRun(message)
    .then((result) => self.postMessage({ id: message.id, ...result }))
    .catch((error: unknown) => self.postMessage({
      id: message.id,
      ...emptyPythonResult("time-cap", "WorkerError", String(error).slice(0, 200)),
    }));
};

export { MAX_WALL_SECONDS };
