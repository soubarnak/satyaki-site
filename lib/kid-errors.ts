// Shared kid-error translator (issue #65, spec §5).
// Glossary: Cadet, Ship, Ship API, Mission, Playground, Creation,
// Share Link, Save Code. Pure core: no framework, DOM, or worker imports.
// Every runtime, builder, and import failure surfaces through this one
// module so no raw exception text ever reaches the UI.

/** Learner-facing language of the run that failed. */
export type KidLanguage = "python" | "java";

/** Raw failure input. Only `line` (and an allowlisted `call`) may surface. */
export interface KidErrorFrame {
  /** 1-based editor line; 0, negative, or non-numeric means unknown. */
  line?: unknown;
  /** Worker `excType` (UnknownShipName, SyntaxError, StepCap, ...). */
  excType?: unknown;
  /** Raw message: read for classification, never shown. */
  message?: unknown;
  /** Builder/Ship call name: echoed only when allowlisted. */
  call?: unknown;
}

/** Closed builder vocabulary (ADR-0014), both languages. Safe to echo. */
const BUILDER_CALLS: ReadonlySet<string> = new Set([
  "spawn_crystal",
  "spawn_asteroid_cracked",
  "spawn_asteroid_titanium",
  "spawn_switch",
  "spawn_gate",
  "spawn_portal",
  "spawn_drone",
  "spawn_crystal_ring",
  "set_ship_start",
  "set_ship_colour",
  "set_bounds",
  "spawnCrystal",
  "spawnAsteroidCracked",
  "spawnAsteroidTitanium",
  "spawnSwitch",
  "spawnGate",
  "spawnPortal",
  "spawnDrone",
  "spawnCrystalRing",
  "setShipStart",
  "setShipColour",
  "setBounds",
]);

/** Closed Ship colour palette (ADR-0014). */
export const SHIP_COLOURS = ["red", "blue", "green", "gold", "violet", "white"] as const;

function lineOf(frame: KidErrorFrame): number | null {
  const line = typeof frame.line === "number" ? frame.line : Number.NaN;
  return Number.isInteger(line) && line >= 1 ? line : null;
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Echo a call name only when it is closed-vocabulary. */
function safeCall(frame: KidErrorFrame): string | null {
  const call = textOf(frame.call);
  return call !== "" && BUILDER_CALLS.has(call) ? call : null;
}

function hasMarker(frame: KidErrorFrame, re: RegExp): boolean {
  return re.test(textOf(frame.excType)) || re.test(textOf(frame.message));
}

/** Every runtime/builder/cap class the translator renders. */
export type KidErrorKind =
  | "unknown-ship"
  | "arg-count"
  | "action-expression"
  | "syntax"
  | "unknown-name"
  | "subset"
  | "missing-main"
  | "wrong-type"
  | "index-range"
  | "divide-zero"
  | "read-only"
  | "builder-after-step"
  | "unknown-colour"
  | "builder-placement"
  | "builder-limit"
  | "builder-args"
  | "step-cap"
  | "event-cap"
  | "time-cap"
  | "code-too-long"
  | "runtime";

/** Map a raw frame to one error class. Reads raw text; never echoes it. */
export function classifyKidError(frame: KidErrorFrame): KidErrorKind {
  const excType = textOf(frame.excType);
  if (/^UnknownShipName$/i.test(excType) || /UnknownShipName/.test(textOf(frame.message))) return "unknown-ship";
  if (/^BuilderAfterStep$/i.test(excType) || /builder[^.]*after[^.]*ship action/i.test(textOf(frame.message))) {
    return "builder-after-step";
  }
  if (/^UnknownColou?r$/i.test(excType) || /unknown colou?r/i.test(textOf(frame.message))) return "unknown-colour";
  if (/^BuilderPlacement$/i.test(excType)) return "builder-placement";
  if (/^BuilderLimit$/i.test(excType)) return "builder-limit";
  if (/^BuilderArgs$/i.test(excType)) return "builder-args";
  if (/^ArgCount$/i.test(excType) || /takes .*arguments? \(|Wrong argument count/i.test(textOf(frame.message))) {
    const call = textOf(frame.call);
    if (call !== "" && BUILDER_CALLS.has(call)) return "builder-args";
    return "arg-count";
  }
  if (/^ActionInExpression$/i.test(excType)) return "action-expression";
  if (/^StepCap$/i.test(excType)) return "step-cap";
  if (/^EventCap$/i.test(excType)) return "event-cap";
  if (/^TimeCap$/i.test(excType)) return "time-cap";
  if (/^CodeTooLong$/i.test(excType)) return "code-too-long";
  if (/^(SyntaxError|IndentationError)$/i.test(excType)) return "syntax";
  if (/^(NameError|AttributeError|UnknownName)$/i.test(excType)) return "unknown-name";
  if (/^UnsupportedJava$/i.test(excType)) return "subset";
  if (/^No(Main|OnTick)$/i.test(excType)) return "missing-main";
  if (/^(IndexOutOfRange|IndexError|KeyError)$/i.test(excType)) return "index-range";
  if (/^(DivideByZero|ZeroDivisionError)$/i.test(excType)) return "divide-zero";
  if (/^ReadOnly$/i.test(excType)) return "read-only";
  if (/^(TypeError|ValueError|StringEquals)$/i.test(excType)) return "wrong-type";
  return "runtime";
}

/**
 * One kid sentence for a raw failure frame. Always names the editor line
 * when known; never includes raw exception text, class names, or
 * untrusted identifiers.
 */
export function translateKidError(frame: KidErrorFrame, language: KidLanguage = "python"): string {
  const line = lineOf(frame);
  const head = line === null ? "This run" : `Line ${line}`;
  const call = safeCall(frame);
  switch (classifyKidError(frame)) {
    case "unknown-ship":
      return `${head} uses a Ship name that does not exist; check the Ship API, Cadet.`;
    case "arg-count":
      return `${head} gives a Ship name the wrong number of values; Ship names take none except log, Cadet.`;
    case "action-expression":
      return `${head} must keep its Ship action on its own line, Cadet.`;
    case "syntax":
      return language === "java"
        ? `${head} cannot be read; check spelling, brackets, and semicolons, Cadet.`
        : `${head} cannot be read; check spelling, brackets, and colons, Cadet.`;
    case "unknown-name":
      return `${head} names something that does not exist; check the spelling, Cadet.`;
    case "subset":
      return `${head} uses Java outside the Cadet subset; rewrite it with the Planet blocks, Cadet.`;
    case "missing-main":
      return "The starter frame is missing; restore the given code and write inside it, Cadet.";
    case "wrong-type":
      return `${head} mixes up kinds of values; check numbers, text, and lists, Cadet.`;
    case "index-range":
      return `${head} reaches for a list item that is not there, Cadet.`;
    case "divide-zero":
      return `${head} divides by zero, which never works, Cadet.`;
    case "read-only":
      return `${head} tries to change the Ship or radar, which are read-only, Cadet.`;
    case "builder-after-step":
      return call === null
        ? `${head} builds the world after the Ship already moved; put every builder call at the very top, Cadet.`
        : `${head} (${call}) builds the world after the Ship already moved; put every builder call at the very top, Cadet.`;
    case "unknown-colour":
      return `${head} sets a Ship colour that does not exist; use ${SHIP_COLOURS.join(", ")}, Cadet.`;
    case "builder-placement":
      return `${head} tries to build on a blocked or taken square; pick an empty square, Cadet.`;
    case "builder-limit":
      return `${head} builds past the world limits; build smaller, Cadet.`;
    case "builder-args":
      return call === null
        ? `${head} gives a builder call the wrong values; check the builder list, Cadet.`
        : `${head} gives ${call} the wrong values; check the builder list, Cadet.`;
    case "step-cap":
      return `${head} ran past 500 Ship steps; use fewer Ship actions, Cadet.`;
    case "event-cap":
      return `${head} ran past 500 trace events; use fewer executed lines, Cadet.`;
    case "time-cap":
      return `${head} ran past the 3-second cap; use fewer steps, Cadet.`;
    case "code-too-long":
      return "This code is longer than 32,768 characters; shorten it, Cadet.";
    case "runtime":
      return `${head} hit a problem and stopped; fix that line, then press Run again, Cadet.`;
  }
}

/** One Playground banner for every failed Share Link import (ADR-0014). */
export function shareLinkBrokenLine(): string {
  return "This share link is broken; ask whoever sent it for a fresh link, Cadet.";
}

/** Save Code import failure reasons (progress record v2). */
export type SaveCodeFailure = "unknown-version" | "too-large" | "bad-checksum" | "bad-format" | "decompress-failed" | "invalid-json";

/** One kid sentence per Save Code import failure; never leaks internals. */
export function translateSaveCodeError(reason: SaveCodeFailure): string {
  switch (reason) {
    case "unknown-version":
      return "This Save Code comes from another version; export a fresh one, Cadet.";
    case "too-large":
      return "This Save Code is too big to read; export a fresh one, Cadet.";
    default:
      return "This Save Code cannot be read; check it and try again, Cadet.";
  }
}
