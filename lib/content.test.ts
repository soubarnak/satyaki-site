// Content schema build tests (issue #60, ADR-0011 §consequences).
// Seams: validateMission, validateBossGate, validatePlanetPack,
// validateReferenceCoverage. Expected values come from the Planet 1
// content spec via tests/fixtures/sample-planet.ts, not from the code.

import { describe, expect, it } from "vitest";
import {
  validateBossGate,
  validateMission,
  validatePlanetPack,
  validateReferenceCoverage,
} from "./content";
import {
  sampleBoss,
  sampleMissions,
  samplePlanet,
  sampleSolutions,
} from "../tests/fixtures/sample-planet";

describe("sample Planet fixture validates end to end", () => {
  it("accepts every sample Mission", () => {
    for (const mission of sampleMissions) {
      expect(validateMission(mission), mission.slug).toEqual([]);
    }
  });

  it("accepts the sample Boss Gate", () => {
    expect(validateBossGate(sampleBoss)).toEqual([]);
  });

  it("accepts the full Planet pack with no slug reuse", () => {
    expect(
      validatePlanetPack({
        planet: samplePlanet,
        missions: sampleMissions,
        boss: sampleBoss,
      }),
    ).toEqual([]);
  });

  it("covers every Mission and Boss Part B with a reference solution", () => {
    expect(
      validateReferenceCoverage(sampleMissions, sampleBoss, sampleSolutions),
    ).toEqual([]);
  });
});

describe("malformed content fails the build tests", () => {
  it("rejects slug reuse across the pack", () => {
    const dupe = { ...sampleMissions[1], slug: "p1-m1" };
    const errors = validatePlanetPack({
      planet: samplePlanet,
      missions: [sampleMissions[0], dupe],
      boss: sampleBoss,
    });
    expect(errors.some((e) => e.includes("p1-m1"))).toBe(true);
  });

  it("rejects a Python starter with missing markers", () => {
    const errors = validateMission({
      ...sampleMissions[0],
      pythonStarter: "# no markers here\nmove()\n",
    });
    expect(errors.some((e) => e.includes("YOUR CODE BELOW"))).toBe(true);
  });

  it("rejects a Java starter with missing markers", () => {
    const errors = validateMission({
      ...sampleMissions[0],
      javaStarter: "public class Main {}",
    });
    expect(errors.some((e) => e.includes("YOUR CODE ABOVE"))).toBe(true);
  });

  it("rejects an unparseable starter", () => {
    const errors = validateMission({
      ...sampleMissions[0],
      pythonStarter:
        "# Wake the Ship.\n# YOUR CODE BELOW\nmove(((\n# YOUR CODE ABOVE\n",
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an unparseable Rosetta snippet", () => {
    const errors = validateMission({
      ...sampleMissions[0],
      rosetta: { ...sampleMissions[0].rosetta, python: "power = (((" },
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects an objective mapped to no check", () => {
    const errors = validateMission({
      ...sampleMissions[0],
      objectives: [{ text: "Reach the launch pad.", checkIds: ["no-such-check"] }],
    });
    expect(errors.some((e) => e.includes("no-such-check"))).toBe(true);
  });

  it("rejects a reference registry missing a Mission", () => {
    const rest = { ...sampleSolutions };
    delete rest["p1-m5"];
    const errors = validateReferenceCoverage(sampleMissions, sampleBoss, rest);
    expect(errors.some((e) => e.includes("p1-m5"))).toBe(true);
  });
});
