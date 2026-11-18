// Boss Gate flow pure core (issue #70, spec §§5,8, ADR-0010/0011).
// Glossary: Boss Gate, Pass, Seed, World State, Cadet. Part A is five
// authored quiz items with a 4/5 gate and one-line explanations;
// retakes are unlimited with no cooldown because grading is stateless:
// each call stands alone and stores nothing. Part B is one coding
// challenge reusing the Mission run/grader rules with 3 Seeds and no
// Stars. Progress flags (passed, attempts, last attempt) live in
// lib/progress recordBossAttemptV2; unlocks derive in
// lib/progress isPlanetOpenV2 and merge in mergeProgressV2.
// Pure core: no framework, DOM, or worker imports.

import type { BossGate, PlanetConceptId } from "./content";
import type { RunTarget } from "./run";

/** Part A gate: 4 of 5 items pass (spec §5, ADR-0011). */
export const BOSS_PART_A_PASS_COUNT = 4;
/** Part A always holds exactly 5 authored items. */
export const BOSS_PART_A_TOTAL = 5;

export interface BossPartAItemResult {
  /** 0-based authored item index. */
  index: number;
  /** Chosen option, or null when unanswered or out of range. */
  picked: number | null;
  correct: boolean;
  /** Authored one-line explanation, always returned. */
  explanation: string;
}

export interface BossPartAResult {
  correct: number;
  total: number;
  passed: boolean;
  /** In authored order, one row per quiz item. */
  items: BossPartAItemResult[];
}

/**
 * Grade one Part A attempt. Stateless: no attempt is stored and no
 * cooldown applies, so retakes are unlimited by construction.
 */
export function gradeBossPartA(
  boss: BossGate,
  answers: readonly number[],
): BossPartAResult {
  const items = boss.partA.map((item, index) => {
    const picked = answers[index];
    const valid =
      typeof picked === "number" &&
      Number.isInteger(picked) &&
      picked >= 0 &&
      picked < item.options.length;
    return {
      index,
      picked: valid ? (picked as number) : null,
      correct: valid && picked === item.correctIndex,
      explanation: item.explanation,
    };
  });
  const correct = items.filter((item) => item.correct).length;
  return {
    correct,
    total: items.length,
    passed: correct >= BOSS_PART_A_PASS_COUNT,
    items,
  };
}

/** Part B unlocks only after Part A passes (spec §8). */
export function isBossPartBUnlocked(partAPassed: boolean): boolean {
  return partAPassed === true;
}

/**
 * Run target for Boss Part B: the same check/Seed/cap/feedback rules as
 * a Mission Run, graded with no Stars. Par and concept never apply in
 * Boss mode (gradeRun ignores them there); the stored Part B carries
 * neither, so the caller supplies the Planet concept only as filler.
 */
export function bossPartBTarget(
  boss: BossGate,
  planetConceptId: PlanetConceptId,
): RunTarget {
  return {
    checks: boss.partB.checks,
    par: { maxSteps: 500, maxEnergy: 500 },
    star3Concept: planetConceptId,
    seedPool: boss.partB.seedPool,
    layout: boss.partB.layout,
    isBossPartB: true,
  };
}
