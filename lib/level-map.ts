// Level map derivation (ADR-0007 pure core: no framework imports).
// Implements FR-001 (ordered map with locked / open / passed states),
// FR-002 (level locks), and the display side of FR-015 (streak count).
// The map view renders exactly this derivation, so seeded progress
// records (empty, partial, full) are the ticket's test seam.

import { LEVELS, getLevel, type Level } from "./levels";
import { isPassed, streakCount, totalPoints, type Progress } from "./progress";

/** State words are part of the UI: never shown by colour alone (ADR-0008). */
export type LevelState = "locked" | "open" | "passed";

export interface LevelMapEntry {
  level: Level;
  state: LevelState;
  /** Where selecting the planet goes; `null` when locked (not navigable). */
  href: string | null;
}

export interface LevelMapView {
  entries: readonly LevelMapEntry[];
  /** Derived from passed levels, never stored (ADR-0006). */
  totalPoints: number;
  /** FR-015 forgiving-rule count for the given local date. */
  streak: number;
  passedCount: number;
  /** First level not yet passed, in order; `null` when the quest is complete. */
  nextLevel: Level | null;
}

/**
 * Route for a level (ADR-0007 route map). Level 10 is the robot arena:
 * selecting it opens the arena under WF-004 (FR-002 AC-2), where a win
 * records level 10 passed.
 */
export function levelHref(levelId: number): string {
  return levelId === LEVELS.length ? "/arena" : `/levels/${levelId}`;
}

/**
 * State of one level (FR-001, FR-002): passed when recorded passed; open
 * when it is level 1 or the previous level is passed; locked otherwise.
 * Unknown level ids are locked.
 */
export function levelState(progress: Progress, levelId: number): LevelState {
  if (getLevel(levelId) === undefined) return "locked";
  if (isPassed(progress, levelId)) return "passed";
  if (levelId === 1 || isPassed(progress, levelId - 1)) return "open";
  return "locked";
}

/** First level not yet passed, in fixed order; `null` when all are passed. */
export function firstUnfinishedLevel(progress: Progress): Level | null {
  return LEVELS.find((level) => !isPassed(progress, level.id)) ?? null;
}

/** The whole map for one progress value on one local date (WF-001 step 1). */
export function levelMapView(progress: Progress, today: string): LevelMapView {
  const entries = LEVELS.map((level) => {
    const state = levelState(progress, level.id);
    return { level, state, href: state === "locked" ? null : levelHref(level.id) };
  });
  return {
    entries,
    totalPoints: totalPoints(progress),
    streak: streakCount(progress, today),
    passedCount: entries.filter((entry) => entry.state === "passed").length,
    nextLevel: firstUnfinishedLevel(progress),
  };
}

/**
 * Bolt's line when a locked planet is selected (FR-002): the map stays
 * shown and the text names the first level still to pass. An open or
 * passed level needs no notice, so it yields an empty string.
 */
export function lockedNotice(progress: Progress, level: Level): string {
  if (levelState(progress, level.id) !== "locked") return "";
  const first = firstUnfinishedLevel(progress);
  if (first === null) return "";
  return `Level ${level.id} is locked, Cadet. Pass Level ${first.id} first.`;
}
