// Grader tests (issue #62, ADR-0013 §decision, spec §5).
// Seams: gradeRun, checkConcept, buildFeedback. Expected values are
// spec literals (Star counts, fixed anti-hardcoding line, caps), never
// recomputed from the implementation. Glossary: Pass, Star, Par, Seed.
import { describe, expect, it } from "vitest";
import {
  ANTI_HARDCODE_LINE,
  buildFeedback,
  checkConcept,
  checkOnSnapshot,
  compareScalar,
  gradeRun,
  type GradeRunInput,
  type SeedRun,
  type StopReason,
} from "./grader";
import type { PassCheck } from "./content";
import type { WorldSnapshot } from "./ship-sim";

function snap(opts: {
  x?: number;
  z?: number;
  energy?: number;
  stepsUsed?: number;
  crystals?: number;
  entities?: WorldSnapshot["entities"];
} = {}): WorldSnapshot {
  return {
    ship: {
      x: opts.x ?? 0,
      y: 0,
      z: opts.z ?? 0,
      heading: "east",
      energy: opts.energy ?? 20,
      shield: false,
      crystals: opts.crystals ?? 0,
      stepsUsed: opts.stepsUsed ?? 0,
    },
    entities: opts.entities ?? {},
    bounds: { maxX: 8, maxY: 1, maxZ: 2 },
  };
}

const REACH: PassCheck = {
  id: "reach-pad",
  label: "Reach the launch pad",
  statePath: "ship.x",
  comparator: "eq",
  expected: 3,
  timing: "final",
};

function runStates(finalX: number, steps: number, energyStart: number): WorldSnapshot[] {
  const states: WorldSnapshot[] = [snap({ x: 0, energy: energyStart, stepsUsed: 0 })];
  for (let step = 1; step <= steps; step += 1) {
    const x = Math.min(step, finalX);
    states.push(snap({ x, energy: energyStart - step, stepsUsed: step }));
  }
  if (states[states.length - 1].ship.x !== finalX) {
    states.push(snap({ x: finalX, energy: energyStart - steps, stepsUsed: steps }));
  }
  return states;
}

function seedRun(opts: {
  seed?: number;
  isPractice?: boolean;
  finalX?: number;
  steps?: number;
  energyStart?: number;
  stop?: StopReason;
  executedLines?: readonly number[];
}): SeedRun {
  const states = runStates(opts.finalX ?? 3, opts.steps ?? 3, opts.energyStart ?? 20);
  return {
    seed: opts.seed ?? 101,
    isPractice: opts.isPractice ?? false,
    states,
    stop: opts.stop ?? "none",
    executedLines: opts.executedLines,
  };
}

function baseInput(opts: {
  checks?: PassCheck[];
  par?: { maxSteps: number; maxEnergy: number };
  concept?: GradeRunInput["star3Concept"];
  language?: "python" | "java";
  code?: string;
  seeds?: SeedRun[];
  isBossPartB?: boolean;
}): GradeRunInput {
  return {
    checks: opts.checks ?? [REACH],
    par: opts.par ?? { maxSteps: 7, maxEnergy: 7 },
    star3Concept: opts.concept ?? "loop",
    language: opts.language ?? "python",
    code: opts.code ?? "# YOUR CODE BELOW\nmove()\n# YOUR CODE ABOVE\n",
    seeds: opts.seeds ?? [
      seedRun({ seed: 101, isPractice: true }),
      seedRun({ seed: 102 }),
    ],
    isBossPartB: opts.isBossPartB,
  };
}

const LOOP_CODE = [
  "# starter scaffold",
  "# YOUR CODE BELOW",
  "for i in range(3):",
  "    move()",
  "# YOUR CODE ABOVE",
  "scaffold_tail()",
].join("\n");

describe("comparators and statePath (ADR-0013)", () => {
  it("grades eq/ne/gte/lte on scalars", () => {
    expect(compareScalar("eq", 3, 3)).toBe(true);
    expect(compareScalar("eq", 3, 4)).toBe(false);
    expect(compareScalar("ne", 3, 4)).toBe(true);
    expect(compareScalar("gte", 5, 5)).toBe(true);
    expect(compareScalar("gte", 4, 5)).toBe(false);
    expect(compareScalar("lte", 4, 5)).toBe(true);
    expect(compareScalar("eq", true, true)).toBe(true);
    expect(compareScalar("eq", "go", "go")).toBe(true);
  });

  it("fails unresolvable statePath instead of crashing", () => {
    const missing: PassCheck = {
      id: "ghost",
      label: "Touch the ghost",
      statePath: "entities.ghost-9.on",
      comparator: "eq",
      expected: true,
      timing: "final",
    };
    expect(checkOnSnapshot(missing, snap())).toBe(false);
    const result = gradeRun(baseInput({ checks: [missing] }));
    expect(result.pass).toBe(false);
    expect(result.checks[0].passed).toBe(false);
  });
});

describe("check timing (ADR-0013)", () => {
  it("judges final checks only at program end", () => {
    const states = [snap({ x: 0 }), snap({ x: 1 }), snap({ x: 3 })];
    const practice: SeedRun = { seed: 101, isPractice: true, states, stop: "none" };
    const result = gradeRun(baseInput({ seeds: [practice] }));
    expect(result.checks[0].passed).toBe(true);
  });

  it("fails intermediate checks at any judged point with the first step", () => {
    const mid: PassCheck = {
      id: "hold",
      label: "Hold the reading mid-flight",
      statePath: "ship.energy",
      comparator: "lte",
      expected: 15,
      timing: "intermediate",
    };
    const states = [snap({ energy: 20 }), snap({ energy: 19 }), snap({ energy: 18 })];
    const practice: SeedRun = { seed: 101, isPractice: true, states, stop: "none" };
    const result = gradeRun(baseInput({ checks: [mid], seeds: [practice] }));
    expect(result.pass).toBe(false);
    expect(result.checks[0].firstFailStep).toBe(0);
  });
});

describe("Star matrix (ADR-0013)", () => {
  it("Star 1 only: Pass without Par or concept earns 1 Star", () => {
    const result = gradeRun(
      baseInput({
        concept: "loop",
        code: "# YOUR CODE BELOW\nmove()\n# YOUR CODE ABOVE\n",
        seeds: [
          seedRun({ seed: 101, isPractice: true, steps: 9, energyStart: 20 }),
          seedRun({ seed: 102, steps: 9, energyStart: 20 }),
        ],
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.parMet).toBe(false);
    expect(result.conceptMet).toBe(false);
    expect(result.stars).toBe(1);
  });

  it("Pass plus Par without concept earns 2 Stars", () => {
    const result = gradeRun(
      baseInput({
        code: "# YOUR CODE BELOW\nmove()\n# YOUR CODE ABOVE\n",
        seeds: [seedRun({ seed: 101, isPractice: true }), seedRun({ seed: 102 })],
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.parMet).toBe(true);
    expect(result.conceptMet).toBe(false);
    expect(result.stars).toBe(2);
  });

  it("concept without Par earns 2 Stars", () => {
    const result = gradeRun(
      baseInput({
        concept: "loop",
        code: LOOP_CODE,
        seeds: [
          seedRun({ seed: 101, isPractice: true, steps: 9, energyStart: 20, executedLines: [3, 4] }),
          seedRun({ seed: 102, steps: 3, energyStart: 20, executedLines: [3, 4] }),
        ],
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.parMet).toBe(false);
    expect(result.conceptMet).toBe(true);
    expect(result.stars).toBe(2);
  });

  it("Pass plus Par plus concept earns 3 Stars", () => {
    const result = gradeRun(
      baseInput({
        concept: "loop",
        code: LOOP_CODE,
        seeds: [
          seedRun({ seed: 101, isPractice: true, executedLines: [3, 4] }),
          seedRun({ seed: 102, executedLines: [3, 4] }),
        ],
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.stars).toBe(3);
  });

  it("Par uses the practice Seed only", () => {
    const result = gradeRun(
      baseInput({
        code: "# YOUR CODE BELOW\nmove()\n# YOUR CODE ABOVE\n",
        seeds: [
          seedRun({ seed: 101, isPractice: true, steps: 3 }),
          seedRun({ seed: 102, steps: 500 }),
        ],
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.parMet).toBe(true);
  });

  it("Boss Gate Part B awards no Stars, Par, or concept", () => {
    const result = gradeRun(
      baseInput({
        code: LOOP_CODE,
        seeds: [
          seedRun({ seed: 591, isPractice: true, executedLines: [3, 4] }),
          seedRun({ seed: 592 }),
          seedRun({ seed: 593 }),
        ],
        isBossPartB: true,
      }),
    );
    expect(result.pass).toBe(true);
    expect(result.stars).toBe(0);
    expect(result.parMet).toBe(false);
    expect(result.conceptMet).toBe(false);
  });
});

describe("Star 3 scaffold, comments, strings (ADR-0013)", () => {
  it("ignores loop text in scaffold outside the markers", () => {
    const code = ["for i in range(3):", "    move()", "# YOUR CODE BELOW", "move()", "# YOUR CODE ABOVE"].join(
      "\n",
    );
    expect(checkConcept("loop", "python", code, [1, 2])).toBe(false);
  });

  it("ignores loop text in comments and string literals", () => {
    const commented = "# YOUR CODE BELOW\n# for i in range(3):\nmove()\n# YOUR CODE ABOVE";
    expect(checkConcept("loop", "python", commented, [2, 3])).toBe(false);
    const stringy = '# YOUR CODE BELOW\nx = "for (i = 0; i < 3; i++)"\nmove()\n# YOUR CODE ABOVE';
    expect(checkConcept("loop", "python", stringy, [2, 3])).toBe(false);
  });

  it("requires execution: an unexecuted loop earns nothing", () => {
    expect(checkConcept("loop", "python", LOOP_CODE, [])).toBe(false);
    expect(checkConcept("loop", "python", LOOP_CODE, [1])).toBe(false);
  });

  it("requires a Cadet function to be called, not just defined", () => {
    const code = [
      "# YOUR CODE BELOW",
      "def boost():",
      "    move()",
      "move()",
      "# YOUR CODE ABOVE",
    ].join("\n");
    expect(checkConcept("function", "python", code, [2, 4])).toBe(false);
    const called = [
      "# YOUR CODE BELOW",
      "def boost():",
      "    move()",
      "boost()",
      "# YOUR CODE ABOVE",
    ].join("\n");
    expect(checkConcept("function", "python", called, [2, 3, 4])).toBe(true);
  });

  it("requires list creation plus index access", () => {
    const literalOnly = "# YOUR CODE BELOW\ncells = [1, 2, 3]\nmove()\n# YOUR CODE ABOVE";
    expect(checkConcept("list", "python", literalOnly, [2, 3])).toBe(false);
    const both = "# YOUR CODE BELOW\ncells = [1, 2, 3]\nmove_to(cells[0])\n# YOUR CODE ABOVE";
    expect(checkConcept("list", "python", both, [2, 3])).toBe(true);
  });

  it("grades the Java mapping: enhanced for, switch, ternary, ArrayList", () => {
    const enhanced = [
      "public class Main {",
      "    // YOUR CODE BELOW",
      "    for (String cell : cells) {",
      "        move();",
      "    }",
      "    // YOUR CODE ABOVE",
      "}",
    ].join("\n");
    expect(checkConcept("loop", "java", enhanced, [3, 4])).toBe(true);
    const switched = [
      "public class Main {",
      "    // YOUR CODE BELOW",
      "    switch (heading) {",
      "        case 1: move(); break;",
      "    }",
      "    // YOUR CODE ABOVE",
      "}",
    ].join("\n");
    expect(checkConcept("conditional", "java", switched, [3, 4])).toBe(true);
    const ternary = [
      "public class Main {",
      "    // YOUR CODE BELOW",
      "    int step = ahead ? 1 : 0;",
      "    // YOUR CODE ABOVE",
      "}",
    ].join("\n");
    expect(checkConcept("conditional", "java", ternary, [3])).toBe(true);
    const arrayList = [
      "public class Main {",
      "    // YOUR CODE BELOW",
      "    ArrayList<String> cells = new ArrayList<String>();",
      "    moveTo(cells.get(0));",
      "    // YOUR CODE ABOVE",
      "}",
    ].join("\n");
    expect(checkConcept("list", "java", arrayList, [3, 4])).toBe(true);
  });

  it("grades variable assignment that executes", () => {
    const code = "# YOUR CODE BELOW\npower = 3\nmove()\n# YOUR CODE ABOVE";
    expect(checkConcept("variable", "python", code, [2, 3])).toBe(true);
    const java = [
      "public class Main {",
      "    // YOUR CODE BELOW",
      "    int power = 3;",
      "    // YOUR CODE ABOVE",
      "}",
    ].join("\n");
    expect(checkConcept("variable", "java", java, [3])).toBe(true);
  });
});

describe("caps and errors (ADR-0013)", () => {
  it("a step-cap Seed awards no Stars and counts as a Run, never a Pass", () => {
    const result = gradeRun(
      baseInput({
        code: LOOP_CODE,
        seeds: [
          seedRun({ seed: 101, isPractice: true, stop: "step-cap", executedLines: [3, 4] }),
          seedRun({ seed: 102 }),
        ],
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.stars).toBe(0);
    expect(result.stopReason).toBe("step-cap");
    expect(result.parMet).toBe(false);
    expect(result.conceptMet).toBe(false);
  });

  it("an error Seed still grades the other Seeds", () => {
    const failingHidden: SeedRun = {
      seed: 102,
      isPractice: false,
      states: [snap({ x: 0 }), snap({ x: 1 })],
      stop: "none",
    };
    const result = gradeRun(
      baseInput({
        seeds: [seedRun({ seed: 101, isPractice: true, stop: "error" }), failingHidden],
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.stopReason).toBe("error");
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].passed).toBe(false);
  });
});

describe("feedback (ADR-0013)", () => {
  it("hidden-Seed feedback leaks no layout detail", () => {
    const hiddenFail: SeedRun = {
      seed: 777,
      isPractice: false,
      states: [snap({ x: 0 }), snap({ x: 1 })],
      stop: "none",
    };
    const result = gradeRun(
      baseInput({
        seeds: [seedRun({ seed: 101, isPractice: true }), hiddenFail],
      }),
    );
    expect(result.pass).toBe(false);
    expect(result.checks[0].hiddenFail).toBe(true);
    const lines = buildFeedback(result, {
      par: { maxSteps: 7, maxEnergy: 7 },
      practiceStepsUsed: 3,
      practiceEnergySpent: 3,
      conceptName: "loop",
    });
    expect(lines).toContain(ANTI_HARDCODE_LINE);
    const text = lines.join("\n");
    expect(text).not.toContain("ship.x");
    expect(text).not.toContain("777");
    expect(text).not.toContain("Seed");
  });

  it("failed Runs group labels by timing and hide the Star section", () => {
    const mid: PassCheck = {
      id: "hold",
      label: "Hold the reading mid-flight",
      statePath: "ship.energy",
      comparator: "lte",
      expected: 15,
      timing: "intermediate",
    };
    const states = [snap({ x: 0, energy: 20 }), snap({ x: 1, energy: 19 })];
    const result = gradeRun(
      baseInput({ checks: [REACH, mid], seeds: [{ seed: 101, isPractice: true, states, stop: "none" }] }),
    );
    const lines = buildFeedback(result, {
      par: { maxSteps: 7, maxEnergy: 7 },
      practiceStepsUsed: 1,
      practiceEnergySpent: 1,
      conceptName: "loop",
    });
    expect(lines.some((line) => line.includes("Reach the launch pad"))).toBe(true);
    expect(lines.some((line) => line.includes("first at step 0"))).toBe(true);
    expect(lines.some((line) => line.includes("Star"))).toBe(false);
  });

  it("passed Runs name missed Par numbers and the Planet concept", () => {
    const result = gradeRun(
      baseInput({
        code: "# YOUR CODE BELOW\nmove()\n# YOUR CODE ABOVE\n",
        seeds: [
          seedRun({ seed: 101, isPractice: true, steps: 9, energyStart: 20 }),
          seedRun({ seed: 102, steps: 3, energyStart: 20 }),
        ],
      }),
    );
    const lines = buildFeedback(result, {
      par: { maxSteps: 7, maxEnergy: 7 },
      practiceStepsUsed: 9,
      practiceEnergySpent: 9,
      conceptName: "loop",
    });
    expect(lines.some((line) => line.includes("Par 7"))).toBe(true);
    expect(lines.some((line) => line.includes("loop"))).toBe(true);
  });
});
