import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_PROGRESS,
  KNOWN_BADGES,
  isPassed,
  localDateString,
  parseProgress,
  recordPass,
  recordRunDay,
  serializeProgress,
  streakCount,
  totalPoints,
  type Progress,
} from "./progress";
import {
  PROGRESS_STORAGE_KEY,
  createProgressStorage,
  type StorageLike,
} from "./progress-storage";

function stored(record: unknown): string {
  return JSON.stringify(record);
}

describe("parseProgress (ADR-0006, DR-003/DR-004 corrupt records)", () => {
  it("treats missing, unparseable, and non-object records as no progress", () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("not json {")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("[1,2]")).toEqual(EMPTY_PROGRESS);
    expect(parseProgress("42")).toEqual(EMPTY_PROGRESS);
  });

  it("treats an unknown version as no progress", () => {
    expect(
      parseProgress(
        stored({ version: 2, passedLevelIds: [1], badges: [], streakDates: [] }),
      ),
    ).toEqual(EMPTY_PROGRESS);
    expect(
      parseProgress(stored({ passedLevelIds: [1], badges: [], streakDates: [] })),
    ).toEqual(EMPTY_PROGRESS);
  });

  it("drops out-of-range, duplicate, and non-integer level ids and sorts ascending", () => {
    const progress = parseProgress(
      stored({
        version: 1,
        passedLevelIds: [2, 1, 2, 0, 11, -1, 3.5, "4", null],
        badges: [],
        streakDates: [],
      }),
    );
    expect(progress.passedLevelIds).toEqual([1, 2]);
  });

  it("drops badge names outside the known set and deduplicates", () => {
    const progress = parseProgress(
      stored({
        version: 1,
        passedLevelIds: [],
        badges: ["Loop Master", "Forged Badge", "First Print", "Loop Master", 7],
        streakDates: [],
      }),
    );
    expect(progress.badges).toEqual(["First Print", "Loop Master"]);
    expect(KNOWN_BADGES).toEqual(["First Print", "Loop Master", "Bug Hunter"]);
  });

  it("deduplicates streak dates, sorts ascending, and drops malformed entries", () => {
    const progress = parseProgress(
      stored({
        version: 1,
        passedLevelIds: [],
        badges: [],
        streakDates: [
          "2026-11-03",
          "2026-11-01",
          "2026-11-03",
          "2026-13-01",
          "2026-02-30",
          "2026-1-01",
          "11/01/2026",
          "",
          20261101,
        ],
      }),
    );
    expect(progress.streakDates).toEqual(["2026-11-01", "2026-11-03"]);
  });

  it("sanitizes per field: one corrupt field does not destroy the others", () => {
    const progress = parseProgress(
      stored({
        version: 1,
        passedLevelIds: "all-of-them",
        badges: ["Bug Hunter"],
        streakDates: ["2026-11-01"],
      }),
    );
    expect(progress).toEqual({
      passedLevelIds: [],
      badges: ["Bug Hunter"],
      streakDates: ["2026-11-01"],
    });
  });

  it("ignores a stored total points value; the total is derived (ADR-0006)", () => {
    const progress = parseProgress(
      stored({
        version: 1,
        passedLevelIds: [1],
        badges: [],
        streakDates: [],
        totalPoints: 5000,
      }),
    );
    expect(totalPoints(progress)).toBe(100);
    expect(progress).not.toHaveProperty("totalPoints");
  });
});

describe("totalPoints (DR-003 derived total, FR-008 award once)", () => {
  it("derives 0 from an empty passed list", () => {
    expect(totalPoints(EMPTY_PROGRESS)).toBe(0);
  });

  it("derives the full sum from all ten levels passed", () => {
    const full: Progress = {
      passedLevelIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      badges: [],
      streakDates: [],
    };
    expect(totalPoints(full)).toBe(1100);
  });

  it("counts each level once even when a hand-built list repeats it", () => {
    const repeated: Progress = {
      passedLevelIds: [1, 1, 10, 10, 99],
      badges: [],
      streakDates: [],
    };
    expect(totalPoints(repeated)).toBe(300);
  });
});

describe("recordPass (FR-008, FR-014)", () => {
  it("records a first pass and its badge, raising the derived total by the level value", () => {
    const after = recordPass(EMPTY_PROGRESS, 1);
    expect(after.passedLevelIds).toEqual([1]);
    expect(after.badges).toEqual(["First Print"]);
    expect(totalPoints(after)).toBe(100);
    expect(isPassed(after, 1)).toBe(true);
    expect(isPassed(after, 2)).toBe(false);
  });

  it("changes nothing on a repeat pass", () => {
    const once = recordPass(EMPTY_PROGRESS, 1);
    const twice = recordPass(once, 1);
    expect(twice).toEqual(once);
    expect(totalPoints(twice)).toBe(100);
  });

  it("awards a badge only where the level names one", () => {
    const after = recordPass(recordPass(EMPTY_PROGRESS, 2), 8);
    expect(after.passedLevelIds).toEqual([2, 8]);
    expect(after.badges).toEqual(["Loop Master"]);
  });

  it("ignores an out-of-range level id", () => {
    expect(recordPass(EMPTY_PROGRESS, 0)).toEqual(EMPTY_PROGRESS);
    expect(recordPass(EMPTY_PROGRESS, 11)).toEqual(EMPTY_PROGRESS);
  });

  it("folds the run date into the same record when given, ignoring a malformed date", () => {
    const after = recordPass(EMPTY_PROGRESS, 1, "2026-11-01");
    expect(after.streakDates).toEqual(["2026-11-01"]);
    expect(recordPass(EMPTY_PROGRESS, 1, "not-a-date").streakDates).toEqual([]);
  });

  it("does not mutate the given progress", () => {
    const before: Progress = { passedLevelIds: [1], badges: [], streakDates: [] };
    recordPass(before, 2, "2026-11-02");
    expect(before).toEqual({ passedLevelIds: [1], badges: [], streakDates: [] });
  });
});

describe("recordRunDay and streakCount (FR-015 forgiving streak, DR-004)", () => {
  it("adds each new run day once, sorted; malformed dates are ignored", () => {
    let progress = recordRunDay(EMPTY_PROGRESS, "2026-11-02");
    progress = recordRunDay(progress, "2026-11-01");
    progress = recordRunDay(progress, "2026-11-01");
    progress = recordRunDay(progress, "2026-02-30");
    expect(progress.streakDates).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("counts 0 with no run days", () => {
    expect(streakCount(EMPTY_PROGRESS, "2026-11-01")).toBe(0);
  });

  it("counts consecutive run days ending today", () => {
    const progress: Progress = {
      passedLevelIds: [],
      badges: [],
      streakDates: ["2026-11-01", "2026-11-02"],
    };
    expect(streakCount(progress, "2026-11-02")).toBe(2);
  });

  it("keeps the prior count after exactly 1 missed day (FR-015 AC-2)", () => {
    const progress: Progress = {
      passedLevelIds: [],
      badges: [],
      streakDates: ["2026-11-01", "2026-11-03"],
    };
    expect(streakCount(progress, "2026-11-03")).toBe(2);
  });

  it("resets after 2 missed days in a row", () => {
    const progress: Progress = {
      passedLevelIds: [],
      badges: [],
      streakDates: ["2026-11-01", "2026-11-04"],
    };
    expect(streakCount(progress, "2026-11-04")).toBe(1);
  });

  it("stays alive when today has no run yet but only 1 day was missed", () => {
    const progress: Progress = {
      passedLevelIds: [],
      badges: [],
      streakDates: ["2026-11-01", "2026-11-02"],
    };
    expect(streakCount(progress, "2026-11-04")).toBe(2);
    expect(streakCount(progress, "2026-11-05")).toBe(0);
  });

  it("ignores run days in the future and a malformed today", () => {
    const progress: Progress = {
      passedLevelIds: [],
      badges: [],
      streakDates: ["2026-11-01", "2026-12-25"],
    };
    expect(streakCount(progress, "2026-11-01")).toBe(1);
    expect(streakCount(progress, "not-a-date")).toBe(0);
  });
});

describe("serializeProgress (ADR-0006 one JSON record, no stored total)", () => {
  it("writes version 1 with sanitized fields and no total points", () => {
    const text = serializeProgress({
      passedLevelIds: [2, 1, 2, 99],
      badges: ["Forged Badge", "First Print"],
      streakDates: ["2026-11-02", "2026-11-02", "bad"],
    });
    expect(JSON.parse(text)).toEqual({
      version: 1,
      passedLevelIds: [1, 2],
      badges: ["First Print"],
      streakDates: ["2026-11-02"],
    });
  });

  it("round-trips through parseProgress", () => {
    const progress: Progress = {
      passedLevelIds: [1, 8],
      badges: ["First Print", "Loop Master"],
      streakDates: ["2026-11-01"],
    };
    expect(parseProgress(serializeProgress(progress))).toEqual(progress);
  });
});

describe("localDateString (DR-004 device-local date)", () => {
  it("formats local calendar components as YYYY-MM-DD", () => {
    expect(localDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(localDateString(new Date(2026, 10, 1, 23, 59))).toBe("2026-11-01");
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage: StorageLike = {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
  };
  return { map, storage };
}

describe("progress storage adapter (ADR-0007 thin localStorage adapter)", () => {
  it("saves the whole record under one key in one write (ADR-0006)", () => {
    const { map, storage } = memoryStorage();
    const adapter = createProgressStorage(storage);
    adapter.save(recordPass(EMPTY_PROGRESS, 1, "2026-11-01"));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect([...map.keys()]).toEqual([PROGRESS_STORAGE_KEY]);
    expect(JSON.parse(map.get(PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 1,
      passedLevelIds: [1],
      badges: ["First Print"],
      streakDates: ["2026-11-01"],
    });
  });

  it("loads back what was saved (DR-008 read-after-write)", () => {
    const { storage } = memoryStorage();
    const adapter = createProgressStorage(storage);
    const saved = recordPass(EMPTY_PROGRESS, 8, "2026-11-01");
    adapter.save(saved);
    expect(adapter.load()).toEqual(saved);
  });

  it("loads no progress from an empty or corrupt store", () => {
    const { storage } = memoryStorage({ [PROGRESS_STORAGE_KEY]: "junk {" });
    expect(createProgressStorage(storage).load()).toEqual(EMPTY_PROGRESS);
    expect(createProgressStorage(memoryStorage().storage).load()).toEqual(
      EMPTY_PROGRESS,
    );
  });

  it("clear deletes the record (DR-007 reset)", () => {
    const { map, storage } = memoryStorage();
    const adapter = createProgressStorage(storage);
    adapter.save(recordPass(EMPTY_PROGRESS, 1));
    adapter.clear();
    expect(map.size).toBe(0);
    expect(adapter.load()).toEqual(EMPTY_PROGRESS);
  });

  it("survives a storage backend that throws on every access", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const adapter = createProgressStorage(broken);
    expect(adapter.load()).toEqual(EMPTY_PROGRESS);
    expect(() => adapter.save(EMPTY_PROGRESS)).not.toThrow();
    expect(() => adapter.clear()).not.toThrow();
  });
});
