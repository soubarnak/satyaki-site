import { describe, expect, test } from "vitest";
import { getLevel } from "./levels";
import { parseRunOutcome, runFeedback, type RunOutcome } from "./lesson-player";

// Lesson player feedback seams (WF-002): the child-readable line comes
// first (FR-007), runner trouble reads distinct from a code mistake,
// and nothing but an "ok" run judged as a pass can pass (FR-006).

const level1 = getLevel(1)!;
const solution = level1.starterCode.replace(
  "// YOUR CODE BELOW",
  '// YOUR CODE BELOW\n        System.out.println("Bolt is awake!");',
);

function outcome(partial: Partial<RunOutcome>): RunOutcome {
  return { resultClass: "ok", stdout: "", stderr: "", durationMs: 12, ...partial };
}

test("ok run with exact output and concept token passes (FR-006 AC-1)", () => {
  const feedback = runFeedback(level1, solution, outcome({ stdout: "Bolt is awake!\n" }));
  expect(feedback.passed).toBe(true);
  expect(feedback.kind).toBe("passed");
});

test("ok run with wrong output does not pass and says not yet", () => {
  const feedback = runFeedback(level1, solution, outcome({ stdout: "Hello?\n" }));
  expect(feedback.passed).toBe(false);
  expect(feedback.kind).toBe("wrong-output");
});

test("right output without the concept token names the missing concept (FR-006 AC-2)", () => {
  const cheat = "public class Main { /* printed by magic */ }";
  const feedback = runFeedback(level1, cheat, outcome({ stdout: "Bolt is awake!" }));
  expect(feedback.passed).toBe(false);
  expect(feedback.kind).toBe("missing-concept");
  expect(feedback.boltLine).toContain(level1.concept);
  expect(feedback.boltLine).toContain("System.out.println(");
});

describe("error classes map to child lines with raw text kept (FR-007)", () => {
  for (const resultClass of ["compile", "runtime", "memory-cap", "time-cap"]) {
    test(`${resultClass} is a code error, never a pass`, () => {
      const run = outcome({ resultClass, stdout: "Bolt is awake!", stderr: "Main.java:3: error" });
      const feedback = runFeedback(level1, solution, run, run.stderr);
      expect(feedback.passed).toBe(false);
      expect(feedback.kind).toBe("code-error");
      expect(feedback.boltLine.length).toBeGreaterThan(0);
      expect(feedback.rawError).toBe("Main.java:3: error");
    });
  }

  test("runner down or busy reads distinct from a code mistake", () => {
    for (const resultClass of ["runner-unavailable", "busy"]) {
      const feedback = runFeedback(level1, solution, outcome({ resultClass }));
      expect(feedback.passed).toBe(false);
      expect(feedback.kind).toBe("runner-problem");
      expect(feedback.boltLine).toMatch(/[Tt]ry Run again/);
    }
    const compile = runFeedback(level1, solution, outcome({ resultClass: "compile" }));
    const down = runFeedback(level1, solution, outcome({ resultClass: "runner-unavailable" }));
    expect(down.boltLine).not.toBe(compile.boltLine);
  });

  test("unknown class fails closed with the generic try-again line (FR-007 AC-2)", () => {
    const run = outcome({ resultClass: "mystery", stdout: "Bolt is awake!", stderr: "raw" });
    const feedback = runFeedback(level1, solution, run, run.stderr);
    expect(feedback.passed).toBe(false);
    expect(feedback.kind).toBe("code-error");
    expect(feedback.rawError).toBe("raw");
  });
});

describe("parseRunOutcome narrows /api/run bodies", () => {
  test("classed 200 body round-trips", () => {
    const parsed = parseRunOutcome({
      resultClass: "ok",
      stdout: "hi",
      stderr: "",
      stdoutTruncated: false,
      stderrTruncated: false,
      durationMs: 42,
    });
    expect(parsed).toEqual({ resultClass: "ok", stdout: "hi", stderr: "", durationMs: 42 });
  });

  test("400 length-gate body becomes a non-passing outcome carrying its text", () => {
    const parsed = parseRunOutcome({ error: "Your program must be between 1 and 20000 characters long." });
    expect(parsed.resultClass).not.toBe("ok");
    expect(parsed.stderr).toContain("20000");
  });

  test("garbage body becomes a non-passing unknown outcome", () => {
    for (const body of [null, "nope", 42, { resultClass: 1 }]) {
      const parsed = parseRunOutcome(body);
      expect(parsed.resultClass).not.toBe("ok");
      expect(parsed.stdout).toBe("");
    }
  });
});
