// Lesson player feedback core (ADR-0007 pure core: no framework imports).
// Turns one /api/run outcome plus the judge verdict into the child-first
// feedback the view shows (FR-005, FR-006, FR-007). The client never
// classifies Piston: it only renders `resultClass` through these lines.

import { judgeRun, type JudgeRunResult } from "./judge";
import type { Level } from "./levels";

/** The /api/run outcome narrowed for feedback, after parseRunOutcome. */
export interface RunOutcome {
  resultClass: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export type FeedbackKind =
  | "passed"
  | "wrong-output"
  | "missing-concept"
  | "code-error"
  | "runner-problem";

export interface RunFeedback {
  kind: FeedbackKind;
  /** True only on a full pass (FR-006); the view records progress on this. */
  passed: boolean;
  /** Child-readable line, always shown first (FR-007, ADR-0008). */
  boltLine: string;
  /** Raw runner text shown after the child line, never before it. */
  rawError: string;
}

// One child-readable sentence per ADR-0004 class (FR-007). The runner
// classes stay visually distinct from code mistakes (WF-002): they say
// the runner is at fault and name Run as the fix.
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

function isRunnerProblem(resultClass: string): boolean {
  return resultClass === "runner-unavailable" || resultClass === "busy";
}

/**
 * Child-first feedback for one finished run. Only an `ok` result class
 * judged as a pass passes; every other class fails closed (NFR-014 and
 * the judge's unknown-class rule), so a garbled runner answer can never
 * earn a pass.
 */
export function runFeedback(
  level: Level,
  program: string,
  run: JudgeRunResult,
  rawError = "",
): RunFeedback {
  if (run.resultClass === "ok") {
    const verdict = judgeRun(level, program, run);
    if (verdict.passed) {
      const badge = level.badge ? ` You earned the ${level.badge} badge.` : "";
      return {
        kind: "passed",
        passed: true,
        boltLine: `Level passed, Cadet. You earned ${level.points} points.${badge}`,
        rawError: "",
      };
    }
    if (verdict.outputMatched) {
      const missing = verdict.missingTokens.map((token) => token.text).join(", ");
      return {
        kind: "missing-concept",
        passed: false,
        boltLine: `Your output is right, Cadet, but this level teaches ${level.concept}. Use ${missing} in your code, then run again.`,
        rawError: "",
      };
    }
    return {
      kind: "wrong-output",
      passed: false,
      boltLine: "Not yet, Cadet. Read your output, then check the mission goal below.",
      rawError: "",
    };
  }
  if (isRunnerProblem(run.resultClass)) {
    return {
      kind: "runner-problem",
      passed: false,
      boltLine: CLASS_LINES[run.resultClass],
      rawError,
    };
  }
  return {
    kind: "code-error",
    passed: false,
    boltLine: CLASS_LINES[run.resultClass] ?? GENERIC_LINE,
    rawError,
  };
}

/**
 * Narrow an /api/run response body to a RunOutcome. A 400 body carries an
 * `error` string (the DR-001 length gate); anything else unshaped fails
 * closed as an unknown class, which can never pass.
 */
export function parseRunOutcome(body: unknown): RunOutcome {
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    if (
      typeof record.resultClass === "string" &&
      typeof record.stdout === "string" &&
      typeof record.stderr === "string"
    ) {
      return {
        resultClass: record.resultClass,
        stdout: record.stdout,
        stderr: record.stderr,
        durationMs: typeof record.durationMs === "number" ? record.durationMs : 0,
      };
    }
    if (typeof record.error === "string") {
      return { resultClass: "invalid", stdout: "", stderr: record.error, durationMs: 0 };
    }
  }
  return { resultClass: "unknown", stdout: "", stderr: "", durationMs: 0 };
}
