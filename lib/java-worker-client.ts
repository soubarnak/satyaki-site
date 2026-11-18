// Main-thread Cadet Java worker client (issue #64, spec §3).
// Lazy: the module Worker is created on the first Java Mission Run press,
// never on import and never on `/`. Importing this module creates no Worker.
// Guard backstop: outer deadline terminates and respawns the worker; the
// next run starts clean. Mirrors the Python worker client (issue #63).

import type { AuthoredLayout } from "./ship-sim";
import { emptyJavaResult, type JavaRunResult } from "./java-trace";
import { JAVA_WORKER_TIMEOUT_MS } from "./java-worker-config";

export interface JavaMissionRun {
  code: string;
  layout: AuthoredLayout;
}

type WorkerFactory = (url: string | URL, options: { type: "module" }) => Worker;

/** Bundled entry (scripts/bundle-workers.mjs): real JavaScript MIME. */
const WORKER_URL = "/workers/java-worker.js";

let worker: Worker | null = null;
let nextId = 1;
let factoryOverride: WorkerFactory | null = null;
const pending = new Map<number, { resolve: (result: JavaRunResult) => void; timer: ReturnType<typeof setTimeout> }>();

/** Test seam: swap the Worker constructor without touching imports. */
export function setJavaWorkerFactory(factory: WorkerFactory | null): void {
  factoryOverride = factory;
}

/** True in browsers with Worker support; false on server or old clients. */
export function isJavaWorkerSupported(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined";
}

function createWorker(): Worker {
  // Bundled entry stays a plain path (see the Python client).
  const instance =
    factoryOverride !== null
      ? factoryOverride(WORKER_URL, { type: "module" })
      : new Worker(WORKER_URL, { type: "module" });
  instance.onmessage = (event: MessageEvent) => {
    const data = event.data as { id: number } & JavaRunResult;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);
    const { id, ...result } = data;
    void id;
    entry.resolve(result as JavaRunResult);
  };
  return instance;
}

function getWorker(): Worker {
  if (!worker) worker = createWorker();
  return worker;
}

/** Terminate the live worker; the next run respawns clean. */
export function resetJavaWorker(): void {
  for (const [id, entry] of pending) {
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(emptyJavaResult("time-cap", "TimeCap", "Run stopped: worker reset."));
  }
  worker?.terminate();
  worker = null;
}

function timeoutResult(): JavaRunResult {
  return emptyJavaResult("time-cap", "TimeCap", "Run stopped: 3 s budget exceeded.");
}

/**
 * Run Cadet Java code on the lazy module worker. Resolves exactly once:
 * with the worker's batched result, or with a time-cap result after the
 * outer deadline terminates and respawns the worker.
 */
export interface JavaTickRun {
  code: string;
  ship: { x: number; y: number; z: number; heading: string; energy: number; shield: boolean; crystals: number };
  radar: { droneDistance: number; droneDirection: string; wave: number; dronesLeft: number };
}

/** Run one Arena tick in the Java worker (read-only ship/radar hosts). */
export function runJavaTick(run: JavaTickRun): Promise<JavaRunResult> {
  if (!isJavaWorkerSupported()) return Promise.reject(new Error("Java worker needs a browser Worker."));
  const id = nextId;
  nextId += 1;
  return new Promise<JavaRunResult>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      resetJavaWorker();
      resolve(timeoutResult());
    }, JAVA_WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    try {
      getWorker().postMessage({ id, kind: "tick", code: run.code, ship: run.ship, radar: run.radar });
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      resolve(timeoutResult());
    }
  });
}

export function runJavaMission(run: JavaMissionRun): Promise<JavaRunResult> {
  if (!isJavaWorkerSupported()) return Promise.reject(new Error("Java worker needs a browser Worker."));
  const id = nextId;
  nextId += 1;
  return new Promise<JavaRunResult>((resolve) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      resetJavaWorker();
      resolve(timeoutResult());
    }, JAVA_WORKER_TIMEOUT_MS);
    pending.set(id, { resolve, timer });
    try {
      getWorker().postMessage({ id, kind: "run", code: run.code, layout: run.layout });
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      resolve(timeoutResult());
    }
  });
}
