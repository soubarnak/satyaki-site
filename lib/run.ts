// Run orchestration (issue #65, spec §5 / ADR-0013).
// Glossary: Mission, Boss Gate, Pass, Star, Par, Seed, World State,
// Cadet. One Run press snapshots the exact editor code, grades it on
// every Seed via the language workers and the grader, returns only the
// practice trace for playback, and stores exactly one Run: a Pass stores
// the snapshot under the ADR-0010 replacement rule. Every worker error
// surfaces through lib/kid-errors, never raw.
//
// Main-thread orchestration: the default seed runner calls the lazy
// module workers (never created on import). Tests inject `runSeed`.

import type { PassCheck, PlanetConceptId } from "./content";
import { buildFeedback, gradeRun, type GraderResult, type SeedRun } from "./grader";
import { translateKidError, type KidLanguage } from "./kid-errors";
import {
  recordBossAttemptV2,
  recordMissionPassV2,
  recordMissionRunV2,
  type CadetLanguage,
  type ProgressV2,
} from "./progress";
import { generateSeedLayout, ShipSim, type AuthoredLayout, type Bounds, type ErrorFrame, type ShipDelta, type WorldSnapshot } from "./ship-sim";
import { MAX_CODE_CHARS } from "./python-worker-binding";
import { runPythonMission } from "./python-worker-client";
import { runJavaMission } from "./java-worker-client";

/** Mission (or Boss Part B) grading contract for one Run. */
export interface RunTarget {
  checks: PassCheck[];
  par: { maxSteps: number; maxEnergy: number };
  star3Concept: PlanetConceptId;
  /** First entry is the practice Seed the Cadet sees. */
  seedPool: number[];
  /** Authored layout; hidden Seeds derive from it. */
  layout: AuthoredLayout;
  /** Boss Part B reuses check/Seed rules and awards no Stars. */
  isBossPartB?: boolean;
}

/** One worker result per Seed (Python and Java share the shape). */
export interface SeedWorkerOutcome {
  trace: Array<{
    step: number;
    line: number;
    kind: "line";
    locals: Record<string, unknown>;
    shipDelta: ShipDelta | null;
    log?: string;
  }>;
  stdout: string;
  error?: ErrorFrame;
  stopReason: "none" | "error" | "step-cap" | "event-cap" | "time-cap";
  initial: {
    ship: { x: number; y: number; z: number; heading: string; energy: number; shield: boolean; crystals: number };
    entities: Record<string, Record<string, unknown>>;
  };
  bounds: Bounds;
}

/** Test seam: run one Seed layout in the active language. */
export type SeedRunner = (args: {
  code: string;
  layout: AuthoredLayout;
  seed: number;
  isPractice: boolean;
}) => Promise<SeedWorkerOutcome>;

export interface RunMissionInput {
  slug: string;
  language: CadetLanguage;
  /** Exact editor snapshot at Run press; never re-read. */
  code: string;
  target: RunTarget;
  progress: ProgressV2;
  /** Planet concept display name for missed-Star 3 feedback. */
  conceptName: string;
  /** Boss Part B mode: record a Boss attempt for this planet instead. */
  bossPlanet?: string;
  /** Local run day YYYY-MM-DD for the streak. */
  date?: string;
  /** ISO Pass/attempt time; defaults to now. */
  at?: string;
  /** Test seam; defaults to the lazy module workers. */
  runSeed?: SeedRunner;
}

export interface RunMissionResult {
  result: GraderResult;
  /** Grader feedback lines (checks grouped by timing, caps, Stars). */
  feedback: string[];
  /** Kid sentences for worker errors, practice first, deduplicated. */
  kidLines: string[];
  /** Practice Seed trace only; hidden Seed traces are discarded. */
  trace: SeedWorkerOutcome["trace"];
  /** Input progress plus exactly one stored Run (or Boss attempt). */
  progress: ProgressV2;
}

/** Boss Part B clear line: no Stars, Par, or concept apply. */
export const BOSS_CLEARED_LINE = "Boss challenge cleared, Cadet.";

function defaultSeedRunner(language: CadetLanguage): SeedRunner {
  return async ({ code, layout }) => {
    if (language === "python") return runPythonMission({ code, layout });
    return runJavaMission({ code, layout });
  };
}

/**
 * Fold one worker trace into grader states. The worker sim and this
 * replay start from the same Seed layout and run the same deterministic
 * Ship simulation, so replaying each trace Ship action in order rebuilds
 * the exact World State after every step; sensors and log lines carry no
 * delta and add no state. Starts with the step-0 World State.
 */
export function foldTraceToSeedRun(
  seedLayout: AuthoredLayout,
  outcome: SeedWorkerOutcome,
  seed: number,
  isPractice: boolean,
): SeedRun {
  const sim = new ShipSim(seedLayout);
  const states: WorldSnapshot[] = [sim.snapshot()];
  for (const event of outcome.trace) {
    if (event.shipDelta === null) continue;
    const replayed = sim.call(event.shipDelta.action, [], event.line);
    if (!replayed.ok) break;
    states.push(sim.snapshot());
  }
  return {
    seed,
    isPractice,
    states,
    stop: outcome.stopReason,
    executedLines: isPractice ? outcome.trace.map((event) => event.line) : undefined,
  };
}

function emptySeedRun(seed: number, isPractice: boolean): SeedRun {
  return { seed, isPractice, states: [], stop: "error" };
}

/** One Run press across every Seed. Never throws for learner failures. */
export async function runMission(input: RunMissionInput): Promise<RunMissionResult> {
  const codeSnapshot = input.code;
  const language: KidLanguage = input.language;
  const isBossPartB = input.target.isBossPartB === true;
  const seedPool = input.target.seedPool;
  const practiceSeed = seedPool[0];

  if (codeSnapshot.length > MAX_CODE_CHARS) {
    const seeds = seedPool.map((seed, index) => emptySeedRun(seed, index === 0));
    const result = gradeRun({
      checks: input.target.checks,
      par: input.target.par,
      star3Concept: input.target.star3Concept,
      language,
      code: codeSnapshot,
      seeds,
      isBossPartB,
    });
    return {
      result,
      feedback: buildFeedback(result, { par: input.target.par, practiceStepsUsed: 0, practiceEnergySpent: 0, conceptName: input.conceptName }),
      kidLines: [translateKidError({ line: 0, excType: "CodeTooLong" }, language)],
      trace: [],
      progress: recordMissionRunV2(input.progress, input.slug, input.language, input.date),
    };
  }

  const runSeed = input.runSeed ?? defaultSeedRunner(input.language);
  const outcomes: SeedWorkerOutcome[] = [];
  const seeds: SeedRun[] = [];
  for (let index = 0; index < seedPool.length; index += 1) {
    const seed = seedPool[index];
    const isPractice = index === 0;
    const { layout: seedLayout } = generateSeedLayout(input.target.layout, seed, practiceSeed);
    const outcome = await runSeed({ code: codeSnapshot, layout: seedLayout, seed, isPractice });
    outcomes.push(outcome);
    seeds.push(foldTraceToSeedRun(seedLayout, outcome, seed, isPractice));
  }

  const result = gradeRun({
    checks: input.target.checks,
    par: input.target.par,
    star3Concept: input.target.star3Concept,
    language,
    code: codeSnapshot,
    seeds,
    isBossPartB,
  });

  const practice = seeds.find((seed) => seed.isPractice) ?? seeds[0];
  let practiceStepsUsed = 0;
  let practiceEnergySpent = 0;
  if (practice !== undefined && practice.states.length > 0) {
    const first = practice.states[0];
    const last = practice.states[practice.states.length - 1];
    practiceStepsUsed = last.ship.stepsUsed;
    practiceEnergySpent = first.ship.energy - last.ship.energy;
  }

  const feedback =
    result.pass && isBossPartB
      ? [BOSS_CLEARED_LINE]
      : buildFeedback(result, { par: input.target.par, practiceStepsUsed, practiceEnergySpent, conceptName: input.conceptName });

  const kidLines: string[] = [];
  for (const outcome of outcomes) {
    if (outcome.error === undefined) continue;
    const line = translateKidError(outcome.error, language);
    if (!kidLines.includes(line)) kidLines.push(line);
  }

  const practiceTrace = outcomes.length > 0 ? outcomes[0].trace : [];

  const progress =
    input.bossPlanet !== undefined
      ? recordBossAttemptV2(input.progress, input.bossPlanet, result.pass, input.at)
      : result.pass
        ? recordMissionPassV2(input.progress, {
            slug: input.slug,
            language: input.language,
            stars: result.stars,
            code: codeSnapshot,
            at: input.at,
            date: input.date,
          })
        : recordMissionRunV2(input.progress, input.slug, input.language, input.date);

  return { result, feedback, kidLines, trace: practiceTrace, progress };
}
