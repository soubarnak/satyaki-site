// Client tests (issue #64, spec §3).
// Seams: lazy creation, single-flight resolve, respawn.
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_BOUNDS, type AuthoredLayout } from "./ship-sim";
import {
  isJavaWorkerSupported,
  resetJavaWorker,
  runJavaMission,
  setJavaWorkerFactory,
} from "./java-worker-client";

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

function freshLayout(): AuthoredLayout {
  return { shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 10 }, bounds: { ...DEFAULT_BOUNDS }, entities: [] };
}

function installFakeBrowser(): void {
  (globalThis as Record<string, unknown>)["window"] = {};
  (globalThis as Record<string, unknown>)["Worker"] = FakeWorker;
}

afterEach(() => {
  resetJavaWorker();
  delete (globalThis as Record<string, unknown>)["window"];
  delete (globalThis as Record<string, unknown>)["Worker"];
  setJavaWorkerFactory(null);
  FakeWorker.created = 0;
  FakeWorker.last = null;
});

describe("java worker client", () => {
  it("creates no Worker on import and needs a browser", async () => {
    let calls = 0;
    setJavaWorkerFactory((() => {
      calls += 1;
      return new FakeWorker() as unknown as Worker;
    }) as never);
    expect(calls).toBe(0);
    expect(isJavaWorkerSupported()).toBe(false);
    await expect(runJavaMission({ code: "move();", layout: freshLayout() })).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it("creates the module worker lazily and resolves one batched result", async () => {
    installFakeBrowser();
    setJavaWorkerFactory((() => new FakeWorker() as unknown as Worker) as never);
    const promise = runJavaMission({ code: "move();", layout: freshLayout() });
    expect(FakeWorker.created).toBe(1);
    const posted = FakeWorker.last?.posted[0] as { id: number; code: string; kind: string };
    expect(posted.code).toBe("move();");
    expect(posted.kind).toBe("run");
    FakeWorker.last?.respond({ id: posted.id, status: "ok", trace: [], stdout: "", stopReason: "none" });
    const result = await promise;
    expect(result.status).toBe("ok");
    const second = runJavaMission({ code: "move();", layout: freshLayout() });
    expect(FakeWorker.created).toBe(1);
    void second;
    resetJavaWorker();
  });
});
