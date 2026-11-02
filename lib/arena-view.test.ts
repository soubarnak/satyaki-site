import { describe, expect, test } from "vitest";
import { runArenaBattle } from "./arena";
import {
  ARENA_COMMANDS,
  ARENA_GATE_IDS,
  ARENA_LEVEL_ID,
  ARENA_STARTER,
  arenaBattleLine,
  arenaErrorFeedback,
  arenaGate,
  arenaLockLine,
} from "./arena-view";
import { EMPTY_PROGRESS, type Progress } from "./progress";
import type { RunOutcome } from "./lesson-player";

// Arena view seams (WF-004): the FR-010 gate, the FR-007 error lines,
// and the FR-011 verdict lines. Replay math is covered in arena.test.ts.

function progressWith(passedLevelIds: number[]): Progress {
  return { ...EMPTY_PROGRESS, passedLevelIds };
}

function outcome(partial: Partial<RunOutcome>): RunOutcome {
  return { resultClass: "ok", stdout: "", stderr: "", durationMs: 12, ...partial };
}

describe("arenaGate (FR-010)", () => {
  test("empty progress stays locked with 9 remaining", () => {
    const gate = arenaGate(EMPTY_PROGRESS);
    expect(gate.open).toBe(false);
    expect(gate.remaining).toBe(9);
    expect(gate.nextLevelId).toBe(1);
  });

  test("levels 1 to 8 passed stays locked with 1 remaining", () => {
    const gate = arenaGate(progressWith([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(gate.open).toBe(false);
    expect(gate.remaining).toBe(1);
    expect(gate.nextLevelId).toBe(9);
  });

  test("levels 1 to 9 passed opens the arena", () => {
    const gate = arenaGate(progressWith([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(gate.open).toBe(true);
    expect(gate.remaining).toBe(0);
    expect(gate.nextLevelId).toBeNull();
  });

  test("gate covers exactly levels 1 to 9", () => {
    expect([...ARENA_GATE_IDS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ARENA_LEVEL_ID).toBe(10);
  });
});

describe("arenaLockLine (FR-010 AC-2)", () => {
  test("8 passed names the 1 level that remains", () => {
    const line = arenaLockLine(arenaGate(progressWith([1, 2, 3, 4, 5, 6, 7, 8])));
    expect(line).toContain("1 level remains");
    expect(line).toContain("Level 9");
  });

  test("empty progress names the 9 levels that remain", () => {
    const line = arenaLockLine(arenaGate(EMPTY_PROGRESS));
    expect(line).toContain("9 levels remain");
  });

  test("open gate needs no lock line", () => {
    const line = arenaLockLine(arenaGate(progressWith([1, 2, 3, 4, 5, 6, 7, 8, 9])));
    expect(line).toBe("");
  });
});

describe("arena starter and command help (WF-004 step 1)", () => {
  test("starter is a runnable Main printing one command", () => {
    expect(ARENA_STARTER).toContain("class Main");
    expect(ARENA_STARTER).toContain("System.out.println(");
    expect(ARENA_STARTER).toContain("MOVE");
  });

  test("command help lists exactly MOVE, TURN, and ATTACK", () => {
    expect(ARENA_COMMANDS.map((entry) => entry.command)).toEqual([
      "MOVE",
      "TURN",
      "ATTACK",
    ]);
    for (const entry of ARENA_COMMANDS) {
      expect(entry.meaning.length).toBeGreaterThan(0);
    }
  });
});

describe("arenaErrorFeedback (FR-007 alternate path)", () => {
  for (const resultClass of ["compile", "runtime", "memory-cap", "time-cap"]) {
    test(`${resultClass} is a code error that keeps the raw text`, () => {
      const run = outcome({ resultClass, stderr: "Main.java:3: error" });
      const feedback = arenaErrorFeedback(run, run.stderr);
      expect(feedback.kind).toBe("code-error");
      expect(feedback.boltLine.length).toBeGreaterThan(0);
      expect(feedback.rawError).toBe("Main.java:3: error");
    });
  }

  test("runner down or busy reads distinct from a code mistake", () => {
    for (const resultClass of ["runner-unavailable", "busy"]) {
      const feedback = arenaErrorFeedback(outcome({ resultClass }));
      expect(feedback.kind).toBe("runner-problem");
      expect(feedback.boltLine).toMatch(/[Tt]ry Run again/);
    }
    const compile = arenaErrorFeedback(outcome({ resultClass: "compile" }));
    const down = arenaErrorFeedback(outcome({ resultClass: "runner-unavailable" }));
    expect(down.boltLine).not.toBe(compile.boltLine);
  });

  test("unknown class fails closed with the generic try-again line", () => {
    const run = outcome({ resultClass: "mystery", stderr: "raw" });
    const feedback = arenaErrorFeedback(run, run.stderr);
    expect(feedback.kind).toBe("code-error");
    expect(feedback.rawError).toBe("raw");
  });
});

describe("arenaBattleLine (FR-011)", () => {
  const reference = [...Array<string>(4).fill("MOVE"), ...Array<string>(20).fill("ATTACK")].join(
    "\n",
  );

  test("reference win names victory and the level 10 award", () => {
    const line = arenaBattleLine(runArenaBattle(reference));
    expect(line).toMatch(/Victory/);
    expect(line).toContain("200 points");
  });

  test("empty stdout asks for commands", () => {
    const line = arenaBattleLine(runArenaBattle("Bolt is awake!"));
    expect(line).toMatch(/no commands/);
  });

  test("short attack run stays open for retry", () => {
    const line = arenaBattleLine(runArenaBattle("ATTACK"));
    expect(line).toMatch(/Not yet/);
  });
});
