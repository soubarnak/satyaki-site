import { describe, expect, it } from "vitest";
import {
  MAX_STREAM_CHARS,
  TRUNCATION_MARK,
  capStream,
  classifyRun,
  parsePistonResponse,
  stripRunnerPaths,
  type PistonExecuteResponse,
  type PistonPhase,
} from "./classify";

function phase(overrides: Partial<PistonPhase> = {}): PistonPhase {
  return {
    stdout: "",
    stderr: "",
    output: "",
    code: 0,
    signal: null,
    ...overrides,
  };
}

function okResponse(): PistonExecuteResponse {
  return {
    compile: phase(),
    run: phase({ stdout: "42\n", output: "42\n" }),
  };
}

describe("classifyRun (ADR-0004 rows, canned Piston payloads)", () => {
  it("compile and run exit 0 → ok", () => {
    expect(classifyRun(okResponse())).toBe("ok");
  });

  it("run exit 0 with no compile phase → ok", () => {
    expect(classifyRun({ run: phase() })).toBe("ok");
  });

  it("compile exit not 0 → compile", () => {
    const response = okResponse();
    response.compile = phase({ code: 1, stderr: "Main.java:1: error" });
    expect(classifyRun(response)).toBe("compile");
  });

  it("compile killed → compile", () => {
    const response = okResponse();
    response.compile = phase({ code: null, signal: "SIGKILL" });
    expect(classifyRun(response)).toBe("compile");
  });

  it("run exit not 0, not killed → runtime", () => {
    const response = okResponse();
    response.run = phase({
      code: 1,
      stderr: "Exception in thread \"main\" java.lang.ArithmeticException",
    });
    expect(classifyRun(response)).toBe("runtime");
  });

  it("run stderr carries OutOfMemoryError → memory-cap, killed or not", () => {
    const exited = okResponse();
    exited.run = phase({
      code: 1,
      stderr: "java.lang.OutOfMemoryError: Java heap space",
    });
    expect(classifyRun(exited)).toBe("memory-cap");

    const killed = okResponse();
    killed.run = phase({
      code: null,
      signal: "SIGKILL",
      stderr: "java.lang.OutOfMemoryError: Java heap space",
    });
    expect(classifyRun(killed)).toBe("memory-cap");
  });

  it("run killed without OutOfMemoryError → time-cap", () => {
    const response = okResponse();
    response.run = phase({ code: null, signal: "SIGKILL" });
    expect(classifyRun(response)).toBe("time-cap");
  });

  it("compile failure wins over any run signal", () => {
    const response: PistonExecuteResponse = {
      compile: phase({ code: 1 }),
      run: phase({ code: null, signal: "SIGKILL" }),
    };
    expect(classifyRun(response)).toBe("compile");
  });
});

describe("parsePistonResponse", () => {
  it("accepts a well-shaped execute response", () => {
    expect(parsePistonResponse(okResponse())).not.toBeNull();
  });

  it("rejects garbage bodies", () => {
    expect(parsePistonResponse(null)).toBeNull();
    expect(parsePistonResponse("not json")).toBeNull();
    expect(parsePistonResponse({ message: "unknown language" })).toBeNull();
    expect(parsePistonResponse({ run: { stdout: 42 } })).toBeNull();
    expect(
      parsePistonResponse({ run: phase(), compile: { nope: true } }),
    ).toBeNull();
  });
});

describe("capStream (DR-005)", () => {
  it("passes text at or under the cap untouched", () => {
    expect(capStream("hi")).toEqual({ text: "hi", truncated: false });
    const atCap = "x".repeat(MAX_STREAM_CHARS);
    expect(capStream(atCap)).toEqual({ text: atCap, truncated: false });
  });

  it("caps at 10000 characters and marks truncation", () => {
    const capped = capStream("x".repeat(20000));
    expect(capped.truncated).toBe(true);
    expect(capped.text).toBe("x".repeat(10000) + TRUNCATION_MARK);
  });
});

describe("stripRunnerPaths (NFR-005)", () => {
  it("removes internal runner paths, keeps the file name", () => {
    expect(
      stripRunnerPaths("/piston/jobs/abc-123/Main.java:3: error: ';' expected"),
    ).toBe("Main.java:3: error: ';' expected");
  });

  it("leaves ordinary error text alone", () => {
    const text = "Exception in thread \"main\" java.lang.Error: boom";
    expect(stripRunnerPaths(text)).toBe(text);
  });
});
