import { describe, expect, it, vi } from "vitest";
import { readRunnerEnv } from "./env";
import {
  COMPILE_MEMORY_BYTES,
  COMPILE_TIMEOUT_MS,
  RUN_MEMORY_BYTES,
  RUN_TIMEOUT_MS,
  RunnerUnavailableError,
  executeProgram,
} from "./piston";

const ENV = { url: "http://runner.test", key: "sekret" };

const OK_BODY = {
  language: "java",
  version: "15.0.2",
  compile: { stdout: "", stderr: "", output: "", code: 0, signal: null },
  run: { stdout: "42\n", stderr: "", output: "42\n", code: 0, signal: null },
};

describe("readRunnerEnv (ADR-0002)", () => {
  it("reads both values and trims a trailing slash off the URL", () => {
    expect(
      readRunnerEnv({
        RUNNER_URL: " http://runner.test/ ",
        RUNNER_KEY: " sekret ",
      }),
    ).toEqual(ENV);
  });

  it("missing or blank value → null, never a throw (ADR-0007)", () => {
    expect(readRunnerEnv({})).toBeNull();
    expect(readRunnerEnv({ RUNNER_URL: ENV.url })).toBeNull();
    expect(readRunnerEnv({ RUNNER_KEY: ENV.key })).toBeNull();
    expect(readRunnerEnv({ RUNNER_URL: "  ", RUNNER_KEY: "x" })).toBeNull();
  });
});

describe("executeProgram request shape (ADR-0003)", () => {
  it("posts the fixed budget and key header, measures duration", async () => {
    const fetchFn = vi.fn(async () => Response.json(OK_BODY));
    let tick = 0;
    const result = await executeProgram(ENV, "class Main {}", {
      fetchFn: fetchFn as unknown as typeof fetch,
      now: () => (tick += 250),
    });

    expect(result.response.run.stdout).toBe("42\n");
    expect(result.durationMs).toBe(250);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("http://runner.test/api/v2/execute");
    const headers = new Headers(init.headers);
    expect(headers.get("X-Runner-Key")).toBe("sekret");
    expect(JSON.parse(String(init.body))).toEqual({
      language: "java",
      version: "15.0.2",
      files: [{ name: "Main.java", content: "class Main {}" }],
      stdin: "",
      compile_timeout: COMPILE_TIMEOUT_MS,
      run_timeout: RUN_TIMEOUT_MS,
      compile_memory_limit: COMPILE_MEMORY_BYTES,
      run_memory_limit: RUN_MEMORY_BYTES,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("executeProgram faults → RunnerUnavailableError (ADR-0004)", () => {
  it("HTTP error from the runner", async () => {
    const fetchFn = async () => new Response("nope", { status: 500 });
    await expect(
      executeProgram(ENV, "x", { fetchFn }),
    ).rejects.toBeInstanceOf(RunnerUnavailableError);
  });

  it("network failure", async () => {
    const fetchFn = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(
      executeProgram(ENV, "x", { fetchFn }),
    ).rejects.toBeInstanceOf(RunnerUnavailableError);
  });

  it("garbage JSON body shape", async () => {
    const fetchFn = async () => Response.json({ hello: "world" });
    await expect(
      executeProgram(ENV, "x", { fetchFn }),
    ).rejects.toBeInstanceOf(RunnerUnavailableError);
  });

  it("non-JSON body", async () => {
    const fetchFn = async () => new Response("<html>oops</html>");
    await expect(
      executeProgram(ENV, "x", { fetchFn }),
    ).rejects.toBeInstanceOf(RunnerUnavailableError);
  });
});
