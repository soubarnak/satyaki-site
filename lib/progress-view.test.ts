import { describe, expect, test } from "vitest";
import { LEVELS } from "./levels";
import { parseProgress, serializeProgress } from "./progress";
import { PROGRESS_STORAGE_WARNING, TOTAL_LEVELS, progressSummary } from "./progress-view";

// Parent progress seams (WF-005, FR-012): the summary derives from
// seeded records, and an empty record means zeros with no progress.

const TODAY = "2026-11-01";

describe("progressSummary from seeded progress records (FR-012)", () => {
  test("empty record: zeros, no badges, no dates, no progress", () => {
    const summary = progressSummary(parseProgress(null), TODAY);
    expect(summary.passedCount).toBe(0);
    expect(summary.totalLevels).toBe(10);
    expect(summary.totalLevels).toBe(LEVELS.length);
    expect(summary.totalPoints).toBe(0);
    expect(summary.badges).toEqual([]);
    expect(summary.streakDates).toEqual([]);
    expect(summary.streak).toBe(0);
    expect(summary.hasProgress).toBe(false);
  });

  test("4 levels passed: 4 of 10, 400 points, badge, and dates (AC-1)", () => {
    const raw = serializeProgress({
      passedLevelIds: [1, 2, 3, 4],
      badges: ["First Print"],
      streakDates: ["2026-10-31", TODAY],
    });
    const summary = progressSummary(parseProgress(raw), TODAY);
    expect(summary.passedCount).toBe(4);
    expect(summary.totalLevels).toBe(10);
    expect(summary.totalPoints).toBe(400);
    expect(summary.badges).toEqual(["First Print"]);
    expect(summary.streakDates).toEqual(["2026-10-31", TODAY]);
    expect(summary.streak).toBe(2);
    expect(summary.hasProgress).toBe(true);
  });

  test("full record: every level passed and 1100 points derived", () => {
    const raw = serializeProgress({
      passedLevelIds: LEVELS.map((level) => level.id),
      badges: ["First Print", "Loop Master", "Bug Hunter"],
      streakDates: [TODAY],
    });
    const summary = progressSummary(parseProgress(raw), TODAY);
    expect(summary.passedCount).toBe(10);
    expect(summary.totalPoints).toBe(1100);
    expect(summary.badges).toEqual(["First Print", "Loop Master", "Bug Hunter"]);
    expect(summary.hasProgress).toBe(true);
  });

  test("unknown badge names never reach the summary", () => {
    const raw = serializeProgress({
      passedLevelIds: [1],
      badges: ["First Print", "Fake Badge"],
      streakDates: [],
    });
    expect(progressSummary(parseProgress(raw), TODAY).badges).toEqual(["First Print"]);
  });

  test("a corrupt stored record renders as zeros with no progress", () => {
    const summary = progressSummary(parseProgress("not json {"), TODAY);
    expect(summary.passedCount).toBe(0);
    expect(summary.totalPoints).toBe(0);
    expect(summary.hasProgress).toBe(false);
  });

  test("TOTAL_LEVELS tracks the shipped content pack", () => {
    expect(TOTAL_LEVELS).toBe(LEVELS.length);
  });

  test("storage warning names browser storage loss", () => {
    expect(PROGRESS_STORAGE_WARNING).toMatch(/browser/i);
    expect(PROGRESS_STORAGE_WARNING.length).toBeGreaterThan(0);
  });
});
