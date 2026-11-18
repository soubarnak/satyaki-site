// Main-thread Python worker client (issue #63, spec §3).
// Lazy: the module Worker is created on the first Mission Run press, never
// on import and never on `/`. Importing this module creates no Worker.
// Guard backstop: outer deadline terminates and respawns the worker; the
// next run starts clean. Interrupt buffer is used only where the document
// is cross-origin isolated, else terminate-only (no COOP/COEP in v1).

import type { AuthoredLayout } from "./ship-sim";
import { emptyPythonResult, type PythonRunResult } from "./python-trace";
import { WORKER_TIMEOUT_MS } from "./python-worker-config";

export interface MissionRun {
  code: string;
  layout: AuthoredLayout;
}

type WorkerFactory = (url: string | URL, options: { type: "module" }) => Worker;

/** Bundled entry (scripts/bundle-workers.mjs): real JavaScript MIME. */
const WORKER_URL = "/workers/python-worker.js";

let worker: Worker | null = null;
let nextId = 1;
let factoryOverride: WorkerFactory | null = null;
/* eslint-disable @typescript-eslint/no-explicit-any */
const pending = new Map<number, { resolve: (result: any) => void; timer: ReturnType<typeof setTimeout> }>();

/** Test seam: swap the Worker constructor without touching imports. */
export function setPythonWorkerFactory(factory: WorkerFactory | null): void {
  factoryOverride = factory;
}

/** True in browsers with Worker support; false on server or old clients. */
export function isPythonWorkerSupported(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

function createWorker(): Worker {
  // Bundled entry stays a plain path: the bundler must not rewrite it into
  // a raw `.ts` asset copy (wrong MIME, module workers never start).
  const instance =
    factoryOverride !== null
      ? factoryOverride(WORKER_URL, { type: "module" })
      : new Worker(WORKER_URL, { type: "module" });
  instance.onmessage = (event: MessageEvent) => {
    const data = event.data as { id: number } & PythonRunResult;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    const { id, ...result } = data;
    void id;
    entry.resolve(result as PythonRunResult);
  };
  return instance;
}

function getWorker(): Worker {
  if (!worker) worker = createWorker();
  return worker;
}

/** Terminate the live worker; the next run respawns clean. */
export function resetPythonWorker(): void {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(emptyPythonResult("time-cap", "TimeCap", "Run stopped: worker reset."));
  }
  worker?.terminate();
  worker = null;
}

function timeoutResult(): PythonRunResult {
  return emptyPythonResult("time-cap", "TimeCap", "Run stopped: 3 s budget exceeded.");
}

export interface PythonTickRun {
  code: string;
  ship: { x: number; y: number; z: number; heading: string; energy: number; shield: boolean; crystals: number };
  radar: { drone_distance: number; drone_direction: string; wave: number; drones_left: number };
}

export interface PythonTickResult {
  action: string | null;
  valid: boolean;
  stdout: string;
  error?: { kind: "error"; line: number; excType: string; message: string };
}

function emptyTickResult(excType: string, message: string): PythonTickResult {
  return { action: null, valid: false, stdout: "", error: { kind: "error", line: 0, excType, message } };
}

/** Run one Arena tick in the Python worker (read-only ship/radar views). */
export function runPythonTick(run: PythonTickRun): Promise<PythonTickResult> {
  if (!isPythonWorkerSupported()) return Promise.reject(new Error("Python worker needs a browser Worker."));
  const id = nextId;
  nextId += 1;
  return new Promise<PythonTickResult>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      resetPythonWorker();
      resolve(emptyTickResult("TimeCap", "Run stopped: 3 s budget exceeded."));
    }, WORKER_TIMEOUT_MS);
    pending.set(id, {
      resolve: (result) => resolve(result as PythonTickResult),
      timer,
    });
    try {
      getWorker().postMessage({ id, kind: "tick", code: run.code, ship: run.ship, radar: run.radar });
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      resolve(emptyTickResult("TimeCap", "Run stopped: 3 s budget exceeded."));
    }
  });
}

/**
 * Run Cadet Python code on the lazy module worker. Resolves exactly once:
 * with the worker's batched result, or with a time-cap result after the
 * outer deadline terminates and respawns the worker.
 */
export function runPythonMission(run: MissionRun): Promise<PythonRunResult> {
  if (!isPythonWorkerSupported()) return Promise.reject(new Error("Python worker needs a browser Worker."));
  const id = nextId;
  nextId += 1;
  return new Promise<PythonRunResult>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      resetPythonWorker();
      resolve(timeoutResult());
    }, WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    try {
      getWorker().postMessage({ id, code: run.code, layout: run.layout });
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      resolve(timeoutResult());
    }
  });
}
