// Judge core (ADR-0007 pure core: no framework imports). Implements
// FR-006: a level passes only when the run output meets the level check
// AND every concept token is present in the submitted code. Any run
// result class other than "ok" can never pass (NFR-014), so the judge
// fails closed on unknown classes too.

import type { ConceptToken, Level } from "./levels";

/** The run outcome the judge reads: ADR-0004 result class plus stdout. */
export interface JudgeRunResult {
  resultClass: string;
  stdout: string;
}

export interface JudgeVerdict {
  passed: boolean;
  outputMatched: boolean;
  conceptUsed: boolean;
  /** Tokens below their minCount; FR-006 feedback names the missing concept. */
  missingTokens: readonly ConceptToken[];
}

/** Count non-overlapping occurrences of `needle` in `text`, case-sensitive. */
function countOccurrences(text: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Judge one finished run against a level. Output matches exactly after
 * trim (the newline println adds does not fail a correct program); each
 * concept token must appear at least its minCount times in the program.
 */
export function judgeRun(
  level: Level,
  program: string,
  run: JudgeRunResult,
): JudgeVerdict {
  const outputMatched = run.stdout.trim() === level.expectedOutput.trim();
  const missingTokens = level.conceptTokens.filter(
    (token) => countOccurrences(program, token.text) < token.minCount,
  );
  const conceptUsed = missingTokens.length === 0;
  return {
    passed: run.resultClass === "ok" && outputMatched && conceptUsed,
    outputMatched,
    conceptUsed,
    missingTokens,
  };
}
