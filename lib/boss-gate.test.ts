// Boss Gate flow pure tests (issue #70, spec §§5,8, ADR-0010/0011).
// Part A: five authored items, 4/5 gate, explanations, unlimited retries
// (stateless: each grading call stands alone, no cooldown state).
// Part B: target reuses Mission run/grader rules with 3 Seeds, no Stars.

import { describe, expect, it } from "vitest";
import {
  BOSS_PART_A_PASS_COUNT,
  BOSS_PART_A_TOTAL,
  bossPartBTarget,
  gradeBossPartA,
  isBossPartBUnlocked,
} from "./boss-gate";
import { sampleBoss } from "../tests/fixtures/sample-planet";
import { PLANET_PACKS } from "./planet-packs";
import {
  emptyProgressV2,
  isPlanetOpenV2,
  mergeProgressV2,
  recordBossAttemptV2,
  recordMissionPassV2,
} from "./progress";
import { orbitView } from "./orbit";

describe("Part A grading: 4/5 gate over five authored items", () => {
  it("5/5 passes", () => {
    const out = gradeBossPartA(sampleBoss, [0, 0, 0, 1, 1]);
    expect(out.total).toBe(5);
    expect(out.correct).toBe(5);
    expect(out.passed).toBe(true);
    expect(out.items.every((item) => item.correct)).toBe(true);
  });

  it("exactly 4/5 passes (one wrong)", () => {
    const out = gradeBossPartA(sampleBoss, [1, 0, 0, 1, 1]);
    expect(out.correct).toBe(4);
    expect(out.passed).toBe(true);
    expect(out.items[0].correct).toBe(false);
  });

  it("3/5 fails the gate", () => {
    const out = gradeBossPartA(sampleBoss, [1, 1, 0, 1, 1]);
    expect(out.correct).toBe(3);
    expect(out.passed).toBe(false);
  });

  it("missing answers count wrong, never throw", () => {
    const out = gradeBossPartA(sampleBoss, [0, 0]);
    expect(out.total).toBe(5);
    expect(out.correct).toBe(2);
    expect(out.passed).toBe(false);
    expect(out.items[4].picked).toBeNull();
  });

  it("out-of-range picks count wrong, never throw", () => {
    const out = gradeBossPartA(sampleBoss, [0, 0, 0, 1, 99]);
    expect(out.correct).toBe(4);
    expect(out.passed).toBe(true);
    expect(out.items[4].correct).toBe(false);
  });

  it("every item carries its authored explanation", () => {
    const out = gradeBossPartA(sampleBoss, [0, 0, 0, 1, 1]);
    expect(out.items.map((item) => item.explanation)).toEqual(
      sampleBoss.partA.map((item) => item.explanation),
    );
  });

  it("retakes are stateless: same input grades the same, no cooldown", () => {
    const first = gradeBossPartA(sampleBoss, [1, 1, 1, 1, 1]);
    const second = gradeBossPartA(sampleBoss, [0, 0, 0, 1, 1]);
    expect(first.passed).toBe(false);
    expect(second.passed).toBe(true);
  });
});

describe("Part B gate and target", () => {
  it("Part B unlocks only after Part A passes", () => {
    expect(isBossPartBUnlocked(false)).toBe(false);
    expect(isBossPartBUnlocked(true)).toBe(true);
  });

  it("Part B target reuses Part B checks with 3 Seeds and Boss mode", () => {
    const target = bossPartBTarget(sampleBoss, "variable");
    expect(target.isBossPartB).toBe(true);
    expect(target.seedPool).toHaveLength(3);
    expect(target.seedPool).toEqual(sampleBoss.partB.seedPool);
    expect(target.checks).toEqual(sampleBoss.partB.checks);
    expect(target.layout).toEqual(sampleBoss.partB.layout);
  });

  it("pass threshold constants match the spec gate", () => {
    expect(BOSS_PART_A_TOTAL).toBe(5);
    expect(BOSS_PART_A_PASS_COUNT).toBe(4);
  });
});

describe("acceptance: Boss href, next-Planet unlock, merge survival", () => {
  it("Boss href names the Boss Gate; a clear opens the next Planet and survives merge", () => {
    const packs = PLANET_PACKS;
    const locked = orbitView(emptyProgressV2(), packs, "2026-11-10");
    expect(locked.planets[0].boss.href).toBeNull();

    let passed = emptyProgressV2();
    for (const slug of ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"]) {
      passed = recordMissionPassV2(passed, { slug, language: "python", stars: 1 });
    }
    expect(orbitView(passed, packs, "2026-11-11").planets[0].boss.href).toBe(
      "/missions/volta-gate",
    );
    expect(isPlanetOpenV2(passed, packs, "cometa")).toBe(false);

    const cleared = recordBossAttemptV2(passed, "volta", true);
    expect(isPlanetOpenV2(cleared, packs, "cometa")).toBe(true);

    const merged = mergeProgressV2(cleared, emptyProgressV2());
    expect(merged.bosses["volta"].passed).toBe(true);
    expect(isPlanetOpenV2(merged, packs, "cometa")).toBe(true);
  });
});
