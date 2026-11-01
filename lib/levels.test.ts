import { describe, expect, it } from "vitest";
import { CONCEPT_ORDER, LEVELS, getLevel, validateLevels, type Level } from "./levels";

function withPoints(points: number): Level[] {
  return LEVELS.map((level, index) => (index === 0 ? { ...level, points } : level));
}

describe("shipped level data (content pack transcription)", () => {
  it("passes validation", () => {
    expect(validateLevels(LEVELS)).toEqual([]);
  });

  it("ships 10 levels with ids 1 to 10 in order", () => {
    expect(LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("names concepts in FR-004 order, one new concept per level", () => {
    expect(LEVELS.map((level) => level.concept)).toEqual([...CONCEPT_ORDER]);
    expect([...CONCEPT_ORDER]).toEqual([
      "print",
      "variables",
      "branch",
      "loop",
      "method",
      "class",
      "array",
      "combined loops",
      "debug repair",
      "combined quest",
    ]);
  });

  it("awards 100 points for levels 1-9 and 200 for level 10", () => {
    expect(LEVELS.map((level) => level.points)).toEqual([
      100, 100, 100, 100, 100, 100, 100, 100, 100, 200,
    ]);
  });

  it("places badges First Print, Loop Master, Bug Hunter at levels 1, 8, 9", () => {
    expect(getLevel(1)?.badge).toBe("First Print");
    expect(getLevel(8)?.badge).toBe("Loop Master");
    expect(getLevel(9)?.badge).toBe("Bug Hunter");
    expect(LEVELS.filter((level) => level.badge).map((level) => level.id)).toEqual([1, 8, 9]);
  });

  it("transcribes exact expected outputs", () => {
    expect(getLevel(1)?.expectedOutput).toBe("Bolt is awake!");
    expect(getLevel(4)?.expectedOutput).toBe("1\n2\n3");
    expect(getLevel(10)?.expectedOutput).toBe("Rescue\nRescue\nRescue\nStation awake!");
  });

  it("transcribes concept tokens, with level 8 needing the token twice and level 10 two tokens", () => {
    expect(getLevel(1)?.conceptTokens).toEqual([{ text: "System.out.println(", minCount: 1 }]);
    expect(getLevel(8)?.conceptTokens).toEqual([{ text: "for (", minCount: 2 }]);
    expect(getLevel(10)?.conceptTokens).toEqual([
      { text: "for (", minCount: 1 },
      { text: "static void report(", minCount: 1 },
    ]);
  });

  it("gives every level starter code with public class Main and main", () => {
    for (const level of LEVELS) {
      expect(level.starterCode).toContain("public class Main {");
      expect(level.starterCode).toContain("public static void main(String[] args) {");
      expect(level.story.length).toBeGreaterThan(0);
      expect(level.objective.length).toBeGreaterThan(0);
      expect(level.hint.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for an unknown level id", () => {
    expect(getLevel(11)).toBeUndefined();
    expect(getLevel(0)).toBeUndefined();
  });
});

describe("validateLevels (DR-002 point bounds, ADR-0007 seams)", () => {
  it.each([9, 501])("rejects points %i", (points) => {
    const errors = validateLevels(withPoints(points));
    expect(errors.join(" ")).toMatch(/points/);
  });

  it.each([10, 500])("accepts points %i", (points) => {
    expect(validateLevels(withPoints(points))).toEqual([]);
  });

  it("rejects non-integer points", () => {
    expect(validateLevels(withPoints(100.5)).join(" ")).toMatch(/points/);
  });
});

describe("validateLevels (FR-004 concept order)", () => {
  it("rejects swapped concept order", () => {
    const swapped = LEVELS.map((level, index) =>
      index === 0
        ? { ...level, concept: LEVELS[1].concept }
        : index === 1
          ? { ...level, concept: LEVELS[0].concept }
          : level,
    );
    expect(validateLevels(swapped).join(" ")).toMatch(/concept/);
  });

  it("rejects a repeated concept (no new concept in that level)", () => {
    const repeated = LEVELS.map((level, index) =>
      index === 1 ? { ...level, concept: LEVELS[0].concept } : level,
    );
    expect(validateLevels(repeated).join(" ")).toMatch(/concept/);
  });

  it("rejects a level with no concept token", () => {
    const tokenless = LEVELS.map((level, index) =>
      index === 0 ? { ...level, conceptTokens: [] } : level,
    );
    expect(validateLevels(tokenless).join(" ")).toMatch(/concept token/);
  });
});
