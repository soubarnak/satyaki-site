import { describe, expect, it } from "vitest";
import { judgeRun } from "./judge";
import { getLevel, type Level } from "./levels";

function level(id: number): Level {
  const found = getLevel(id);
  if (!found) throw new Error(`missing level ${id}`);
  return found;
}

// Level 1 (print): token "System.out.println(", expected "Bolt is awake!".
const LEVEL1_PROGRAM = `public class Main {
    public static void main(String[] args) {
        System.out.println("Bolt is awake!");
    }
}`;

// Level 4 (loop): prints the expected numbers without ever using a loop.
const LEVEL4_PRINT_ONLY = `public class Main {
    public static void main(String[] args) {
        System.out.println(1);
        System.out.println(2);
        System.out.println(3);
    }
}`;

const LEVEL4_LOOP = `public class Main {
    public static void main(String[] args) {
        for (int i = 1; i <= 3; i++) {
            System.out.println(i);
        }
    }
}`;

describe("judgeRun (FR-006: output plus concept)", () => {
  it("passes on exact output with the concept token present (AC-1)", () => {
    const verdict = judgeRun(level(1), LEVEL1_PROGRAM, {
      resultClass: "ok",
      stdout: "Bolt is awake!\n",
    });
    expect(verdict).toEqual({
      passed: true,
      outputMatched: true,
      conceptUsed: true,
      missingTokens: [],
    });
  });

  it("matches output after trim, so the trailing newline from println passes", () => {
    expect(
      judgeRun(level(4), LEVEL4_LOOP, { resultClass: "ok", stdout: "1\n2\n3\n" }).passed,
    ).toBe(true);
  });

  it("fails output-only programs that print the answer without the concept (AC-2)", () => {
    const verdict = judgeRun(level(4), LEVEL4_PRINT_ONLY, {
      resultClass: "ok",
      stdout: "1\n2\n3\n",
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.outputMatched).toBe(true);
    expect(verdict.conceptUsed).toBe(false);
    expect(verdict.missingTokens).toEqual([{ text: "for (", minCount: 1 }]);
  });

  it("fails when the token is present but the output is wrong", () => {
    const verdict = judgeRun(level(4), LEVEL4_LOOP, {
      resultClass: "ok",
      stdout: "1\n2\n",
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.outputMatched).toBe(false);
    expect(verdict.conceptUsed).toBe(true);
    expect(verdict.missingTokens).toEqual([]);
  });

  it("requires exact internal output: case and inner whitespace differences fail", () => {
    expect(
      judgeRun(level(1), LEVEL1_PROGRAM, { resultClass: "ok", stdout: "Bolt is awake?" }).passed,
    ).toBe(false);
    expect(
      judgeRun(level(1), LEVEL1_PROGRAM, { resultClass: "ok", stdout: "bolt is awake!" }).passed,
    ).toBe(false);
    expect(
      judgeRun(level(4), LEVEL4_LOOP, { resultClass: "ok", stdout: "1 2 3" }).passed,
    ).toBe(false);
  });

  it("checks concept tokens case-sensitively", () => {
    const wrongCase = LEVEL4_LOOP.replace("for (", "For (");
    const verdict = judgeRun(level(4), wrongCase, {
      resultClass: "ok",
      stdout: "1\n2\n3\n",
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.conceptUsed).toBe(false);
  });

  it("enforces minCount: level 8 needs its token in both loops", () => {
    const oneLoop = `for (int row = 0; row < 3; row++) { count += 3; }`;
    const twoLoops = `for (int row = 0; row < 3; row++) {
        for (int col = 0; col < 3; col++) { count++; }
    }`;
    const run = { resultClass: "ok", stdout: "9\n" };
    expect(judgeRun(level(8), oneLoop, run).passed).toBe(false);
    expect(judgeRun(level(8), oneLoop, run).missingTokens).toEqual([
      { text: "for (", minCount: 2 },
    ]);
    expect(judgeRun(level(8), twoLoops, run).passed).toBe(true);
  });

  it("requires every token: level 10 missing the method token fails and names it", () => {
    const loopOnly = `for (int i = 0; i < 3; i++) { System.out.println("Rescue"); }`;
    const verdict = judgeRun(level(10), loopOnly, {
      resultClass: "ok",
      stdout: "Rescue\nRescue\nRescue\nStation awake!",
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.missingTokens).toEqual([
      { text: "static void report(", minCount: 1 },
    ]);
  });
});

describe("judgeRun (NFR-014: no pass under faults)", () => {
  it.each([
    "compile",
    "runtime",
    "memory-cap",
    "time-cap",
    "runner-unavailable",
    "busy",
  ])("never passes on result class %s, even with matching output and token", (resultClass) => {
    const verdict = judgeRun(level(1), LEVEL1_PROGRAM, {
      resultClass,
      stdout: "Bolt is awake!\n",
    });
    expect(verdict.passed).toBe(false);
  });

  it("fails closed on an unknown result class", () => {
    expect(
      judgeRun(level(1), LEVEL1_PROGRAM, {
        resultClass: "garbage",
        stdout: "Bolt is awake!\n",
      }).passed,
    ).toBe(false);
  });
});
