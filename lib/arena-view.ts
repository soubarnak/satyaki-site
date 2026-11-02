// Arena view core (ADR-0007 pure core: no framework imports).
// Gate (FR-010), starter and command help (WF-004 step 1), and the
// child-first lines for error classes (FR-007) and battle verdicts
// (FR-011). Replay math stays in lib/arena.ts; the component owns the
// step animation and the single progress write on a win.

import { getLevel } from "./levels";
import { isPassed, type Progress } from "./progress";
import type { RunOutcome } from "./lesson-player";
import type { ArenaResult } from "./arena";

/** Level ids that must be passed before the arena opens (FR-010). */
export const ARENA_GATE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Level id recorded on an arena win (FR-011, FR-002 AC-2). */
export const ARENA_LEVEL_ID = 10;

/** Starter program: one example print plus the command contract. */
export const ARENA_STARTER = `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW
        // Print one command per line: MOVE, TURN, or ATTACK.
        System.out.println("MOVE");
        // YOUR CODE ABOVE
    }
}`;

/** Robot commands shown beside the editor (WF-004 step 1). */
export const ARENA_COMMANDS: readonly { command: string; meaning: string }[] = [
  { command: "MOVE", meaning: "Walk one cell along the facing." },
  { command: "TURN", meaning: "Turn to face the other way." },
  { command: "ATTACK", meaning: "Hit only next to the station, facing it." },
];

export interface ArenaGate {
  /** True once levels 1 to 9 are all passed (FR-010). */
  open: boolean;
  /** How many of levels 1 to 9 are still unpassed. */
  remaining: number;
  /** First unpassed level id, or null when the gate is open. */
  nextLevelId: number | null;
}

/** Gate derivation for one progress value (FR-010). */
export function arenaGate(progress: Progress): ArenaGate {
  const missing = ARENA_GATE_IDS.filter((id) => !isPassed(progress, id));
  return {
    open: missing.length === 0,
    remaining: missing.length,
    nextLevelId: missing.length === 0 ? null : missing[0],
  };
}

/**
 * Child-readable lock line naming the count still to pass (FR-010).
 * With 8 levels passed this reads "1 level remains" (FR-010 AC-2).
 */
export function arenaLockLine(gate: ArenaGate): string {
  if (gate.open) return "";
  const levelWord = gate.remaining === 1 ? "level remains" : "levels remain";
  const next =
    gate.nextLevelId === null ? "" : ` Pass Level ${gate.nextLevelId} to open the next one.`;
  return `Arena locked, Cadet. ${gate.remaining} ${levelWord}.${next}`;
}

export type ArenaErrorKind = "code-error" | "runner-problem";

export interface ArenaErrorFeedback {
  kind: ArenaErrorKind;
  /** Child-readable line, always shown first (FR-007, ADR-0008). */
  boltLine: string;
  /** Raw runner text shown after the child line, never before it. */
  rawError: string;
}

// Same FR-007 lines as the lesson player and playground, so runner
// trouble and code mistakes read identically in every view.
// Duplicated, not imported: each judged flow keeps its table private.
const CLASS_LINES: Record<string, string> = {
  compile: "Bolt cannot read this code yet, Cadet. Check the line the message names.",
  runtime: "Your program started, then hit a problem and stopped, Cadet.",
  "memory-cap": "Your program used too much memory, so Bolt stopped it, Cadet.",
  "time-cap": "Your program ran too long, so Bolt stopped it, Cadet.",
  "runner-unavailable":
    "The code runner is not answering, Cadet, and that is not your code's fault. Try Run again soon.",
  busy: "Too many runs at once, Cadet. Wait a moment, then try Run again.",
};

const GENERIC_LINE = "Something stopped your program, Cadet. Try Run again.";

/**
 * Child-first feedback for a finished arena run that never reached the
 * engine (compile/runtime/cap/runner classes, WF-004 alternate path).
 * Records no win and writes no pass; the caller still records the run
 * day (FR-015) in its single storage write.
 */
export function arenaErrorFeedback(run: RunOutcome, rawError = ""): ArenaErrorFeedback {
  if (run.resultClass === "runner-unavailable" || run.resultClass === "busy") {
    return {
      kind: "runner-problem",
      boltLine: CLASS_LINES[run.resultClass],
      rawError,
    };
  }
  return {
    kind: "code-error",
    boltLine: CLASS_LINES[run.resultClass] ?? GENERIC_LINE,
    rawError,
  };
}

/**
 * Child-first verdict line for a finished engine replay (FR-011).
 * Win names the level 10 point award; loss points back at the lane.
 */
export function arenaBattleLine(result: ArenaResult): string {
  if (result.won) {
    const points = getLevel(ARENA_LEVEL_ID)?.points ?? 0;
    return `Victory, Cadet. The station is awake! You earned ${points} points.`;
  }
  if (result.steps.length === 0) {
    return "Bolt heard no commands, Cadet. Print MOVE, TURN, or ATTACK, then run again.";
  }
  return "Not yet, Cadet. Walk next to the station, face it, then ATTACK.";
}
