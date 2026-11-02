// Playground feedback core (ADR-0007 pure core: no framework imports).
// Turns one /api/run outcome into the child-first lines the playground
// view shows (WF-003, FR-009). The playground never judges and never
// scores: an `ok` run only echoes output, every other class maps to the
// same child-readable FR-007 lines the lesson player uses.

import type { RunOutcome } from "./lesson-player";

/** Example program the playground editor starts with (WF-003 step 1). */
export const PLAYGROUND_EXAMPLE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Bolt!");
    }
}`;

export type PlaygroundFeedbackKind = "output" | "code-error" | "runner-problem";

export interface PlaygroundFeedback {
  kind: PlaygroundFeedbackKind;
  /** Child-readable line, always shown first (FR-007, ADR-0008). */
  boltLine: string;
  /** Raw runner text shown after the child line, never before it. */
  rawError: string;
}

// Same FR-007 lines as the lesson player, so runner trouble and code
// mistakes read identically in both views. Duplicated, not imported:
// the lesson player keeps its table private to its judged flow.
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
 * Child-first feedback for one finished playground run. Never passes or
 * fails the program: `ok` only echoes output, everything else maps to a
 * display line with the raw text kept after it.
 */
export function playgroundFeedback(run: RunOutcome, rawError = ""): PlaygroundFeedback {
  if (run.resultClass === "ok") {
    return {
      kind: "output",
      boltLine: "Nice run, Cadet. Your output shows below.",
      rawError: "",
    };
  }
  if (run.resultClass === "runner-unavailable" || run.resultClass === "busy") {
    return { kind: "runner-problem", boltLine: CLASS_LINES[run.resultClass], rawError };
  }
  return {
    kind: "code-error",
    boltLine: CLASS_LINES[run.resultClass] ?? GENERIC_LINE,
    rawError,
  };
}
