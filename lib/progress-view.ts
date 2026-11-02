// Parent progress summary (ADR-0007 pure core: no framework imports).
// Derives the WF-005 parent view (FR-012) from the sanitized progress
// record: levels passed out of 10, derived total points, earned badge
// names, streak dates, and whether any saved progress exists at all
// (FR-012 AC-2 disables reset when there is none).

import { LEVELS } from "./levels";
import { streakCount, totalPoints, type Progress } from "./progress";

/** How many levels the quest holds (FR-012 "out of 10"). */
export const TOTAL_LEVELS = LEVELS.length;

/** Storage-loss warning shown on every progress view (FR-012, DR-009). */
export const PROGRESS_STORAGE_WARNING =
  "Quest progress lives only in this browser. Clearing this browser's storage erases it, and it cannot be brought back.";

export interface ProgressSummary {
  passedCount: number;
  totalLevels: number;
  /** Derived from passed levels, never stored (ADR-0006). */
  totalPoints: number;
  badges: readonly string[];
  streakDates: readonly string[];
  /** FR-015 forgiving-rule count for the given local date. */
  streak: number;
  /** False when no record is saved: zeros show and reset is disabled. */
  hasProgress: boolean;
}

/** The whole parent summary for one progress value on one local date. */
export function progressSummary(progress: Progress, today: string): ProgressSummary {
  return {
    passedCount: progress.passedLevelIds.length,
    totalLevels: TOTAL_LEVELS,
    totalPoints: totalPoints(progress),
    badges: progress.badges,
    streakDates: progress.streakDates,
    streak: streakCount(progress, today),
    hasProgress:
      progress.passedLevelIds.length > 0 ||
      progress.badges.length > 0 ||
      progress.streakDates.length > 0,
  };
}
