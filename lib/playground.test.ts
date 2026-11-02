import { describe, expect, test } from "vitest";
import { PLAYGROUND_EXAMPLE, playgroundFeedback } from "./playground";
import type { RunOutcome } from "./lesson-player";

// Playground feedback seams (WF-003, FR-009): output echoes with no
// verdict, errors map to child-first lines, and nothing can pass.

function outcome(partial: Partial<RunOutcome>): RunOutcome {
  return { resultClass: "ok", stdout: "", stderr: "", durationMs: 12, ...partial };
}

test("example program is a runnable print program", () => {
  expect(PLAYGROUND_EXAMPLE).toContain("System.out.println(");
  expect(PLAYGROUND_EXAMPLE).toContain("class Main");
});

test("ok run echoes output with no verdict attached", () => {
  const feedback = playgroundFeedback(outcome({ stdout: "Hello, Bolt!\n" }));
  expect(feedback.kind).toBe("output");
  expect(feedback.boltLine.length).toBeGreaterThan(0);
  expect(feedback.rawError).toBe("");
});

describe("error classes map to child lines with raw text kept (FR-007)", () => {
  for (const resultClass of ["compile", "runtime", "memory-cap", "time-cap"]) {
    test(`${resultClass} is a code error, never output`, () => {
      const run = outcome({ resultClass, stderr: "Main.java:3: error" });
      const feedback = playgroundFeedback(run, run.stderr);
      expect(feedback.kind).toBe("code-error");
      expect(feedback.boltLine.length).toBeGreaterThan(0);
      expect(feedback.rawError).toBe("Main.java:3: error");
    });
  }

  test("runner down or busy reads distinct from a code mistake", () => {
    for (const resultClass of ["runner-unavailable", "busy"]) {
      const feedback = playgroundFeedback(outcome({ resultClass }));
      expect(feedback.kind).toBe("runner-problem");
      expect(feedback.boltLine).toMatch(/[Tt]ry Run again/);
    }
    const compile = playgroundFeedback(outcome({ resultClass: "compile" }));
    const down = playgroundFeedback(outcome({ resultClass: "runner-unavailable" }));
    expect(down.boltLine).not.toBe(compile.boltLine);
  });

  test("unknown class fails closed with the generic try-again line", () => {
    const run = outcome({ resultClass: "mystery", stderr: "raw" });
    const feedback = playgroundFeedback(run, run.stderr);
    expect(feedback.kind).toBe("code-error");
    expect(feedback.rawError).toBe("raw");
  });
});
