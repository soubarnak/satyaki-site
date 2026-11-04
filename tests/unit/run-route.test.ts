import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { RunnerEnv } from "@/lib/server/env";
import { executeProgram } from "@/lib/server/piston";
import { createRateLimiter } from "@/lib/server/rate-limit";
import {
  createRunHandler,
  type RunResponseBody,
} from "@/lib/server/run-handler";

// Route integration tests for /api/run against a stub Piston HTTP server
// (ADR-0007). No test calls the live runner.

type StubBehavior = (call: number) => { status?: number; body?: string; hangMs?: number };

interface Stub {
  env: RunnerEnv;
  calls: () => number;
  lastBody: () => unknown;
  close: () => Promise<void>;
}

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function startStub(behavior: StubBehavior): Promise<Stub> {
  let calls = 0;
  let lastBody: unknown;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      calls += 1;
      try {
        lastBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        lastBody = undefined;
      }
      const { status = 200, body = "", hangMs = 0 } = behavior(calls);
      const respond = () => {
        if (res.destroyed) return;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(body);
      };
      if (hangMs > 0) setTimeout(respond, hangMs);
      else respond();
    });
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    env: { url: `http://127.0.0.1:${port}`, key: "test-key" },
    calls: () => calls,
    lastBody: () => lastBody,
    close: () =>
      new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function handlerFor(
  env: RunnerEnv | null,
  options: { abortMs?: number; now?: () => number } = {},
) {
  return createRunHandler({
    limiter: createRateLimiter(),
    readEnv: () => env,
    execute: (runnerEnv, program) =>
      executeProgram(runnerEnv, program, { abortMs: options.abortMs }),
    now: options.now ?? Date.now,
  });
}

function runRequest(program: unknown, ip = "203.0.113.7"): Request {
  return new Request("http://site.test/api/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof program === "string" ? program : JSON.stringify(program),
  });
}

function pistonBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    language: "java",
    version: "15.0.2",
    compile: { stdout: "", stderr: "", output: "", code: 0, signal: null },
    run: { stdout: "42\n", stderr: "", output: "42\n", code: 0, signal: null },
    ...overrides,
  });
}

async function bodyOf(res: Response): Promise<RunResponseBody> {
  return (await res.json()) as RunResponseBody;
}

describe("POST /api/run happy path (FR-005, IR-003)", () => {
  it("returns ok with output and duration, forwards only the program text", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    const res = await handlerFor(stub.env)(
      runRequest({ program: "public class Main {}", language: "python" }),
    );
    expect(res.status).toBe(200);
    const body = await bodyOf(res);
    expect(body.resultClass).toBe("ok");
    expect(body.stdout).toBe("42\n");
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    // Language and file pinned server-side (ADR-0003): the client's
    // attempt to pick python never reaches the runner.
    const forwarded = stub.lastBody() as {
      language: string;
      files: { name: string; content: string }[];
    };
    expect(forwarded.language).toBe("java");
    expect(forwarded.files).toEqual([
      { name: "Main.java", content: "public class Main {}" },
    ]);
  });

  it("compile error surfaces the compile stderr with paths stripped", async () => {
    const stub = await startStub(() => ({
      body: pistonBody({
        compile: {
          stdout: "",
          stderr: "/piston/jobs/x/Main.java:1: error: bad",
          output: "",
          code: 1,
          signal: null,
        },
        run: { stdout: "", stderr: "", output: "", code: null, signal: null },
      }),
    }));
    const body = await bodyOf(
      await handlerFor(stub.env)(runRequest({ program: "broken" })),
    );
    expect(body.resultClass).toBe("compile");
    expect(body.stderr).toBe("Main.java:1: error: bad");
  });
});

describe("NFR-014 fault set: 0 ok results", () => {
  it("runner timeout kill → time-cap", async () => {
    const stub = await startStub(() => ({
      body: pistonBody({
        run: { stdout: "", stderr: "", output: "", code: null, signal: "SIGKILL" },
      }),
    }));
    const body = await bodyOf(
      await handlerFor(stub.env)(runRequest({ program: "loop" })),
    );
    expect(body.resultClass).toBe("time-cap");
  });

  it("route abort on a hung runner → runner-unavailable", async () => {
    const stub = await startStub(() => ({ body: pistonBody(), hangMs: 5000 }));
    const body = await bodyOf(
      await handlerFor(stub.env, { abortMs: 100 })(
        runRequest({ program: "x" }),
      ),
    );
    expect(body.resultClass).toBe("runner-unavailable");
  });

  it("runner HTTP error → runner-unavailable", async () => {
    const stub = await startStub(() => ({ status: 500, body: "boom" }));
    const body = await bodyOf(
      await handlerFor(stub.env)(runRequest({ program: "x" })),
    );
    expect(body.resultClass).toBe("runner-unavailable");
  });

  it("refused key (403, e.g. a rotated-out key) → runner-unavailable (#26)", async () => {
    const stub = await startStub(() => ({ status: 403, body: "forbidden" }));
    const res = await handlerFor(stub.env)(runRequest({ program: "x" }));
    expect(res.status).toBe(200);
    expect((await bodyOf(res)).resultClass).toBe("runner-unavailable");
  });

  it("garbage body → runner-unavailable", async () => {
    const stub = await startStub(() => ({ body: "this is not json" }));
    const body = await bodyOf(
      await handlerFor(stub.env)(runRequest({ program: "x" })),
    );
    expect(body.resultClass).toBe("runner-unavailable");
  });

  it("runner unreachable → runner-unavailable", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    const env = stub.env;
    await stub.close();
    const body = await bodyOf(await handlerFor(env)(runRequest({ program: "x" })));
    expect(body.resultClass).toBe("runner-unavailable");
  });

  it("missing env → runner-unavailable, no crash (ADR-0002/0007)", async () => {
    const res = await handlerFor(null)(runRequest({ program: "x" }));
    expect(res.status).toBe(200);
    expect((await bodyOf(res)).resultClass).toBe("runner-unavailable");
  });
});

describe("program text limits (DR-001: lengths 0/1/20000/20001)", () => {
  it("rejects 0 and 20001 without calling the runner, accepts 1 and 20000", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    const handler = handlerFor(stub.env);

    const empty = await handler(runRequest({ program: "" }));
    expect(empty.status).toBe(400);
    expect(stub.calls()).toBe(0);

    expect((await handler(runRequest({ program: "x" }))).status).toBe(200);
    expect(
      (await handler(runRequest({ program: "x".repeat(20000) }))).status,
    ).toBe(200);
    expect(stub.calls()).toBe(2);

    const tooLong = await handler(runRequest({ program: "x".repeat(20001) }));
    expect(tooLong.status).toBe(400);
    expect(await tooLong.json()).toEqual({
      error: "Your program must be between 1 and 20000 characters long.",
    });
    expect(stub.calls()).toBe(2);
  });

  it("rejects malformed JSON and non-string programs with 400", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    const handler = handlerFor(stub.env);
    expect((await handler(runRequest("{not json"))).status).toBe(400);
    expect((await handler(runRequest({ program: 42 }))).status).toBe(400);
    expect(stub.calls()).toBe(0);
  });
});

describe("output cap (DR-005)", () => {
  it("truncates each stream at 10000 characters with a mark", async () => {
    const stub = await startStub(() => ({
      body: pistonBody({
        run: {
          stdout: "a".repeat(20000),
          stderr: "b".repeat(20000),
          output: "",
          code: 0,
          signal: null,
        },
      }),
    }));
    const body = await bodyOf(
      await handlerFor(stub.env)(runRequest({ program: "x" })),
    );
    expect(body.stdoutTruncated).toBe(true);
    expect(body.stderrTruncated).toBe(true);
    expect(body.stdout.startsWith("a".repeat(10000))).toBe(true);
    expect(body.stdout).toContain("[output cut short]");
    expect(body.stderr.startsWith("b".repeat(10000))).toBe(true);
  });
});

describe("rate limiting (NFR-009: 25 runs, 21-25 refused)", () => {
  it("refuses runs 21 to 25 with 429 busy and Retry-After", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    let nowMs = 1_000_000;
    const handler = handlerFor(stub.env, { now: () => nowMs });

    for (let i = 1; i <= 20; i++) {
      expect((await handler(runRequest({ program: "x" }))).status).toBe(200);
    }
    for (let i = 21; i <= 25; i++) {
      const res = await handler(runRequest({ program: "x" }));
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
      expect((await bodyOf(res)).resultClass).toBe("busy");
    }
    expect(stub.calls()).toBe(20);

    // Window passes: the same client may run again.
    nowMs += 60_001;
    expect((await handler(runRequest({ program: "x" }))).status).toBe(200);
  });

  it("malformed floods consume quota before validation (ADR-0005)", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    const handler = handlerFor(stub.env, { now: () => 5_000 });
    for (let i = 0; i < 20; i++) {
      expect((await handler(runRequest("{bad"))).status).toBe(400);
    }
    const res = await handler(runRequest({ program: "x" }));
    expect(res.status).toBe(429);
    expect((await bodyOf(res)).resultClass).toBe("busy");
    expect(stub.calls()).toBe(0);
  });

  it("clients behind different forwarded IPs get separate quotas", async () => {
    const stub = await startStub(() => ({ body: pistonBody() }));
    const handler = handlerFor(stub.env, { now: () => 7_000 });
    for (let i = 0; i < 20; i++) {
      await handler(runRequest({ program: "x" }, "198.51.100.1"));
    }
    expect(
      (await handler(runRequest({ program: "x" }, "198.51.100.1"))).status,
    ).toBe(429);
    expect(
      (await handler(runRequest({ program: "x" }, "198.51.100.2"))).status,
    ).toBe(200);
  });

  it("5th concurrent run is busy immediately, no queue (ADR-0005)", async () => {
    const stub = await startStub(() => ({ body: pistonBody(), hangMs: 300 }));
    const handler = handlerFor(stub.env);
    const pending = Array.from({ length: 5 }, (_, i) =>
      handler(runRequest({ program: "x" }, `198.51.100.${i + 1}`)),
    );
    const responses = await Promise.all(pending);
    const classes = await Promise.all(
      responses.map(async (res) => (await bodyOf(res)).resultClass),
    );
    expect(classes.filter((c) => c === "ok")).toHaveLength(4);
    expect(classes.filter((c) => c === "busy")).toHaveLength(1);
    expect(stub.calls()).toBe(4);
  });
});
