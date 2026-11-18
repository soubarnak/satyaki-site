// State grader: Stars and multi-Seed rules (ADR-0013, spec §5).
// Glossary: Mission, Pass, Star, Par, Seed, World State.
// Pure core: no framework, DOM, or worker imports. Grades the exact code
// snapshot from one Run press across every Seed (practice first).

import type { Comparator, PassCheck, PlanetConceptId } from "./content";
import { readStatePath, type WorldSnapshot } from "./ship-sim";

/** Per-Seed stop. Worker-enforced caps; grader only reports. */
export const STOP_REASONS = ["none", "error", "step-cap", "event-cap", "time-cap"] as const;
export type StopReason = (typeof STOP_REASONS)[number];

/** Caps from ADR-0013 (worker-enforced; repeated here for feedback text). */
export const MAX_SHIP_STEPS = 500;
export const MAX_TRACE_EVENTS = 500;
export const MAX_WALL_SECONDS = 3;

/** One per-check row of the Run result, in author order. */
export interface GraderCheck {
  id: string;
  label: string;
  timing: PassCheck["timing"];
  /** True only when the check holds on every Seed. */
  passed: boolean;
  /** Practice-Seed intermediate step of first failure, else undefined. */
  firstFailStep?: number;
  /** True when practice holds but a hidden Seed fails this check. */
  hiddenFail: boolean;
}

/** One result per Run (ADR-0013 §result shape). */
export interface GraderResult {
  pass: boolean;
  /** 1 for a Pass, +1 Par, +1 concept. Cap/error Runs award 0. */
  stars: 0 | 1 | 2 | 3;
  parMet: boolean;
  conceptMet: boolean;
  stopReason: StopReason;
  checks: GraderCheck[];
}

/**
 * One Seed's observations. `states[0]` is the starting World State (step 0);
 * each later entry is the World State after one Ship action, in order. The
 * last entry is the program-end state for `final` checks.
 */
export interface SeedRun {
  seed: number;
  isPractice: boolean;
  states: WorldSnapshot[];
  stop: StopReason;
  /** Defaults to the final snapshot's stepsUsed. */
  stepsUsed?: number;
  /** Defaults to starting energy minus remaining energy. */
  energySpent?: number;
  /** 1-based global editor line numbers that executed on the practice Seed. */
  executedLines?: readonly number[];
}

export interface GradeRunInput {
  checks: PassCheck[];
  par: { maxSteps: number; maxEnergy: number };
  star3Concept: PlanetConceptId;
  language: "python" | "java";
  /** Exact editor snapshot at Run press. */
  code: string;
  /** Practice Seed first, then hidden Seeds. Every Seed grades. */
  seeds: SeedRun[];
  /** Boss Gate Part B reuses check/Seed/cap/feedback rules, awards no Stars. */
  isBossPartB?: boolean;
}

/** Compare one resolved scalar. Unresolvable actuals never reach here. */
export function compareScalar(
  comparator: Comparator,
  actual: unknown,
  expected: string | number | boolean,
): boolean {
  switch (comparator) {
    case "eq":
      return actual === expected;
    case "ne":
      return actual !== expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
  }
}

/** One check against one snapshot. Unresolvable statePath fails, never throws. */
export function checkOnSnapshot(check: PassCheck, snapshot: WorldSnapshot): boolean {
  let actual: unknown;
  try {
    actual = readStatePath(snapshot, check.statePath);
  } catch {
    return false;
  }
  if (actual === undefined) return false;
  try {
    return compareScalar(check.comparator, actual, check.expected);
  } catch {
    return false;
  }
}

interface SeedCheckOutcome {
  passed: boolean;
  firstFailStep?: number;
}

function gradeOneSeed(check: PassCheck, seed: SeedRun): SeedCheckOutcome {
  if (seed.states.length === 0) return { passed: false };
  if (check.timing === "final") {
    // A stopped Seed never reaches program end: final checks fail there.
    if (seed.stop !== "none") return { passed: false };
    const last = seed.states[seed.states.length - 1];
    return { passed: checkOnSnapshot(check, last) };
  }
  for (let step = 0; step < seed.states.length; step += 1) {
    if (!checkOnSnapshot(check, seed.states[step])) {
      return { passed: false, firstFailStep: step };
    }
  }
  return { passed: true };
}

function practiceNumbers(seed: SeedRun | undefined): { stepsUsed: number; energySpent: number } {
  if (!seed || seed.states.length === 0) return { stepsUsed: 0, energySpent: 0 };
  const first = seed.states[0];
  const last = seed.states[seed.states.length - 1];
  const stepsUsed = seed.stepsUsed ?? last.ship.stepsUsed;
  const energySpent = seed.energySpent ?? first.ship.energy - last.ship.energy;
  return { stepsUsed, energySpent };
}

// -- Star 3 concept check: Cadet-written, executed, editable-region only --

const PYTHON_BELOW = "# YOUR CODE BELOW";
const PYTHON_ABOVE = "# YOUR CODE ABOVE";
const JAVA_BELOW = "// YOUR CODE BELOW";
const JAVA_ABOVE = "// YOUR CODE ABOVE";

interface EditableLine {
  /** 1-based global editor line number. */
  line: number;
  /** Code with strings blanked and comments removed. */
  code: string;
}

/** Strip one Python line: blank strings, cut `#` comments. Stateless per line. */
function stripPythonLine(line: string): string {
  let out = "";
  let quote: string | null = null;
  let triple = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (quote !== null) {
      if (ch === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (triple) {
        if (line.startsWith(quote.repeat(3), i)) {
          quote = null;
          triple = false;
          out += "      ";
          i += 3;
          continue;
        }
        out += " ";
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
        out += " ";
        i += 1;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }
    if (ch === "#" ) {
      break;
    }
    if (ch === '"' || ch === "'") {
      if (line.startsWith(ch.repeat(3), i)) {
        quote = ch;
        triple = true;
        out += "      ";
        i += 3;
        continue;
      }
      quote = ch;
      out += " ";
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

interface JavaStripState {
  block: boolean;
}

/** Strip one Java line: blank strings, `//` and `/*` `*​/` outside strings. */
function stripJavaLine(line: string, state: JavaStripState): string {
  let out = "";
  let quote: string | null = null;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1] ?? "";
    if (state.block) {
      if (ch === "*" && next === "/") {
        state.block = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }
    if (quote !== null) {
      if (ch === "\\") {
        out += "  ";
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
        out += " ";
        i += 1;
        continue;
      }
      out += " ";
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      state.block = true;
      i += 2;
      continue;
    }
    if (ch === "/" && next === "/") break;
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += " ";
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Editable region between the YOUR CODE markers, with global line numbers. */
export function extractEditableLines(code: string, language: "python" | "java"): EditableLine[] {
  const lines = code.split("\n");
  const below = language === "python" ? PYTHON_BELOW : JAVA_BELOW;
  const above = language === "python" ? PYTHON_ABOVE : JAVA_ABOVE;
  let start = -1;
  let end = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (start === -1 && lines[i].includes(below)) start = i;
    else if (start !== -1 && lines[i].includes(above)) {
      end = i;
      break;
    }
  }
  if (start === -1 || end === -1 || end <= start + 1) return [];
  const javaState: JavaStripState = { block: false };
  const out: EditableLine[] = [];
  for (let i = start + 1; i < end; i += 1) {
    const stripped =
      language === "python" ? stripPythonLine(lines[i]) : stripJavaLine(lines[i], javaState);
    out.push({ line: i + 1, code: stripped });
  }
  return out;
}

function previousNonSpaceChar(code: string, index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    const ch = code[i];
    if (ch !== " " && ch !== "\t") return ch;
  }
  return "";
}

/** A `[` that opens a list literal (not a subscript of a name). */
function hasLiteralBracket(code: string): boolean {
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] !== "[") continue;
    const prev = previousNonSpaceChar(code, i);
    if (prev !== "" && /[\w\])]/.test(prev)) continue;
    if (code.slice(i).includes("]")) return true;
  }
  return false;
}

/** A `[` that subscripts a name (or `]`/`)`), outside literals. */
function hasSubscriptBracket(code: string): boolean {
  for (let i = 0; i < code.length; i += 1) {
    if (code[i] !== "[") continue;
    const prev = previousNonSpaceChar(code, i);
    if (/[\w\])]/.test(prev)) return true;
  }
  return false;
}

const PYTHON_KEYWORDS = new Set([
  "def",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "return",
  "import",
  "from",
  "class",
  "with",
  "try",
  "except",
]);

const JAVA_CONTROL = new Set(["if", "for", "while", "switch", "catch", "return", "new"]);

function indentOf(code: string): number {
  const match = code.match(/^ */);
  return match ? match[0].length : 0;
}

function executedSetOf(executedLines: readonly number[] | undefined): Set<number> {
  return new Set(executedLines ?? []);
}

/** Cadet-defined Python function names (`def name(`) in the editable region. */
function pythonDefinedFunctions(entries: EditableLine[]): Map<string, number> {
  const defs = new Map<string, number>();
  for (const entry of entries) {
    const match = entry.code.match(/^\s*def\s+([A-Za-z_]\w*)\s*\(/);
    if (match) defs.set(match[1], entry.line);
  }
  return defs;
}

/** Python body lines of the `def` at index: deeper indent, blanks skipped. */
function pythonBodyLines(entries: EditableLine[], defIndex: number): EditableLine[] {
  const defIndent = indentOf(entries[defIndex].code);
  const body: EditableLine[] = [];
  for (let i = defIndex + 1; i < entries.length; i += 1) {
    if (entries[i].code.trim() === "") continue;
    if (indentOf(entries[i].code) <= defIndent) break;
    body.push(entries[i]);
  }
  return body;
}

/** Cadet-defined Java method names (`Type name(...) {`) in the editable region. */
function javaDefinedMethods(entries: EditableLine[]): Map<string, number> {
  const defs = new Map<string, number>();
  for (const entry of entries) {
    const match = entry.code.match(
      /^\s*(?:(?:public|private|protected|static|final|synchronized)\s+)*[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/,
    );
    if (match && !JAVA_CONTROL.has(match[1])) defs.set(match[1], entry.line);
  }
  return defs;
}

/** Java body lines of the method at index: brace depth from that line on. */
function javaBodyLines(entries: EditableLine[], defIndex: number): EditableLine[] {
  let depth = 0;
  const body: EditableLine[] = [];
  for (let i = defIndex; i < entries.length; i += 1) {
    for (const ch of entries[i].code) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
    }
    if (i === defIndex) continue;
    if (depth <= 0) break;
    body.push(entries[i]);
  }
  return body;
}

/**
 * Star 3: the Mission's Planet concept exists in Cadet-written editable code
 * and at least one such construct executes. Scaffold, comments, and string
 * literals never count (stripped before matching; scaffold sits outside the
 * markers). `variable` extends the ADR-0013 mapping: a Cadet assignment that
 * executes.
 */
export function checkConcept(
  concept: PlanetConceptId,
  language: "python" | "java",
  code: string,
  executedLines: readonly number[] | undefined,
): boolean {
  const entries = extractEditableLines(code, language);
  if (entries.length === 0) return false;
  const executed = executedSetOf(executedLines);
  if (executed.size === 0) return false;

  const executedEntry = (entry: EditableLine): boolean => executed.has(entry.line);

  if (concept === "loop") {
    const hits = entries.filter((entry) =>
      language === "python"
        ? /^\s*(for|while)\b/.test(entry.code)
        : /\b(for|while)\s*\(/.test(entry.code),
    );
    return hits.some(executedEntry);
  }

  if (concept === "conditional") {
    const hits = entries.filter((entry) =>
      language === "python"
        ? /^\s*(if|elif)\b/.test(entry.code)
        : /\b(if|switch)\s*\(/.test(entry.code) || (entry.code.includes("?") && entry.code.includes(":")),
    );
    return hits.some(executedEntry);
  }

  if (concept === "function") {
    if (language === "python") {
      const defs = pythonDefinedFunctions(entries);
      if (defs.size === 0) return false;
      for (const [name, defLine] of defs) {
        const defIndex = entries.findIndex((entry) => entry.line === defLine);
        if (defIndex === -1) continue;
        if (pythonBodyLines(entries, defIndex).some(executedEntry)) return true;
        const call = new RegExp(`\\b${name}\\s*\\(`);
        for (const entry of entries) {
          if (entry.line === defLine) continue;
          if (call.test(entry.code) && executed.has(entry.line)) return true;
        }
      }
      return false;
    }
    const defs = javaDefinedMethods(entries);
    if (defs.size === 0) return false;
    for (const [name, defLine] of defs) {
      const defIndex = entries.findIndex((entry) => entry.line === defLine);
      if (defIndex === -1) continue;
      if (javaBodyLines(entries, defIndex).some(executedEntry)) return true;
      const call = new RegExp(`\\b${name}\\s*\\(`);
      for (const entry of entries) {
        if (entry.line === defLine) continue;
        if (call.test(entry.code) && executed.has(entry.line)) return true;
      }
    }
    return false;
  }

  if (concept === "list") {
    let created = false;
    let accessed = false;
    let createdExecuted = false;
    let accessedExecuted = false;
    for (const entry of entries) {
      let entryCreated = hasLiteralBracket(entry.code);
      let entryAccessed = hasSubscriptBracket(entry.code);
      if (language === "java") {
        if (
          /new\s+ArrayList|ArrayList\s*<|List\s*<|Arrays\s*\.\s*asList|new\s+\w+.*\[/.test(entry.code)
        ) {
          entryCreated = true;
        }
        if (/\.get\s*\(|\.set\s*\(/.test(entry.code)) entryAccessed = true;
      }
      if (entryCreated) {
        created = true;
        if (executed.has(entry.line)) createdExecuted = true;
      }
      if (entryAccessed) {
        accessed = true;
        if (executed.has(entry.line)) accessedExecuted = true;
      }
    }
    return created && accessed && (createdExecuted || accessedExecuted);
  }

  // variable: a Cadet assignment that executes.
  for (const entry of entries) {
    const trimmed = entry.code.trim();
    if (trimmed === "") continue;
    const first = trimmed.split(/\s+/)[0];
    if (PYTHON_KEYWORDS.has(first)) {
      // `for`/`while` headers can carry `=` (e.g. `for i in range(3)` has
      // none, but augmented targets do); only plain indented assignment counts.
      if (language === "python" && (first === "for" || first === "while")) continue;
      if (language === "java" && JAVA_CONTROL.has(first)) continue;
    }
    const match =
      language === "python"
        ? entry.code.match(/^\s*([A-Za-z_]\w*)\s*(?:\+|-|\*|\/|%|\/\/|\*\*)?=\s*(?![=])/)
        : entry.code.match(
            /^\s*(?:(?:final\s+)?(?:int|long|double|float|boolean|char|String|var)\s+)?([A-Za-z_]\w*)\s*=\s*(?![=>])/,
          );
    if (!match) continue;
    if (language === "java" && JAVA_CONTROL.has(match[1])) continue;
    if (executed.has(entry.line)) return true;
  }
  return false;
}

/** Grade one Run snapshot across every Seed. Every Seed always grades. */
export function gradeRun(input: GradeRunInput): GraderResult {
  const practice = input.seeds.find((seed) => seed.isPractice) ?? input.seeds[0];

  const checks: GraderCheck[] = input.checks.map((check) => {
    const practiceOutcome = practice ? gradeOneSeed(check, practice) : { passed: false };
    let hiddenFailed = false;
    let allPassed = practiceOutcome.passed;
    for (const seed of input.seeds) {
      if (seed === practice) continue;
      const outcome = gradeOneSeed(check, seed);
      if (!outcome.passed) {
        hiddenFailed = true;
        allPassed = false;
      }
    }
    if (!practice) allPassed = false;
    return {
      id: check.id,
      label: check.label,
      timing: check.timing,
      passed: allPassed,
      ...(practiceOutcome.firstFailStep !== undefined
        ? { firstFailStep: practiceOutcome.firstFailStep }
        : {}),
      hiddenFail: practiceOutcome.passed && hiddenFailed,
    };
  });

  let stopReason: StopReason = "none";
  const practiceStopped = practice && practice.stop !== "none";
  if (practiceStopped) {
    stopReason = practice.stop;
  } else {
    const hiddenStop = input.seeds.find((seed) => seed !== practice && seed.stop !== "none");
    if (hiddenStop) stopReason = hiddenStop.stop;
  }

  const allChecksPass = checks.every((check) => check.passed);
  const pass = allChecksPass && stopReason === "none";

  if (input.isBossPartB === true) {
    return { pass, stars: 0, parMet: false, conceptMet: false, stopReason, checks };
  }

  const { stepsUsed, energySpent } = practiceNumbers(practice);
  const parMet =
    pass && stepsUsed <= input.par.maxSteps && energySpent <= input.par.maxEnergy;
  const conceptMet =
    pass && checkConcept(input.star3Concept, input.language, input.code, practice?.executedLines);
  const stars = ((pass ? 1 : 0) + (parMet ? 1 : 0) + (conceptMet ? 1 : 0)) as 0 | 1 | 2 | 3;
  return { pass, stars, parMet, conceptMet, stopReason, checks };
}

// -- Feedback: labels by timing, never layouts --

/** Fixed line when practice holds but a hidden Seed fails (no layout detail). */
export const ANTI_HARDCODE_LINE =
  "Works on this layout, but not on every layout. Make your code work when crystals and asteroids move.";

export interface FeedbackOptions {
  par: { maxSteps: number; maxEnergy: number };
  practiceStepsUsed: number;
  practiceEnergySpent: number;
  /** Planet concept name for the missed-Star 3 line. */
  conceptName: string;
}

function stopLine(stopReason: StopReason): string | null {
  switch (stopReason) {
    case "none":
      return null;
    case "error":
      return "Run stopped with an error. Fix the error line, then press Run again.";
    case "step-cap":
      return `Run stopped: too many Ship steps (cap ${MAX_SHIP_STEPS}). Use fewer Ship actions.`;
    case "event-cap":
      return `Run stopped: too many trace events (cap ${MAX_TRACE_EVENTS}). Use fewer executed lines.`;
    case "time-cap":
      return `Run stopped: took too long (cap ${MAX_WALL_SECONDS} s). Use fewer steps.`;
  }
}

/**
 * Cadet-facing feedback. Failed Runs name failed labels grouped by timing
 * (practice intermediates may name the first failing step) plus the stop
 * reason; hidden Seeds add only the fixed anti-hardcoding line. Passed Runs
 * name only missed Stars: practice Par numbers and the Planet concept.
 */
export function buildFeedback(result: GraderResult, options: FeedbackOptions): string[] {
  if (!result.pass) {
    const lines: string[] = [];
    const failedFinal = result.checks.filter((check) => !check.passed && check.timing === "final");
    const failedIntermediate = result.checks.filter(
      (check) => !check.passed && check.timing === "intermediate",
    );
    for (const check of failedFinal) lines.push(`Needs work (at the end): ${check.label}`);
    for (const check of failedIntermediate) {
      lines.push(
        check.firstFailStep !== undefined
          ? `Needs work (during the run): ${check.label} (first at step ${check.firstFailStep})`
          : `Needs work (during the run): ${check.label}`,
      );
    }
    const stop = stopLine(result.stopReason);
    if (stop) lines.push(stop);
    if (result.checks.some((check) => check.hiddenFail)) lines.push(ANTI_HARDCODE_LINE);
    return lines;
  }
  const lines: string[] = [];
  if (!result.parMet) {
    lines.push(
      `Star 2 (Par): used ${options.practiceStepsUsed} steps (Par ${options.par.maxSteps}) and ${options.practiceEnergySpent} energy (Par ${options.par.maxEnergy}).`,
    );
  }
  if (!result.conceptMet) {
    lines.push(`Star 3 (concept): use the Planet concept ${options.conceptName} in your code so it runs.`);
  }
  if (lines.length === 0) lines.push("All 3 Stars earned.");
  return lines;
}
