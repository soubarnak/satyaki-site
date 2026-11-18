// Reusable Planet pack suite. A Planet ticket adds its data, its oracle
// row, and one registration line in tests/unit/content-pack.test.ts.
// No browser, worker, runner, or Ship simulation; nothing is graded.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Mission, PlanetPack, TrainingWheels } from "@/lib/content";
import {
  BOSS_PART_A_PASS_COUNT,
  BOSS_PART_A_TOTAL,
} from "@/lib/boss-gate";
import { validateBossGate, validateMission, validatePlanetPack } from "@/lib/content";
import {
  checkPack,
  checkJavaStage,
  JAVA_MARKERS,
  PYTHON_MARKERS,
  type PackOracle,
} from "./pack-oracle";
import { javaParses, pythonParses } from "./syntax";

const clone = <T>(value: T): T => structuredClone(value);

function mutated(pack: PlanetPack, edit: (pack: PlanetPack) => void): PlanetPack {
  const copy = clone(pack);
  edit(copy);
  return copy;
}

const repoRoot = join(__dirname, "..", "..");

function listFiles(dir: string): string[] {
  return readdirSync(join(repoRoot, dir)).sort();
}

export function describePack(pack: PlanetPack, oracle: PackOracle): void {
  const label = `${oracle.planet.name} pack`;

  describe(`${label}: accepted`, () => {
    it("passes every shipped validator", () => {
      expect(validatePlanetPack(pack)).toEqual([]);
      for (const mission of pack.missions) expect(validateMission(mission), mission.slug).toEqual([]);
      expect(validateBossGate(pack.boss)).toEqual([]);
    });

    it("matches the spec oracle", () => {
      expect(checkPack(pack, oracle)).toEqual([]);
    });

    it("has Planet identity, ordered Missions, stories and briefings", () => {
      expect(pack.planet.missionSlugs).toEqual(oracle.missions.map((m) => m.slug));
      expect(pack.missions.map((m) => m.slug)).toEqual(oracle.missions.map((m) => m.slug));
      expect(pack.missions.map((m) => m.position)).toEqual([1, 2, 3, 4, 5]);
      for (const mission of pack.missions) {
        expect(mission.story.length, mission.slug).toBeGreaterThan(0);
        expect(mission.story.length, mission.slug).toBeLessThanOrEqual(280);
        expect(mission.briefing.length, mission.slug).toBeGreaterThan(0);
      }
    });

    it("has no Training Wheels override and a Star 3 concept only on Missions", () => {
      for (const mission of pack.missions) {
        expect(mission.trainingWheels, mission.slug).toBeUndefined();
        expect(mission.star3Concept, mission.slug).toBe(oracle.planet.planetConceptId);
      }
      expect(pack.boss.partB.trainingWheels).toBeUndefined();
      for (const key of ["par", "tier", "star3Concept", "rosetta"]) {
        expect(key in pack.boss.partB, key).toBe(false);
      }
    });

    it("has Par from the formula and Seed pools from the spec", () => {
      for (const [i, row] of oracle.missions.entries()) {
        const mission = pack.missions[i];
        expect(mission.par).toEqual({
          maxSteps: Math.ceil(1.5 * row.refSteps) + 2,
          maxEnergy: Math.ceil(1.5 * row.refEnergy) + 2,
        });
        expect(mission.seedPool).toEqual(row.seedPool);
      }
      expect(pack.boss.partB.seedPool).toEqual(oracle.boss.partB.seedPool);
    });

    it("keeps starter markers once each and scaffold free of Ship calls", () => {
      const starters = [
        ...pack.missions.map((m) => [m.slug, m.pythonStarter, m.javaStarter] as const),
        [pack.boss.partB.slug, pack.boss.partB.pythonStarter, pack.boss.partB.javaStarter] as const,
      ];
      for (const [slug, py, java] of starters) {
        for (const marker of PYTHON_MARKERS) expect(py.split(marker).length - 1, slug).toBe(1);
        for (const marker of JAVA_MARKERS) expect(java.split(marker).length - 1, slug).toBe(1);
        const stageErrors: string[] = [];
        checkJavaStage(stageErrors, slug, java, oracle.planet.trainingWheels);
        expect(stageErrors, slug).toEqual([]);
      }
    });

    it("has a Part A quiz gated 4 of 5", () => {
      expect(pack.boss.partA).toHaveLength(5);
      expect(BOSS_PART_A_PASS_COUNT).toBe(4);
      expect(BOSS_PART_A_TOTAL).toBe(5);
    });
  });

  describe(`${label}: reference files`, () => {
    const expectedFiles = [
      ...oracle.missions.map((m) => m.slug),
      oracle.boss.partB.slug,
    ].flatMap((slug) => [`${slug}.py`, `${slug}.java`]);

    it("holds exactly one Python and one Java file per Mission and Part B", () => {
      expect(listFiles(oracle.referenceDir)).toEqual([...expectedFiles].sort());
    });

    it("parses every file, with no marker", () => {
      for (const file of expectedFiles) {
        const code = readFileSync(join(repoRoot, oracle.referenceDir, file), "utf8");
        expect(code, file).not.toContain("YOUR CODE");
        if (file.endsWith(".py")) {
          expect(pythonParses(code), file).toBe(true);
        } else {
          expect(javaParses(code), file).toBe(true);
          expect(code, file).toContain("public class Main");
        }
      }
    });

    it("is never imported by shipped Planet content", () => {
      for (const file of listFiles(oracle.contentDir)) {
        const source = readFileSync(join(repoRoot, oracle.contentDir, file), "utf8");
        expect(/from\s+["'][^"']*references/.test(source), file).toBe(false);
        expect(/import\(\s*["'][^"']*references/.test(source), file).toBe(false);
        expect(source.includes("readFileSync"), file).toBe(false);
      }
    });
  });

  describe(`${label}: Training Wheels stages`, () => {
    const wrapper = (body: string): string =>
      `public class Main {\n    // note\n    // YOUR CODE BELOW\n${body}\n    // YOUR CODE ABOVE\n}\n`;
    const mainOutside =
      "public class Main {\n    public static void main(String[] a) {\n    // YOUR CODE BELOW\n    // YOUR CODE ABOVE\n    }\n}\n";
    const mainInside = wrapper("    public static void main(String[] a) {\n    }");
    const bare = "// YOUR CODE BELOW\n// YOUR CODE ABOVE";
    const errorsFor = (code: string, stage: TrainingWheels): string[] => {
      const errors: string[] = [];
      checkJavaStage(errors, "x", code, stage);
      return errors;
    };

    it("full-scaffold needs class and main outside the markers", () => {
      expect(errorsFor(mainOutside, "full-scaffold")).toEqual([]);
      expect(errorsFor(wrapper(""), "full-scaffold")).toEqual([
        "x: full-scaffold java starter needs main outside the markers",
      ]);
      expect(errorsFor(mainInside, "full-scaffold")).toHaveLength(1);
      expect(errorsFor(bare, "full-scaffold")).toHaveLength(2);
    });

    it("partial wants the class, not main, outside the markers", () => {
      expect(errorsFor(wrapper(""), "partial")).toEqual([]);
      expect(errorsFor(mainInside, "partial")).toEqual([]);
      expect(errorsFor(mainOutside, "partial")).toEqual([
        "x: partial java starter has main outside the markers",
      ]);
      expect(errorsFor(bare, "partial")).toHaveLength(1);
    });

    it("minimal accepts a comment-only starter", () => {
      expect(errorsFor(bare, "minimal")).toEqual([]);
      expect(errorsFor("", "minimal")).toEqual([]);
    });
  });

  describe(`${label}: rejected`, () => {
    const rejects = (name: string, edit: (p: PlanetPack) => void, fragment: string): void => {
      it(`rejects ${name}`, () => {
        const errors = checkPack(mutated(pack, edit), oracle);
        expect(errors.some((e) => e.includes(fragment)), errors.join("\n")).toBe(true);
      });
    };
    const m = (p: PlanetPack, i = 1): Mission => p.missions[i];

    rejects("a reused slug", (p) => { m(p, 1).slug = m(p, 0).slug; }, "slug reuse");
    rejects("a missing marker", (p) => {
      m(p).pythonStarter = m(p).pythonStarter.replace("# YOUR CODE BELOW\n", "");
    }, "pythonStarter needs # YOUR CODE BELOW exactly once");
    rejects("a doubled marker", (p) => {
      m(p).javaStarter = m(p).javaStarter.replace("// YOUR CODE ABOVE", "// YOUR CODE ABOVE\n        // YOUR CODE ABOVE");
    }, "javaStarter needs // YOUR CODE ABOVE exactly once");
    rejects("an unparseable starter", (p) => {
      m(p).pythonStarter = m(p).pythonStarter.replace("# YOUR CODE BELOW", "# YOUR CODE BELOW\nmove(");
    }, "pythonStarter does not parse");
    rejects("a balanced but invalid starter", (p) => {
      m(p).pythonStarter = m(p).pythonStarter.replace("# YOUR CODE BELOW", "# YOUR CODE BELOW\nx = = 1");
    }, "python starter fails real parse");
    rejects("a scaffold that calls a Ship action", (p) => {
      m(p).javaStarter = m(p).javaStarter.replace("// YOUR CODE BELOW", "move();\n        // YOUR CODE BELOW");
    }, "scaffold calls Ship action");
    rejects("a changed ship heading", (p) => { m(p).layout.shipStart.heading = "south"; }, "shipStart disagrees");
    rejects("a changed check timing", (p) => { m(p).checks[0].timing = "intermediate"; }, "Pass checks disagree");
    rejects("a changed Star 3 concept", (p) => { m(p).star3Concept = "loop"; }, "star3Concept is not");
    rejects("a story over 280 characters", (p) => { m(p).story = "x".repeat(281); }, "story must be 1-280");
    rejects("a Seed count that disagrees with the tier", (p) => { m(p).seedPool.push(999); }, "seedPool needs exactly");
    rejects("a Par that disagrees with the formula", (p) => { m(p).par.maxSteps += 1; }, "Par disagrees");
    rejects("a Rosetta snippet over 12 lines", (p) => {
      m(p).rosetta.python = Array.from({ length: 13 }, () => "log(1)").join("\n");
    }, "exceeds 12 lines");
    rejects("an unknown concept", (p) => {
      (m(p) as unknown as { conceptId: string }).conceptId = "recursion";
    }, "unknown conceptId");
    rejects("an objective naming a missing check", (p) => {
      m(p).objectives[0].checkIds.push("no-such-check");
    }, "unknown check");
    rejects("an entity type outside the closed set", (p) => {
      (m(p).layout.entities[0] as unknown as { type: string }).type = "mine";
    }, "unknown type");
    rejects("a comparator outside the closed set", (p) => {
      (m(p).checks[0] as unknown as { comparator: string }).comparator = "lt";
    }, "bad comparator");
    rejects("a label with a coordinate", (p) => { m(p).checks[0].label = "Reach x 3"; }, "names a coordinate");
    rejects("a quiz item with fewer than 3 options", (p) => { p.boss.partA[0].options = ["a", "b"]; }, "needs 3-4 options");
    rejects("a quiz item with more than 4 options", (p) => {
      p.boss.partA[0].options = ["a", "b", "c", "d", "e"];
    }, "needs 3-4 options");
    rejects("a correct index outside the options", (p) => { p.boss.partA[0].correctIndex = 4; }, "bad correctIndex");
    for (const [key, value] of [
      ["par", { maxSteps: 1, maxEnergy: 1 }],
      ["tier", "core"],
      ["star3Concept", "variable"],
      ["rosetta", { python: "x = 1", java: "int x = 1;", note: "n" }],
    ] as const) {
      rejects(`a Part B carrying ${key}`, (p) => {
        (p.boss.partB as unknown as Record<string, unknown>)[key] = value;
      }, `Part B must not carry ${key}`);
    }
  });
}
