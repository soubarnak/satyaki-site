import { describe, expect, it } from "vitest";
import {
  firstUnfinishedLevel,
  levelHref,
  levelMapView,
  levelState,
  lockedNotice,
} from "./level-map";
import { LEVELS, getLevel } from "./levels";
import { parseProgress, type Progress } from "./progress";

const TODAY = "2026-11-01";

function progressWith(passedLevelIds: number[], streakDates: string[] = []): Progress {
  return { passedLevelIds, badges: [], streakDates };
}

function statesOf(progress: Progress): string[] {
  return levelMapView(progress, TODAY).entries.map((entry) => entry.state);
}

describe("levelMapView from seeded progress records (FR-001)", () => {
  it("empty record: level 1 open, levels 2 to 10 locked, 0 points (AC-2)", () => {
    const view = levelMapView(parseProgress(null), TODAY);
    expect(statesOf(parseProgress(null))).toEqual([
      "open",
      ...Array(9).fill("locked"),
    ]);
    expect(view.totalPoints).toBe(0);
    expect(view.passedCount).toBe(0);
    expect(view.nextLevel?.id).toBe(1);
  });

  it("partial record: levels 1 to 3 passed, 4 open, 5 to 10 locked (AC-1)", () => {
    const view = levelMapView(progressWith([1, 2, 3]), TODAY);
    expect(view.entries.map((entry) => entry.state)).toEqual([
      "passed",
      "passed",
      "passed",
      "open",
      ...Array(6).fill("locked"),
    ]);
    expect(view.totalPoints).toBe(300);
    expect(view.passedCount).toBe(3);
    expect(view.nextLevel?.id).toBe(4);
  });

  it("full record: every level passed, points derived, no next level", () => {
    const all = LEVELS.map((level) => level.id);
    const view = levelMapView(progressWith(all), TODAY);
    expect(view.entries.every((entry) => entry.state === "passed")).toBe(true);
    expect(view.totalPoints).toBe(1100);
    expect(view.passedCount).toBe(10);
    expect(view.nextLevel).toBeNull();
    expect(firstUnfinishedLevel(progressWith(all))).toBeNull();
  });

  it("shows levels in fixed order with their content-pack identity", () => {
    const view = levelMapView(progressWith([]), TODAY);
    expect(view.entries.map((entry) => entry.level.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(view.entries[0].level.planet).toBe("Volta");
    expect(view.entries[9].level.planet).toBe("Haven Station");
  });

  it("derives the streak display from seeded run dates (FR-015)", () => {
    const seeded = progressWith([1], ["2026-10-30", "2026-11-01"]);
    expect(levelMapView(seeded, TODAY).streak).toBe(2);
    expect(levelMapView(progressWith([]), TODAY).streak).toBe(0);
  });

  it("a corrupt stored record renders as the empty map, not a crash", () => {
    const view = levelMapView(parseProgress("not json {"), TODAY);
    expect(view.entries[0].state).toBe("open");
    expect(view.totalPoints).toBe(0);
  });
});

describe("level locks (FR-002)", () => {
  it("locked planets are not navigable; open and passed planets link onward", () => {
    const view = levelMapView(progressWith([1, 2, 3]), TODAY);
    for (const entry of view.entries) {
      if (entry.state === "locked") {
        expect(entry.href).toBeNull();
      } else {
        expect(entry.href).toBe(levelHref(entry.level.id));
      }
    }
    expect(view.entries[3].href).toBe("/levels/4");
    expect(view.entries[0].href).toBe("/levels/1");
  });

  it("selecting a locked level names the first level to pass (AC-1)", () => {
    const progress = progressWith([1, 2, 3]);
    const level6 = getLevel(6);
    if (level6 === undefined) throw new Error("level 6 missing");
    expect(lockedNotice(progress, level6)).toContain("Level 4");
    expect(levelState(progress, 6)).toBe("locked");
  });

  it("open and passed levels need no locked notice", () => {
    const progress = progressWith([1, 2, 3]);
    for (const id of [1, 4]) {
      const level = getLevel(id);
      if (level === undefined) throw new Error(`level ${id} missing`);
      expect(lockedNotice(progress, level)).toBe("");
    }
  });

  it("level 10 opens the arena once level 9 is passed (AC-2)", () => {
    const before = progressWith([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(levelState(before, 10)).toBe("locked");
    expect(levelMapView(before, TODAY).entries[9].href).toBeNull();

    const after = progressWith([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(levelState(after, 10)).toBe("open");
    expect(levelHref(10)).toBe("/arena");
    expect(levelMapView(after, TODAY).entries[9].href).toBe("/arena");
  });

  it("a level opens only when the previous level is passed", () => {
    expect(levelState(progressWith([]), 2)).toBe("locked");
    expect(levelState(progressWith([1]), 2)).toBe("open");
    expect(levelState(progressWith([1]), 3)).toBe("locked");
    expect(levelState(progressWith([]), 99)).toBe("locked");
  });
});
