// Skill Radar and Daily Recall Drill suites (issue #61, ADR-0015).
// Acceptance: radar scoring and drill selection order match ADR-0015.

import { describe, expect, it } from "vitest";
import type { PlanetPack } from "./content";
import {
  emptyProgressV2,
  recordMissionPassV2,
  type ProgressV2,
} from "./progress";
import {
  drillLanguageV2,
  drillPoolV2,
  markDrillCompleteV2,
  parseDrillPickV2,
  planetScoreV2,
  resolveDrillPickV2,
  selectDailyDrillV2,
  skillRadarV2,
} from "./radar";

function mkPacks(): PlanetPack[] {
  const planet = (id: string, slug: string, missionSlugs: string[]) =>
    ({
      planet: { id, slug, name: slug, themeId: `${slug}-t`, planetConceptId: "variable", missionSlugs },
      missions: [],
      boss: {},
    }) as unknown as PlanetPack;
  return [
    planet("planet-1", "volta", ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"]),
    planet("planet-2", "cometa", ["p2-m1", "p2-m2", "p2-m3", "p2-m4", "p2-m5"]),
  ];
}

function pass(
  record: ProgressV2,
  slug: string,
  language: "python" | "java",
  stars: 0 | 1 | 2 | 3,
  at: string,
  extra?: Partial<{ runs: number; passes: number; hintsUsed: number; lastLanguage: "python" | "java" }>,
): ProgressV2 {
  let out = recordMissionPassV2(record, { slug, language, stars, code: `${slug}-${language}-${stars}`, at, date: at.slice(0, 10) });
  if (extra) {
    const m = out.missions[slug];
    out = {
      ...out,
      missions: {
        ...out.missions,
        [slug]: {
          ...m,
          runs: extra.runs ?? m.runs,
          passes: extra.passes ?? m.passes,
          hintsUsed: extra.hintsUsed ?? m.hintsUsed,
          lastLanguage: (extra.lastLanguage ?? m.lastLanguage) as "python" | "java" | null,
        },
      },
    };
  }
  return out;
}

describe("radar scoring (ADR-0015)", () => {
  it("Mission contributes best-Stars/3; Planet is mean x100 rounded", () => {
    let r = emptyProgressV2();
    // volta: stars [3,2,1,0,0] -> (1 + 2/3 + 1/3 + 0 + 0)/5*100 = 40
    r = pass(r, "p1-m1", "python", 3, "2026-11-10T10:00:00.000Z");
    r = pass(r, "p1-m2", "python", 2, "2026-11-10T10:00:00.000Z");
    r = pass(r, "p1-m3", "python", 1, "2026-11-10T10:00:00.000Z");
    expect(planetScoreV2(r, ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"])).toBe(40);
  });

  it("all axes always render; locked planets score 0 with the locked mark", () => {
    const packs = mkPacks();
    const axes = skillRadarV2(emptyProgressV2(), packs);
    expect(axes).toHaveLength(2);
    expect(axes[0]).toEqual({ planet: "volta", score: 0, locked: false });
    expect(axes[1]).toEqual({ planet: "cometa", score: 0, locked: true });
  });

  it("counts, hints and times never change the score", () => {
    const packs = mkPacks();
    const a = pass(emptyProgressV2(), "p1-m1", "python", 2, "2026-11-10T10:00:00.000Z");
    let b = pass(emptyProgressV2(), "p1-m1", "python", 2, "2026-10-01T10:00:00.000Z");
    b = { ...b, missions: { "p1-m1": { ...b.missions["p1-m1"], runs: 50, passes: 9, hintsUsed: 3 } } };
    expect(skillRadarV2(a, packs)[0].score).toBe(skillRadarV2(b, packs)[0].score);
  });
});

describe("drill pool (ADR-0015)", () => {
  it("pool holds Passed Missions from the day after the Pass", () => {
    const packs = mkPacks();
    const r = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    expect(drillPoolV2(r, "2026-11-10", packs)).toEqual([]);
    expect(drillPoolV2(r, "2026-11-11", packs)).toEqual(["p1-m1"]);
  });

  it("no Pass means no drill; all-passed-today means no drill", () => {
    const packs = mkPacks();
    expect(selectDailyDrillV2(emptyProgressV2(), "2026-11-11", packs)).toBeNull();
    const r = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-11T10:00:00.000Z");
    expect(selectDailyDrillV2(r, "2026-11-11", packs)).toBeNull();
    expect(selectDailyDrillV2(r, "2026-11-12", packs)).toBe("p1-m1");
  });

  it("a 3-Star Mission stays eligible", () => {
    const packs = mkPacks();
    const r = pass(emptyProgressV2(), "p1-m1", "python", 3, "2026-11-10T10:00:00.000Z");
    expect(drillPoolV2(r, "2026-11-12", packs)).toEqual(["p1-m1"]);
  });
});

describe("drill selection order (ADR-0015)", () => {
  it("lowest Planet score wins", () => {
    const packs = mkPacks();
    let r = emptyProgressV2();
    r = pass(r, "p1-m1", "python", 3, "2026-11-08T10:00:00.000Z");
    r = pass(r, "p2-m1", "python", 1, "2026-11-08T10:00:00.000Z");
    // volta score 20, cometa score ~7 -> cometa Mission first
    expect(selectDailyDrillV2(r, "2026-11-12", packs)).toBe("p2-m1");
  });

  it("fewest Mission Stars wins inside one Planet", () => {
    const packs = mkPacks().slice(0, 1);
    let r = emptyProgressV2();
    r = pass(r, "p1-m1", "python", 3, "2026-11-08T10:00:00.000Z");
    r = pass(r, "p1-m2", "python", 1, "2026-11-08T10:00:00.000Z");
    expect(selectDailyDrillV2(r, "2026-11-12", packs)).toBe("p1-m2");
  });

  it("longest since last Pass wins on equal Stars", () => {
    const packs = mkPacks().slice(0, 1);
    let r = emptyProgressV2();
    r = pass(r, "p1-m1", "python", 1, "2026-11-01T10:00:00.000Z");
    r = pass(r, "p1-m2", "python", 1, "2026-11-10T10:00:00.000Z");
    expect(selectDailyDrillV2(r, "2026-11-12", packs)).toBe("p1-m1");
  });

  it("most hints used wins, then lowest passes-to-runs ratio", () => {
    const packs = mkPacks().slice(0, 1);
    let r = emptyProgressV2();
    r = pass(r, "p1-m1", "python", 1, "2026-11-08T10:00:00.000Z", { hintsUsed: 0, runs: 2, passes: 2 });
    r = pass(r, "p1-m2", "python", 1, "2026-11-08T10:00:00.000Z", { hintsUsed: 2, runs: 2, passes: 2 });
    expect(selectDailyDrillV2(r, "2026-11-12", packs)).toBe("p1-m2");
    let s = emptyProgressV2();
    s = pass(s, "p1-m1", "python", 1, "2026-11-08T10:00:00.000Z", { runs: 4, passes: 1 });
    s = pass(s, "p1-m2", "python", 1, "2026-11-08T10:00:00.000Z", { runs: 1, passes: 1 });
    expect(selectDailyDrillV2(s, "2026-11-12", packs)).toBe("p1-m1");
  });

  it("daily tie-break is deterministic for the same day", () => {
    const packs = mkPacks().slice(0, 1);
    let r = emptyProgressV2();
    r = pass(r, "p1-m1", "python", 1, "2026-11-08T10:00:00.000Z");
    r = pass(r, "p1-m2", "python", 1, "2026-11-08T10:00:00.000Z");
    const first = selectDailyDrillV2(r, "2026-11-12", packs);
    expect(selectDailyDrillV2(r, "2026-11-12", packs)).toBe(first);
  });
});

describe("drill language and frozen pick", () => {
  it("weaker language first; tie goes to the language not used last", () => {
    let r = pass(emptyProgressV2(), "p1-m1", "python", 2, "2026-11-08T10:00:00.000Z");
    r = pass(r, "p1-m1", "java", 1, "2026-11-09T10:00:00.000Z", { lastLanguage: "java" });
    expect(drillLanguageV2(r, "p1-m1")).toBe("java");
    let tied = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-08T10:00:00.000Z");
    tied = pass(tied, "p1-m1", "java", 1, "2026-11-09T10:00:00.000Z", { lastLanguage: "python" });
    expect(drillLanguageV2(tied, "p1-m1")).toBe("java");
    expect(drillLanguageV2(emptyProgressV2(), "p9-m9")).toBeNull();
  });

  it("pick freezes for the day and completes on a Pass of the picked slug", () => {
    const packs = mkPacks().slice(0, 1);
    let r = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    const frozen = resolveDrillPickV2(null, "2026-11-11", r, packs);
    expect(frozen?.slug).toBe("p1-m1");
    // Runs and Passes during the day never shift the stored pick.
    r = pass(r, "p1-m2", "python", 1, "2026-11-11T10:00:00.000Z");
    expect(resolveDrillPickV2(frozen, "2026-11-11", r, packs)).toEqual(frozen);
    expect(markDrillCompleteV2(frozen, "2026-11-11", "p1-m1")).toEqual({ ...frozen!, completed: true });
    expect(markDrillCompleteV2(frozen, "2026-11-11", "p1-m2")).toEqual(frozen);
    expect(parseDrillPickV2("junk")).toBeNull();
  });
});
