// Client tests (issue #63, spec §3).
// Seams: lazy creation, single-flight resolve, respawn, `/` isolation.
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_BOUNDS } from "./ship-sim";
import {
  isPythonWorkerSupported,
  resetPythonWorker,
  runPythonMission,
  setPythonWorkerFactory,
} from "./python-worker-client";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

class FakeWorker {
  static created = 0;
  static last: FakeWorker | null = null;
  posted: unknown[] = [];
  terminated = false;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor() {
    FakeWorker.created += 1;
    FakeWorker.last = this;
  }
  postMessage(message: unknown): void {
    this.posted.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  respond(result: unknown): void {
    this.onmessage?.({ data: result });
  }
}

function installFakeBrowser(): void {
  (globalThis as Record<string, unknown>)["window"] = {};
  (globalThis as Record<string, unknown>)["Worker"] = FakeWorker;
}

afterEach(() => {
  resetPythonWorker();
  delete (globalThis as Record<string, unknown>)["window"];
  delete (globalThis as Record<string, unknown>)["Worker"];
  setPythonWorkerFactory(null);
  FakeWorker.created = 0;
  FakeWorker.last = null;
  vi.useRealTimers();
});

describe("python worker client", () => {
  it("creates no Worker on import and needs a browser", async () => {
    let calls = 0;
    setPythonWorkerFactory((() => {
      calls += 1;
      return new FakeWorker() as unknown as Worker;
    }) as never);
    expect(calls).toBe(0);
    expect(isPythonWorkerSupported()).toBe(false);
    await expect(runPythonMission({ code: "move()", layout: freshLayout() })).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it("creates the module worker lazily and resolves one batched result", async () => {
    installFakeBrowser();
    setPythonWorkerFactory((() => new FakeWorker() as unknown as Worker) as never);
    const promise = runPythonMission({ code: "move()", layout: freshLayout() });
    expect(FakeWorker.created).toBe(1);
    const posted = FakeWorker.last?.posted[0] as { id: number; code: string };
    expect(posted.code).toBe("move()");
    FakeWorker.last?.respond({ id: posted.id, status: "ok", trace: [], stdout: "", stopReason: "none", initial: null, bounds: null });
    const result = await promise;
    expect(result.status).toBe("ok");
    // Second run reuses the live worker.
    const second = runPythonMission({ code: "move()", layout: freshLayout() });
    expect(FakeWorker.created).toBe(1);
    const posted2 = FakeWorker.last?.posted[1] as { id: number };
    FakeWorker.last?.respond({ id: posted2.id, status: "ok", trace: [], stdout: "", stopReason: "none", initial: null, bounds: null });
    await second;
  });

  it("respawns clean after reset", async () => {
    installFakeBrowser();
    setPythonWorkerFactory((() => new FakeWorker() as unknown as Worker) as never);
    const first = runPythonMission({ code: "move()", layout: freshLayout() });
    const worker = FakeWorker.last;
    const posted = worker?.posted[0] as { id: number };
    worker?.respond({ id: posted.id, status: "ok", trace: [], stdout: "", stopReason: "none", initial: null, bounds: null });
    await first;
    resetPythonWorker();
    expect(worker?.terminated).toBe(true);
    const second = runPythonMission({ code: "move()", layout: freshLayout() });
    expect(FakeWorker.created).toBe(2);
    const posted2 = FakeWorker.last?.posted[0] as { id: number };
    FakeWorker.last?.respond({ id: posted2.id, status: "ok", trace: [], stdout: "", stopReason: "none", initial: null, bounds: null });
    await second;
  });

  it("loads no Pyodide bytes on the `/` route", () => {
    const page = readFileSync(path.join(ROOT, "app", "page.tsx"), "utf8");
    const layout = readFileSync(path.join(ROOT, "app", "layout.tsx"), "utf8");
    for (const source of [page, layout]) {
      expect(source).not.toMatch(/pyodide/i);
      expect(source).not.toMatch(/python-worker/);
      expect(source).not.toMatch(/python-precache/);
    }
  });
});

function freshLayout() {
  return {
    shipStart: { x: 0, y: 0, z: 0, heading: "north" as const, energy: 10 },
    bounds: { ...DEFAULT_BOUNDS },
    entities: [],
  };
}
