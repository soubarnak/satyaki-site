// Run orchestration tests (issue #65, spec §5 / ADR-0013).
// Seam: runMission with an injected runSeed (no workers in tests).
// One Run press grades the exact snapshot on every Seed, returns only
// the practice trace, and stores exactly one Run; a Pass stores the
// snapshot under the ADR-0010 replacement rule. Glossary: Mission,
// Pass, Star, Par, Seed, World State.
import { describe, expect, it } from "vitest";
import { emptyProgressV2 } from "./progress";
import { ShipSim, type AuthoredLayout, type ShipDelta } from "./ship-sim";
import { runMission, type RunTarget, type SeedRunner } from "./run";

const LAYOUT: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 20 },
  bounds: { maxX: 4, maxY: 1, maxZ: 2 },
  entities: [{ id: "crystal-1", type: "crystal", x: 2, y: 0, z: 0 }],
};

function target(checks: RunTarget["checks"]): RunTarget {
  return {
    checks,
    par: { maxSteps: 5, maxEnergy: 5 },
    star3Concept: "variable",
    seedPool: [101, 202],
    layout: LAYOUT,
  };
}

const REACH = { id: "reach", label: "Reach x=1", statePath: "ship.x", comparator: "eq" as const, expected: 1, timing: "final" as const };

const CODE = ["# head", "# YOUR CODE BELOW", "x = 1", "move()", "# YOUR CODE ABOVE"].join("\n");

function lineEvent(line: number, shipDelta: ShipDelta | null, step: number) {
  return { step, line, kind: "line" as const, locals: {}, shipDelta };
}

/** Practice trace: one no-op line plus one real Ship move delta. */
function practiceTrace(): ReturnType<typeof lineEvent>[] {
  const sim = new ShipSim(LAYOUT);
  const called = sim.call("move", [], 4);
  if (!called.ok || called.delta === undefined) throw new Error("fixture sim move failed");
  return [lineEvent(3, null, 0), lineEvent(4, called.delta, 1)];
}

function okRunner(seen: { code: string[]; seeds: number[] }): SeedRunner {
  return async ({ code, layout, seed }) => {
    seen.code.push(code);
    seen.seeds.push(seed);
    const sim = new ShipSim(layout);
    const snapshot = sim.snapshot();
    return {
      trace: practiceTrace(),
      stdout: "",
      stopReason: "none",
      initial: {
        ship: { ...snapshot.ship },
        entities: JSON.parse(JSON.stringify(snapshot.entities)),
      },
      bounds: { ...snapshot.bounds },
    };
  };
}

describe("one Run grades every Seed from the exact snapshot", () => {
  it("runs each Seed once with the snapshot and returns only the practice trace", async () => {
    const seen = { code: [] as string[], seeds: [] as number[] };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: CODE,
      target: target([REACH]),
      progress: emptyProgressV2(),
      conceptName: "Variable",
      runSeed: okRunner(seen),
    });
    expect(seen.seeds).toEqual([101, 202]);
    expect(new Set(seen.code).size).toBe(1);
    expect(seen.code[0]).toBe(CODE);
    expect(out.result.pass).toBe(true);
    expect(out.trace.map((event) => event.line)).toEqual([3, 4]);
  });

  it("a Pass stores exactly one Run with the snapshot under the replacement rule", async () => {
    const seen = { code: [] as string[], seeds: [] as number[] };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: CODE,
      target: target([REACH]),
      progress: emptyProgressV2(),
      conceptName: "Variable",
      runSeed: okRunner(seen),
    });
    expect(out.result.stars).toBe(3);
    const mission = out.progress.missions["p1-m1"];
    expect(mission.runs).toBe(1);
    expect(mission.passes).toBe(1);
    expect(mission.python.passingCode).toBe(CODE);
    expect(mission.python.bestStars).toBe(3);
  });

  it("names the Planet concept in missed-Star feedback", async () => {
    const seen = { code: [] as string[], seeds: [] as number[] };
    const noConcept: SeedRunner = async (args) => {
      const base = await okRunner(seen)(args);
      return { ...base, trace: [] };
    };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: CODE,
      target: target([{ ...REACH, statePath: "ship.energy", comparator: "gte", expected: 0 }]),
      progress: emptyProgressV2(),
      conceptName: "Loop",
      runSeed: noConcept,
    });
    expect(out.result.pass).toBe(true);
    expect(out.feedback.some((line) => line.includes("Loop"))).toBe(true);
  });

  it("a failed Run stores exactly one Run and no Pass", async () => {
    const seen = { code: [] as string[], seeds: [] as number[] };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: CODE,
      target: target([{ ...REACH, expected: 99 }]),
      progress: emptyProgressV2(),
      conceptName: "Variable",
      runSeed: okRunner(seen),
    });
    expect(out.result.pass).toBe(false);
    expect(out.result.stars).toBe(0);
    const mission = out.progress.missions["p1-m1"];
    expect(mission.runs).toBe(1);
    expect(mission.passes).toBe(0);
    expect(mission.python.passingCode).toBeNull();
  });

  it("hidden-Seed failure keeps practice feedback layout-free and still counts the Run", async () => {
    const seen = { code: [] as string[], seeds: [] as number[] };
    const hiddenFail: SeedRunner = async (args) => {
      const base = await okRunner(seen)(args);
      if (args.seed !== 101) {
        return { ...base, trace: [{ ...lineEvent(4, null, 0), shipDelta: null }] };
      }
      return base;
    };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: CODE,
      target: target([REACH]),
      progress: emptyProgressV2(),
      conceptName: "Variable",
      runSeed: hiddenFail,
    });
    expect(out.result.pass).toBe(false);
    expect(out.feedback.some((line) => line.includes("every layout"))).toBe(true);
    expect(out.progress.missions["p1-m1"].runs).toBe(1);
  });
});

describe("worker errors surface as kid sentences", () => {
  it("practice error names the line, hides raw text, and counts the Run", async () => {
    const errorRunner: SeedRunner = async ({ layout, seed }) => {
      const sim = new ShipSim(layout);
      const snapshot = sim.snapshot();
      return {
        trace: [],
        stdout: "",
        error: { kind: "error", line: 4, excType: "NameError", message: "Traceback kaboom name 'fly' is not defined" },
        stopReason: "error",
        initial: { ship: { ...snapshot.ship }, entities: {} },
        bounds: { ...snapshot.bounds },
      };
    };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: CODE,
      target: target([REACH]),
      progress: emptyProgressV2(),
      conceptName: "Variable",
      runSeed: errorRunner,
    });
    expect(out.result.pass).toBe(false);
    expect(out.kidLines.length).toBeGreaterThan(0);
    expect(out.kidLines[0]).toContain("Line 4");
    expect(out.kidLines.join("\n")).not.toContain("kaboom");
    expect(out.progress.missions["p1-m1"].runs).toBe(1);
  });

  it("over-long code never reaches the runner and still counts the Run", async () => {
    let calls = 0;
    const counting: SeedRunner = async (args) => {
      calls += 1;
      return okRunner({ code: [], seeds: [] })(args);
    };
    const out = await runMission({
      slug: "p1-m1",
      language: "python",
      code: "x".repeat(32_769),
      target: target([REACH]),
      progress: emptyProgressV2(),
      conceptName: "Variable",
      runSeed: counting,
    });
    expect(calls).toBe(0);
    expect(out.result.pass).toBe(false);
    expect(out.kidLines.join("\n")).toContain("32,768");
    expect(out.progress.missions["p1-m1"].runs).toBe(1);
  });
});

describe("Boss Part B records attempts, never Mission Stars", () => {
  it("a Part B clear records the Boss attempt with the cleared line", async () => {
    const seen = { code: [] as string[], seeds: [] as number[] };
    const out = await runMission({
      slug: "p1-boss-b",
      language: "java",
      code: CODE,
      target: { ...target([REACH]), isBossPartB: true },
      progress: emptyProgressV2(),
      conceptName: "Variable",
      bossPlanet: "volta",
      runSeed: okRunner(seen),
    });
    expect(out.result.pass).toBe(true);
    expect(out.result.stars).toBe(0);
    expect(out.feedback).toEqual(["Boss challenge cleared, Cadet."]);
    expect(out.progress.bosses["volta"].attempts).toBe(1);
    expect(out.progress.bosses["volta"].passed).toBe(true);
    expect(out.progress.missions["p1-boss-b"]).toBeUndefined();
  });
});
