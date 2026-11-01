// Progress core (ADR-0007 pure core: no framework imports, never touches
// `window`). Implements ADR-0006: per-field sanitization on load, total
// points derived from passed levels (never stored), streak count computed
// from stored dates under the FR-015 forgiving rule. Browser storage sits
// behind the adapter in lib/progress-storage.ts.

import { LEVELS, getLevel } from "./levels";

/** Earned badge names known to v1, in level order, from the content pack. */
export const KNOWN_BADGES: readonly string[] = LEVELS.flatMap((level) =>
  level.badge ? [level.badge] : [],
);

/**
 * Sanitized learner progress. Total points and streak count are derived
 * from this value on read; neither is ever stored (ADR-0006).
 */
export interface Progress {
  passedLevelIds: readonly number[];
  badges: readonly string[];
  /** Device-local calendar dates, YYYY-MM-DD, unique, sorted ascending. */
  streakDates: readonly string[];
}

export const EMPTY_PROGRESS: Progress = {
  passedLevelIds: [],
  badges: [],
  streakDates: [],
};

const RECORD_VERSION = 1;

function sanitizePassedLevelIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(
    (id): id is number =>
      typeof id === "number" && Number.isInteger(id) && getLevel(id) !== undefined,
  );
  return [...new Set(valid)].sort((a, b) => a - b);
}

function sanitizeBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const earned = new Set(value.filter((badge) => typeof badge === "string"));
  return KNOWN_BADGES.filter((badge) => earned.has(badge));
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in strict YYYY-MM-DD form. */
export function isStreakDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function sanitizeStreakDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isStreakDate))].sort();
}

function sanitizeProgress(fields: {
  passedLevelIds: unknown;
  badges: unknown;
  streakDates: unknown;
}): Progress {
  return {
    passedLevelIds: sanitizePassedLevelIds(fields.passedLevelIds),
    badges: sanitizeBadges(fields.badges),
    streakDates: sanitizeStreakDates(fields.streakDates),
  };
}

/**
 * Parse stored record text into progress (ADR-0006). Unparseable JSON, a
 * non-object record, or an unknown `version` means no progress; each known
 * field is sanitized on its own, so one corrupt field loses only itself.
 */
export function parseProgress(raw: string | null): Progress {
  if (raw === null || raw === "") return EMPTY_PROGRESS;
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return EMPTY_PROGRESS;
  }
  const fields = record as Record<string, unknown>;
  if (fields.version !== RECORD_VERSION) return EMPTY_PROGRESS;
  return sanitizeProgress({
    passedLevelIds: fields.passedLevelIds,
    badges: fields.badges,
    streakDates: fields.streakDates,
  });
}

/** Serialize progress as the single stored JSON record (ADR-0006). */
export function serializeProgress(progress: Progress): string {
  const clean = sanitizeProgress(progress);
  return JSON.stringify({ version: RECORD_VERSION, ...clean });
}

/**
 * Total points, derived on read (DR-003): the sum of point values of passed
 * levels. Each level counts once, so FR-008 holds by construction.
 */
export function totalPoints(progress: Progress): number {
  return sanitizePassedLevelIds(progress.passedLevelIds).reduce(
    (sum, id) => sum + (getLevel(id)?.points ?? 0),
    0,
  );
}

export function isPassed(progress: Progress, levelId: number): boolean {
  return progress.passedLevelIds.includes(levelId);
}

/**
 * Record a pass (FR-008, FR-014): adds the level and, where the level names
 * one, its badge. A repeat pass changes nothing. When `runDate` is given it
 * joins the streak dates, so the caller persists the whole change in the
 * one storage write ADR-0006 requires.
 */
export function recordPass(
  progress: Progress,
  levelId: number,
  runDate?: string,
): Progress {
  const level = getLevel(levelId);
  if (level === undefined) return sanitizeProgress(progress);
  return sanitizeProgress({
    passedLevelIds: [...progress.passedLevelIds, level.id],
    badges: level.badge ? [...progress.badges, level.badge] : progress.badges,
    streakDates:
      runDate === undefined
        ? progress.streakDates
        : [...progress.streakDates, runDate],
  });
}

/** Record a run on a local calendar day (FR-015); malformed dates are dropped. */
export function recordRunDay(progress: Progress, date: string): Progress {
  return sanitizeProgress({
    ...progress,
    streakDates: [...progress.streakDates, date],
  });
}

/** Device-local calendar date of `date` as YYYY-MM-DD (DR-004). */
export function localDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/**
 * Streak count on `today` (FR-015 forgiving rule): run days chain while the
 * gap between neighbours is at most 2 days (exactly 1 missed day keeps the
 * count); a longer gap starts a new chain. The chain is still alive when
 * the latest run day is at most 2 days before `today`, and 0 after that.
 */
export function streakCount(progress: Progress, today: string): number {
  if (!isStreakDate(today)) return 0;
  const todayNumber = dayNumber(today);
  const days = sanitizeStreakDates(progress.streakDates)
    .map(dayNumber)
    .filter((day) => day <= todayNumber);
  if (days.length === 0) return 0;

  const latest = days[days.length - 1];
  if (todayNumber - latest > 2) return 0;

  let count = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] > 2) break;
    count += 1;
  }
  return count;
}
