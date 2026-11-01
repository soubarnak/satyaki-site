// Run result classifier (ADR-0004): a pure function of the Piston execute
// response. The client renders the mapped sentence for the returned class;
// it never classifies. No class other than `ok` can produce a pass
// (NFR-014).

/** The seven ADR-0004 result classes. */
export type RunClass =
  | "ok"
  | "compile"
  | "runtime"
  | "memory-cap"
  | "time-cap"
  | "runner-unavailable"
  | "busy";

/** One Piston phase (compile or run) as returned by execute. */
export interface PistonPhase {
  stdout: string;
  stderr: string;
  output: string;
  /** Exit code, or null when the process was killed. */
  code: number | null;
  /** Kill signal (for example "SIGKILL"), or null when the process exited. */
  signal: string | null;
}

/** The subset of the Piston execute response the classifier reads. */
export interface PistonExecuteResponse {
  compile?: PistonPhase;
  run: PistonPhase;
}

function isPhase(value: unknown): value is PistonPhase {
  if (typeof value !== "object" || value === null) return false;
  const phase = value as Record<string, unknown>;
  return (
    typeof phase.stdout === "string" &&
    typeof phase.stderr === "string" &&
    typeof phase.output === "string" &&
    (typeof phase.code === "number" || phase.code === null) &&
    (typeof phase.signal === "string" || phase.signal === null)
  );
}

/**
 * Narrow an unknown JSON body to the execute response shape. Returns null
 * for anything else (garbage body, runner error payload), which the run
 * handler maps to runner-unavailable.
 */
export function parsePistonResponse(
  value: unknown,
): PistonExecuteResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (!isPhase(body.run)) return null;
  if (body.compile !== undefined && !isPhase(body.compile)) return null;
  return body as unknown as PistonExecuteResponse;
}

/**
 * Classify a Piston execute outcome per the ADR-0004 table. SIGKILL
 * enforces both caps; the split is the documented heuristic: stderr
 * carrying OutOfMemoryError is memory-cap, any other killed run is
 * time-cap (a memory kill with no such text labels as time-cap; the
 * program stops at the cap either way).
 */
export function classifyRun(response: PistonExecuteResponse): RunClass {
  const { compile, run } = response;
  if (compile && (compile.signal !== null || compile.code !== 0)) {
    return "compile";
  }
  if (run.stderr.includes("OutOfMemoryError")) return "memory-cap";
  if (run.signal !== null) return "time-cap";
  if (run.code === 0) return "ok";
  // Run exit not 0 and not killed, plus every outcome matching no other
  // row (ADR-0004: generic try-again handling).
  return "runtime";
}

/** DR-005: at most 10000 characters shown per stream. */
export const MAX_STREAM_CHARS = 10000;

/** Appended after a capped stream so truncation is visible (DR-005). */
export const TRUNCATION_MARK = "\n[output cut short]";

export interface CappedStream {
  text: string;
  truncated: boolean;
}

/** Cap one stream at MAX_STREAM_CHARS, marking truncation when capped. */
export function capStream(text: string): CappedStream {
  if (text.length <= MAX_STREAM_CHARS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_STREAM_CHARS) + TRUNCATION_MARK,
    truncated: true,
  };
}

/**
 * Strip internal runner paths from error text (ADR-0004, NFR-005):
 * absolute directory prefixes are removed, leaving the file name the
 * learner can act on (for example Main.java:3).
 */
export function stripRunnerPaths(text: string): string {
  return text.replace(/(?:\/[\w.@-]+)+\//g, "");
}
