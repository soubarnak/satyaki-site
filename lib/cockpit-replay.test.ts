// Cockpit replay acceptance (issue #69): a passing program in each
// language replays the practice trace with line highlight sync including
// loop re-hits, and step-back re-folds correctly. Glossary: Mission,
// Pass, Seed, World State, Cadet. Uses runMission with a deterministic
// Ship-backed SeedRunner (no workers), then the pure playback folds.
import { describe, expect, it } from "vitest";
import { emptyProgressV2 } from "./progress";
import { PLANET_PACKS } from "./planet-packs";
import { generateSeedLayout, ShipSim } from "./ship-sim";
import { runMission, type RunTarget, type SeedRunner } from "./run";
import {
  playbackWorldAt,
  replayWorldFromLayout,
  shipStepIndices,
  type PlaybackEvent,
  type PlaybackHeader,
} from "./cockpit-playback";
import { doneLinesFor } from "../components/mission-editor";

function mission() {
  for (const pack of PLANET_PACKS) {
    const found = pack.missions.find((m) => m.slug === "p1-m1");
    if (found) return found;
  }
  throw new Error("p1-m1 missing");
}

/** Passing trace with a loop re-hit: line 2 executes twice. */
function passingTrace(): PlaybackEvent[] {
  const target = mission();
  const practice = target.seedPool[0];
  const { layout } = generateSeedLayout(target.layout, practice, practice);
  const sim = new ShipSim(layout);
  const lines: Array<{ line: number; log?: string }> = [
    { line: 3 },
    { line: 2 },
    { line: 4 },
    { line: 2 },
    { line: 5 },
    { line: 6, log: "done" },
  ];
  const trace: PlaybackEvent[] = [];
  let step = 0;
  for (const { line, log } of lines) {
    if (log !== undefined || line === 2) {
      trace.push({ step, line, kind: "line", locals: { trips: 1 }, shipDelta: null, log });
      continue;
    }
    const called = sim.call("move", [], line);
    if (!called.ok || called.delta === undefined) throw new Error("fixture move failed");
    step += 1;
    trace.push({
      step,
      line,
      kind: "line",
      locals: { trips: 1 },
      shipDelta: {
        action: called.delta.action,
        blocked: called.delta.blocked,
        ship: { ...called.delta.ship },
        changed: [...called.delta.changed],
      },
    });
  }
  return trace;
}

function runner(trace: PlaybackEvent[]): SeedRunner {
  return async ({ layout }) => {
    const sim = new ShipSim(layout);
    const snapshot = sim.snapshot();
    return {
      trace: trace.map((event) => ({ ...event })),
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

const PYTHON_CODE = ["# p1-m1", "# YOUR CODE BELOW", "move()", "move()", "move()", "# YOUR CODE ABOVE"].join("\n");
const JAVA_CODE = [
  "public class Main {",
  "    public static void main(String[] args) {",
  "        // YOUR CODE BELOW",
  "        ship.move();",
  "        ship.move();",
  "        ship.move();",
  "        // YOUR CODE ABOVE",
  "    }",
  "}",
].join("\n");

describe.each([
  ["python", PYTHON_CODE],
  ["java", JAVA_CODE],
] as const)("passing %s program replays", (language, code) => {
  it("passes, replays with highlight incl loop re-hits, step-back re-folds", async () => {
    const targetMission = mission();
    const practice = targetMission.seedPool[0];
    const { layout } = generateSeedLayout(targetMission.layout, practice, practice);
    const target: RunTarget = {
      checks: targetMission.checks,
      par: targetMission.par,
      star3Concept: targetMission.star3Concept,
      seedPool: targetMission.seedPool,
      layout: targetMission.layout,
    };
    const trace = passingTrace();
    const out = await runMission({
      slug: targetMission.slug,
      language,
      code,
      target,
      progress: emptyProgressV2(),
      conceptName: targetMission.planetConceptId,
      runSeed: runner(trace),
    });
    expect(out.result.pass).toBe(true);
    expect(out.trace.length).toBe(6);

    // Gold ticks mark Ship steps only.
    expect(shipStepIndices(out.trace)).toEqual([0, 2, 4]);

    // Highlight sync: the loop line re-hit is lit at its second visit.
    expect(out.trace[3].line).toBe(2);
    expect(doneLinesFor(out.trace, 3)).toContain(2);

    // Step-back is pure re-fold: walk back from the final frame.
    const header: PlaybackHeader = {
      initial: {
        ship: { x: 0, y: 0, z: 0, heading: "east", energy: 20, shield: false, crystals: 0 },
        entities: {},
      },
      bounds: { ...layout.bounds },
    };
    expect(playbackWorldAt(header, out.trace, -1).ship.x).toBe(0);
    expect(replayWorldFromLayout(layout, out.trace, 4).ship.x).toBe(3);
    expect(replayWorldFromLayout(layout, out.trace, 3).ship.x).toBe(2);
    expect(replayWorldFromLayout(layout, out.trace, 2).ship.x).toBe(2);
    expect(replayWorldFromLayout(layout, out.trace, 0).ship.x).toBe(1);
    expect(replayWorldFromLayout(layout, out.trace, -1).ship.x).toBe(layout.shipStart.x);
  });
});
