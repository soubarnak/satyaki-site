// Cadet Java interpreter over the `java-parser` CST (issue #64, spec §§3,5,9).
// Glossary: Ship, Ship API, World State, Seed. Pure core: no framework, DOM,
// or worker imports. Parses learner Java with `java-parser`, executes the
// bounded subset in `docs/cadet-java-subset.md` against the one in-worker
// ShipSim, and emits the same trace shape as the Python worker (issue #63).
// Parse failures and subset breaches are learner error frames with lines.

import { parse as parseJava } from "java-parser";
import {
  JAVA_NAMES,
  ShipSim,
  isStepName,
  type AuthoredLayout,
  type ErrorFrame,
  type ShipDelta,
} from "./ship-sim";
import { JAVA_MAX_TRACE_EVENTS, JAVA_MAX_WALL_SECONDS, JAVA_MAX_SHIP_STEPS } from "./java-worker-config";
import { JAVA_SHIP_NAMES, readShipSnapshotField, type ArenaRadarSnapshot } from "./java-worker-binding";
import { sanitizeJavaLocals, type JavaRunResult, type JavaStopReason, type JavaTraceEvent } from "./java-trace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cst = any;

const JAVA_NAME_SET = new Set<string>(JAVA_NAMES);
const JAVA_SHIP_SET = new Set<string>(JAVA_SHIP_NAMES);
const STEP_SET = new Set(["move", "turnLeft", "turnRight", "ascend", "descend", "laser", "harvest", "shield"]);
const SENSOR_SET = new Set([
  "scanAhead",
  "distanceAhead",
  "energy",
  "getX",
  "getY",
  "getZ",
  "heading",
  "crystals",
  "isShieldOn",
  "onCrystal",
]);
const PYTHON_TO_JAVA: Record<string, string> = {
  move: "move",
  turn_left: "turnLeft",
  turn_right: "turnRight",
  ascend: "ascend",
  descend: "descend",
  laser: "laser",
  harvest: "harvest",
  shield: "shield",
  log: "log",
  scan_ahead: "scanAhead",
  distance_ahead: "distanceAhead",
  energy: "energy",
  get_x: "getX",
  get_y: "getY",
  get_z: "getZ",
  heading: "heading",
  crystals: "crystals",
  is_shield_on: "isShieldOn",
  on_crystal: "onCrystal",
};

/** Learner-facing failure: becomes the result `error` frame, never a throw. */
class LearnerError extends Error {
  line: number;
  excType: string;
  constructor(line: number, excType: string, message: string) {
    super(message);
    this.line = line;
    this.excType = excType;
  }
}

class ReturnSignal {
  value: unknown;
  constructor(value: unknown) {
    this.value = value;
  }
}

class BreakSignal {}
class ContinueSignal {}

/** True when `java-parser` accepts the unit (subset checks happen at run). */
export function javaParses(code: string): boolean {
  try {
    parseJava(code);
    return true;
  } catch {
    return false;
  }
}

function syntaxLine(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const match = /line\s+(\d+)/i.exec(message);
  if (match) {
    const line = Number.parseInt(match[1], 10);
    if (Number.isFinite(line) && line >= 0) return line;
  }
  return 0;
}

interface Offsets {
  start: number;
  end: number;
  line: number;
}

function offsetsOf(node: Cst): Offsets {
  const loc = node?.location as { startOffset?: unknown; endOffset?: unknown; startLine?: unknown } | undefined;
  const line = typeof loc?.startLine === "number" ? loc.startLine : 0;
  if (typeof loc?.startOffset === "number" && typeof loc?.endOffset === "number") {
    return { start: loc.startOffset, end: loc.endOffset + 1, line };
  }
  return { start: 0, end: 0, line };
}

function sliceOf(code: string, node: Cst): string {
  const { start, end } = offsetsOf(node);
  if (end > start) return code.slice(start, end);
  return "";
}

function child(node: Cst, name: string): Cst | undefined {
  const list = node?.children?.[name] as Cst[] | undefined;
  return list?.[0];
}

function children(node: Cst, name: string): Cst[] {
  return (node?.children?.[name] as Cst[] | undefined) ?? [];
}

function tokenImage(node: Cst, name: string): string | undefined {
  return (node?.children?.[name] as Array<{ image?: string }> | undefined)?.[0]?.image;
}

/** Lexical scope chain; methods live separately, never in scope. */
class Scope {
  vars = new Map<string, unknown>();
  constructor(readonly parent: Scope | null = null) {}

  define(name: string, value: unknown): void {
    this.vars.set(name, value);
  }

  assign(name: string, value: unknown): boolean {
    if (this.vars.has(name)) {
      this.vars.set(name, value);
      return true;
    }
    if (this.parent) return this.parent.assign(name, value);
    return false;
  }

  lookup(name: string): { found: boolean; value?: unknown } {
    if (this.vars.has(name)) return { found: true, value: this.vars.get(name) };
    if (this.parent) return this.parent.lookup(name);
    return { found: false };
  }

  snapshot(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const chain: Scope[] = [this];
    let parent: Scope | null = this.parent;
    while (parent) {
      chain.unshift(parent);
      parent = parent.parent;
    }
    for (const scope of chain) {
      for (const [key, value] of scope.vars) out[key] = toLocalValue(value);
    }
    return out;
  }
}

function toLocalValue(value: unknown): unknown {
  if (value !== null && typeof value === "object" && "__arrayItems" in (value as Record<string, unknown>)) {
    return [...((value as unknown as { __arrayItems: unknown[] }).__arrayItems)];
  }
  if (value !== null && typeof value === "object" && "__host" in (value as Record<string, unknown>)) {
    return undefined;
  }
  return value;
}

interface MethodDef {
  name: string;
  params: string[];
  body: Cst;
  line: number;
}

interface Runner {
  code: string;
  sim: ShipSim;
  scope: Scope;
  methods: Map<string, MethodDef>;
  trace: JavaTraceEvent[];
  stdout: string;
  stepsUsed: number;
  pendingDelta: ShipDelta | null;
  pendingLog: string | null;
  startedAt: number;
  maxSteps: number;
  maxEvents: number;
  maxWallMs: number;
  radar: ArenaRadarSnapshot | null;
  calls: number;
  arenaTick: boolean;
}

function checkClock(runner: Runner, line: number): void {
  if (Date.now() - runner.startedAt > runner.maxWallMs) {
    throw new LearnerError(line, "TimeCap", "3 s wall-clock budget exceeded.");
  }
}

function emitEvent(runner: Runner, line: number): void {
  checkClock(runner, line);
  if (runner.trace.length >= runner.maxEvents) {
    throw new LearnerError(line, "EventCap", "Too many trace events.");
  }
  runner.trace.push({
    step: runner.stepsUsed,
    line,
    kind: "line",
    locals: sanitizeJavaLocals(runner.scope.snapshot(), JAVA_SHIP_SET),
    shipDelta: runner.pendingDelta,
    ...(runner.pendingLog !== null ? { log: runner.pendingLog } : {}),
  });
  runner.pendingDelta = null;
  runner.pendingLog = null;
}

function runShipCall(runner: Runner, name: string, args: unknown[], line: number, allowAction: boolean): unknown {
  if (runner.arenaTick) {
    throw new LearnerError(line, "ActionInExpression", `Ship call ${name}() never runs inside onTick; return one action string.`);
  }
  if (STEP_SET.has(name) && !allowAction) {
    throw new LearnerError(line, "ActionInExpression", `Ship action ${name}() runs only as its own line.`);
  }
  if (runner.stepsUsed >= runner.maxSteps && isStepName(name)) {
    throw new LearnerError(line, "StepCap", "500 Ship-step budget exceeded.");
  }
  const result = runner.sim.call(name, args, line);
  if (!result.ok) {
    throw new LearnerError(result.error.line || line, result.error.excType, result.error.message);
  }
  if (name === "log") {
    const text = typeof args[0] === "string" ? args[0] : JSON.stringify(args[0]);
    const capped = typeof text === "string" ? text.slice(0, 200) : String(text);
    runner.pendingLog = runner.pendingLog === null ? capped : `${runner.pendingLog}\n${capped}`;
    return result.value;
  }
  if (isStepName(name) && result.delta) {
    runner.stepsUsed += 1;
    runner.pendingDelta = result.delta;
    return result.delta;
  }
  return result.value;
}

function unknownNameError(runner: Runner, name: string, line: number): LearnerError {
  const hint = Object.entries(PYTHON_TO_JAVA).find(([py]) => py === name);
  if (hint) {
    return new LearnerError(line, "UnknownShipName", `Unknown Ship name: ${name}. Use ${hint[1]} in Java.`);
  }
  if (JAVA_NAME_SET.has(name)) {
    return new LearnerError(line, "UnknownShipName", `Unknown Ship name: ${name}.`);
  }
  return new LearnerError(line, "UnknownName", `Unknown name: ${name}.`);
}

function findMainClass(cst: Cst): Cst {
  const units = children(cst, "ordinaryCompilationUnit");
  const root = units.length > 0 ? units[0] : cst;
  const decls = children(root, "typeDeclaration");
  if (decls.length === 0) throw new LearnerError(0, "SyntaxError", "No class found. Write public class Main.");
  let fallback: Cst | null = null;
  for (const decl of decls) {
    const classDecl = child(decl, "classDeclaration");
    const normal = classDecl ? child(classDecl, "normalClassDeclaration") : undefined;
    if (!normal) continue;
    const typeId = child(normal, "typeIdentifier");
    const name = tokenImage(typeId, "Identifier") ?? "";
    if (fallback === null) fallback = normal;
    if (name === "Main") return normal;
  }
  if (fallback) return fallback;
  throw new LearnerError(0, "SyntaxError", "No class found. Write public class Main.");
}

function methodNameOf(methodDecl: Cst): string {
  const header = child(methodDecl, "methodHeader");
  const declarator = header ? child(header, "methodDeclarator") : undefined;
  return tokenImage(declarator, "Identifier") ?? "";
}

function methodParamsOf(methodDecl: Cst): string[] {
  const header = child(methodDecl, "methodHeader");
  const declarator = header ? child(header, "methodDeclarator") : undefined;
  const list = declarator ? child(declarator, "formalParameterList") : undefined;
  if (!list) return [];
  const params: string[] = [];
  const walk = (node: Cst): void => {
    if (!node?.children) return;
    for (const [key, values] of Object.entries(node.children as Record<string, Cst[]>)) {
      if (key === "variableDeclaratorId") {
        const id = tokenImage(values[0], "Identifier");
        if (id) params.push(id);
        continue;
      }
      for (const value of values) walk(value);
    }
  };
  walk(list);
  return params;
}

function collectMethods(mainClass: Cst, code: string): Map<string, MethodDef> {
  const methods = new Map<string, MethodDef>();
  const body = child(mainClass, "classBody");
  for (const member of children(body, "classBodyDeclaration")) {
    const memberDecl = child(member, "classMemberDeclaration");
    const methodDecl = memberDecl ? child(memberDecl, "methodDeclaration") : undefined;
    if (!methodDecl) {
      const line = offsetsOf(member).line;
      throw new LearnerError(line, "UnsupportedJava", "Only methods live inside Main. Fields and initializers are outside the subset.");
    }
    const name = methodNameOf(methodDecl);
    const methodBody = child(methodDecl, "methodBody");
    const block = methodBody ? child(methodBody, "block") : undefined;
    if (!name || !block) {
      const line = offsetsOf(methodDecl).line;
      throw new LearnerError(line, "UnsupportedJava", "Methods need a name and a body block.");
    }
    if (!methods.has(name)) {
      methods.set(name, { name, params: methodParamsOf(methodDecl), body: block, line: offsetsOf(methodDecl).line });
    }
  }
  void code;
  return methods;
}

function execBlock(block: Cst, runner: Runner): void {
  const statements = child(block, "blockStatements");
  if (!statements) return;
  for (const item of children(statements, "blockStatement")) {
    execBlockStatement(item, runner);
  }
}

function execBlockStatement(node: Cst, runner: Runner): void {
  checkClock(runner, offsetsOf(node).line);
  const local = child(node, "localVariableDeclarationStatement");
  if (local) {
    execVarDecl(runner.code, local, runner);
    return;
  }
  const statement = child(node, "statement");
  if (statement) {
    execStatement(statement, runner);
    return;
  }
  throw new LearnerError(offsetsOf(node).line, "UnsupportedJava", "That block shape is outside the Cadet subset.");
}

function execStatement(node: Cst, runner: Runner): void {
  const kinds = Object.keys(node.children ?? {});
  if (kinds.length === 0) return;
  const kind = kinds[0];
  const inner = children(node, kind)[0];
  switch (kind) {
    case "statementWithoutTrailingSubstatement":
      execPlain(inner, runner);
      return;
    case "ifStatement":
      execIf(inner, runner);
      return;
    case "forStatement":
      execFor(inner, runner);
      return;
    case "whileStatement": {
      const line = offsetsOf(inner).line;
      for (;;) {
        emitEvent(runner, line);
        const test = evalSlice(runner, sliceOf(runner.code, children(inner, "expression")[0]), line, false);
        requireBoolean(test, line);
        if (!test) break;
        try {
          execStatement(children(inner, "statement")[0], runner);
        } catch (error) {
          if (error instanceof BreakSignal) break;
          if (error instanceof ContinueSignal) continue;
          throw error;
        }
      }
      return;
    }
    case "doStatement": {
      const line = offsetsOf(inner).line;
      for (;;) {
        emitEvent(runner, line);
        try {
          execStatement(children(inner, "statement")[0], runner);
        } catch (error) {
          if (error instanceof BreakSignal) break;
          if (!(error instanceof ContinueSignal)) throw error;
        }
        const test = evalSlice(runner, sliceOf(runner.code, children(inner, "expression")[0]), line, false);
        requireBoolean(test, line);
        if (!test) break;
      }
      return;
    }
    case "switchStatement":
      execSwitch(inner, runner);
      return;
    case "labeledStatement":
      throw new LearnerError(offsetsOf(inner).line, "UnsupportedJava", "Labels are outside the Cadet subset.");
    default:
      throw new LearnerError(offsetsOf(node).line, "UnsupportedJava", `That statement is outside the Cadet subset.`);
  }
}

function execPlain(node: Cst, runner: Runner): void {
  const kinds = Object.keys(node.children ?? {});
  if (kinds.length === 0) return;
  const kind = kinds[0];
  const inner = children(node, kind)[0];
  switch (kind) {
    case "expressionStatement":
      execExpressionStatement(runner.code, inner, runner);
      return;
    case "block":
      execBlock(inner, runner);
      return;
    case "emptyStatement":
      return;
    case "returnStatement": {
      const line = offsetsOf(inner).line;
      emitEvent(runner, line);
      const exprs = children(inner, "expression");
      const value = exprs.length > 0 ? evalSlice(runner, sliceOf(runner.code, exprs[0]), line, false) : undefined;
      throw new ReturnSignal(value);
    }
    case "breakStatement": {
      emitEvent(runner, offsetsOf(inner).line);
      throw new BreakSignal();
    }
    case "continueStatement": {
      emitEvent(runner, offsetsOf(inner).line);
      throw new ContinueSignal();
    }
    case "ifStatement":
      execIf(inner, runner);
      return;
    case "forStatement":
      execFor(inner, runner);
      return;
    case "whileStatement":
    case "doStatement":
    case "switchStatement":
      execStatement({ children: { [kind]: [inner] }, location: inner.location } as Cst, runner);
      return;
    default:
      throw new LearnerError(offsetsOf(node).line, "UnsupportedJava", "That statement is outside the Cadet subset (no try, throw, or synchronized).");
  }
}

function execIf(node: Cst, runner: Runner): void {
  const line = offsetsOf(node).line;
  emitEvent(runner, line);
  const test = evalSlice(runner, sliceOf(runner.code, children(node, "expression")[0]), line, false);
  requireBoolean(test, line);
  const branches = children(node, "statement");
  if (test) {
    execStatement(branches[0], runner);
  } else if (branches.length > 1) {
    execStatement(branches[1], runner);
  }
}

function execFor(node: Cst, runner: Runner): void {
  const basic = child(node, "basicForStatement");
  if (basic) {
    execBasicFor(basic, runner);
    return;
  }
  const enhanced = child(node, "enhancedForStatement");
  if (enhanced) {
    execEnhancedFor(enhanced, runner);
    return;
  }
  throw new LearnerError(offsetsOf(node).line, "UnsupportedJava", "That for shape is outside the Cadet subset.");
}

function execBasicFor(node: Cst, runner: Runner): void {
  const line = offsetsOf(node).line;
  const loopScope = new Scope(runner.scope);
  const outer = runner.scope;
  runner.scope = loopScope;
  try {
    const init = child(node, "forInit");
    if (init) execForInit(runner.code, init, runner);
    for (;;) {
      emitEvent(runner, line);
      const conds = children(node, "expression");
      if (conds.length > 0) {
        const test = evalSlice(runner, sliceOf(runner.code, conds[0]), line, false);
        requireBoolean(test, line);
        if (!test) break;
      }
      try {
        execStatement(children(node, "statement")[0], runner);
      } catch (error) {
        if (error instanceof BreakSignal) break;
        if (error instanceof ContinueSignal) {
          // Run the update, then continue.
        } else {
          throw error;
        }
      }
      const update = child(node, "forUpdate");
      if (update) {
        const list = sliceOf(runner.code, update);
        execUpdateList(runner, list, line);
      }
    }
  } finally {
    runner.scope = outer;
  }
}

function execEnhancedFor(node: Cst, runner: Runner): void {
  const line = offsetsOf(node).line;
  const decl = child(node, "localVariableDeclaration");
  const iterable = sliceOf(runner.code, children(node, "expression")[0]);
  const value = evalSlice(runner, iterable, line, false);
  const items = toArrayItems(value, line);
  const names = declNames(decl);
  if (names.length !== 1) throw new LearnerError(line, "UnsupportedJava", "Enhanced for takes one loop variable.");
  const outer = runner.scope;
  try {
    for (const item of items) {
      const loopScope = new Scope(outer);
      loopScope.define(names[0], item);
      runner.scope = loopScope;
      emitEvent(runner, line);
      try {
        execStatement(children(node, "statement")[0], runner);
      } catch (error) {
        if (error instanceof BreakSignal) break;
        if (error instanceof ContinueSignal) continue;
        throw error;
      }
    }
  } finally {
    runner.scope = outer;
  }
}

function execSwitch(node: Cst, runner: Runner): void {
  const line = offsetsOf(node).line;
  emitEvent(runner, line);
  const discriminant = evalSlice(runner, sliceOf(runner.code, children(node, "expression")[0]), line, false);
  const block = child(node, "switchBlock");
  const groups = block ? children(block, "switchBlockStatementGroup") : [];
  let matched = false;
  let entered = false;
  for (const group of groups) {
    const labels = children(group, "switchLabel");
    if (!entered) {
      for (const label of labels) {
        if (isDefaultLabel(label)) {
          if (!matched) entered = true;
          continue;
        }
        const constantNode = child(label, "caseConstant") ?? child(label, "expression") ?? label;
        const constant = evalSlice(runner, sliceOf(runner.code, constantNode), line, false);
        if (!matched && looseEquals(discriminant, constant)) {
          matched = true;
          entered = true;
        }
      }
    }
    if (!entered) continue;
    const statements = child(group, "blockStatements");
    if (!statements) continue;
    try {
      for (const item of children(statements, "blockStatement")) {
        execBlockStatement(item, runner);
      }
    } catch (error) {
      if (error instanceof BreakSignal) return;
      throw error;
    }
  }
}

function isDefaultLabel(label: Cst): boolean {
  const images: string[] = [];
  const walk = (node: Cst): void => {
    if (!node?.children) return;
    for (const [key, values] of Object.entries(node.children as Record<string, Cst[] | Array<{ image?: string }>>)) {
      for (const value of values as Cst[]) {
        const token = value as unknown as { image?: string };
        if (typeof token.image === "string") images.push(token.image);
        else walk(value);
        void key;
      }
    }
  };
  walk(label);
  return images.includes("default");
}

function looseEquals(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  return a === b;
}

function requireBoolean(value: unknown, line: number): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new LearnerError(line, "TypeError", "That check needs a true/false answer.");
  }
}

// ---------------------------------------------------------------------------
// Mini statement parsing (expression-statement slices, for init/update)
// ---------------------------------------------------------------------------

type TargetAst = { kind: "var"; name: string } | { kind: "index"; arr: string; index: string } | { kind: "field"; obj: string; field: string };

type MiniStmt =
  | { kind: "call"; obj: string | null; name: string; args: string[] }
  | { kind: "assign"; target: TargetAst; op: string; value: string }
  | { kind: "inc"; target: TargetAst; delta: number }
  | { kind: "bare"; expr: string };

function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== null) {
      current += ch;
      if (ch === "\\") {
        if (i + 1 < text.length) {
          current += text[i + 1];
          i += 1;
        }
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
}

function findTopLevelEquals(text: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== null) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth += 1;
    else if (ch === ")" || ch === "]" || ch === "}") depth -= 1;
    if (depth !== 0) continue;
    const next = text[i + 1];
    if (ch === "=" && next !== "=") return i;
    if ((ch === "!" || ch === "<" || ch === ">") && next === "=") {
      i += 1;
      continue;
    }
    if (ch === "=" && next === "=") {
      i += 1;
      continue;
    }
  }
  return -1;
}

function parseTarget(text: string, line: number): TargetAst {
  const s = text.trim();
  if (s.endsWith("]")) {
    const open = s.lastIndexOf("[");
    if (open === -1) throw new LearnerError(line, "SyntaxError", `Bad target: ${s}.`);
    const arr = s.slice(0, open).trim();
    const index = s.slice(open + 1, s.length - 1).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(arr) || index.length === 0) {
      throw new LearnerError(line, "SyntaxError", `Bad target: ${s}.`);
    }
    return { kind: "index", arr, index };
  }
  const dot = s.lastIndexOf(".");
  if (dot !== -1) {
    const obj = s.slice(0, dot).trim();
    const field = s.slice(dot + 1).trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(obj) || !/^[A-Za-z_$][\w$]*$/.test(field)) {
      throw new LearnerError(line, "SyntaxError", `Bad target: ${s}.`);
    }
    return { kind: "field", obj, field };
  }
  if (!/^[A-Za-z_$][\w$]*$/.test(s)) throw new LearnerError(line, "SyntaxError", `Bad target: ${s}.`);
  return { kind: "var", name: s };
}

function parseMiniStmt(src: string, line: number): MiniStmt {
  const s = src.trim().replace(/;\s*$/, "").trim();
  if (s.length === 0) return { kind: "bare", expr: "" };
  const match = /^(\+\+|--)\s*([A-Za-z_$][\w$]*)$/.exec(s) ?? /^([A-Za-z_$][\w$]*)\s*(\+\+|--)$/.exec(s);
  if (match) {
    const inc = s.startsWith("++") || s.endsWith("++");
    const name = (match[1].startsWith("+") || match[1].startsWith("-") ? match[2] : match[1]) as string;
    return { kind: "inc", target: { kind: "var", name }, delta: inc ? 1 : -1 };
  }
  const indexInc = /^([A-Za-z_$][\w$]*\s*\[[^\]]+\])\s*(\+\+|--)$/.exec(s);
  if (indexInc) {
    return { kind: "inc", target: parseTarget(indexInc[1], line), delta: indexInc[2] === "++" ? 1 : -1 };
  }
  const eq = findTopLevelEquals(s);
  if (eq !== -1) {
    let op = "=";
    let left = s.slice(0, eq).trim();
    if (/[+\-*/%]$/.test(left)) {
      const maybe = left.slice(-1);
      if (maybe === "&" || maybe === "|" || maybe === "^") {
        throw new LearnerError(line, "UnsupportedJava", "That operator is outside the Cadet subset.");
      }
      op = `${maybe}=`;
      left = left.slice(0, -1).trim();
    } else if (/^[&|^]$/.test(s[eq - 1] ?? "")) {
      throw new LearnerError(line, "UnsupportedJava", "That operator is outside the Cadet subset.");
    }
    const value = s.slice(eq + 1).trim();
    if (value.length === 0) throw new LearnerError(line, "SyntaxError", "Missing value after =.");
    return { kind: "assign", target: parseTarget(left, line), op, value };
  }
  const callOpen = s.indexOf("(");
  if (s.endsWith(")") && callOpen !== -1) {
    const callee = s.slice(0, callOpen).trim();
    const inner = s.slice(callOpen + 1, s.length - 1);
    const dot = callee.lastIndexOf(".");
    if (dot !== -1) {
      return { kind: "call", obj: callee.slice(0, dot).trim(), name: callee.slice(dot + 1).trim(), args: splitTopLevel(inner, ",").map((a) => a.trim()).filter((a) => a.length > 0 || inner.trim().length > 0) };
    }
    if (!/^[A-Za-z_$][\w$]*$/.test(callee)) throw new LearnerError(line, "SyntaxError", `Bad call: ${s}.`);
    const args = inner.trim().length === 0 ? [] : splitTopLevel(inner, ",").map((a) => a.trim());
    return { kind: "call", obj: null, name: callee, args };
  }
  return { kind: "bare", expr: s };
}

function readTarget(runner: Runner, target: TargetAst, line: number): unknown {
  if (target.kind === "var") {
    const found = runner.scope.lookup(target.name);
    if (!found.found) throw unknownNameError(runner, target.name, line);
    return found.value;
  }
  if (target.kind === "index") {
    const base = runner.scope.lookup(target.arr);
    if (!base.found) throw unknownNameError(runner, target.arr, line);
    const items = toArrayItems(base.value, line);
    const index = evalSlice(runner, target.index, line, false);
    if (typeof index !== "number" || !Number.isInteger(index)) {
      throw new LearnerError(line, "TypeError", "List indexes are whole numbers.");
    }
    if (index < 0 || index >= items.length) throw new LearnerError(line, "IndexOutOfRange", `Index ${index} is outside the list.`);
    return items[index];
  }
  throw new LearnerError(line, "ReadOnly", `Ship field ${target.obj}.${target.field} is read-only.`);
}

function writeTarget(runner: Runner, target: TargetAst, value: unknown, line: number): void {
  if (target.kind === "var") {
    if (!runner.scope.assign(target.name, value)) throw unknownNameError(runner, target.name, line);
    return;
  }
  if (target.kind === "index") {
    const base = runner.scope.lookup(target.arr);
    if (!base.found) throw unknownNameError(runner, target.arr, line);
    const items = toArrayItems(base.value, line);
    const index = evalSlice(runner, target.index, line, false);
    if (typeof index !== "number" || !Number.isInteger(index)) {
      throw new LearnerError(line, "TypeError", "List indexes are whole numbers.");
    }
    if (index < 0 || index >= items.length) throw new LearnerError(line, "IndexOutOfRange", `Index ${index} is outside the list.`);
    items[index] = value;
    return;
  }
  throw new LearnerError(line, "ReadOnly", `Ship field ${target.obj}.${target.field} is read-only.`);
}

function applyAssignOp(op: string, current: unknown, value: unknown, line: number): unknown {
  if (op === "=") return value;
  if (op === "+=" && (typeof current === "string" || typeof value === "string")) {
    return `${asString(current)}${asString(value)}`;
  }
  if (typeof current !== "number" || typeof value !== "number") {
    throw new LearnerError(line, "TypeError", "That operator needs numbers.");
  }
  switch (op) {
    case "+=":
      return current + value;
    case "-=":
      return current - value;
    case "*=":
      return current * value;
    case "/=":
      return divideNumbers(current, value, line);
    case "%=":
      return current % value;
    default:
      throw new LearnerError(line, "UnsupportedJava", "That operator is outside the Cadet subset.");
  }
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "null";
  return String(value);
}

function execMiniStmt(runner: Runner, stmt: MiniStmt, line: number, emit: boolean): void {
  switch (stmt.kind) {
    case "bare":
      if (stmt.expr.length > 0) evalSlice(runner, stmt.expr, line, false);
      break;
    case "call":
      execCallStmt(runner, stmt.obj, stmt.name, stmt.args, line);
      break;
    case "assign": {
      const value = evalSlice(runner, stmt.value, line, false);
      if (stmt.op === "=") {
        writeTarget(runner, stmt.target, value, line);
      } else {
        writeTarget(runner, stmt.target, applyAssignOp(stmt.op, readTarget(runner, stmt.target, line), value, line), line);
      }
      break;
    }
    case "inc": {
      const current = readTarget(runner, stmt.target, line);
      if (typeof current !== "number") throw new LearnerError(line, "TypeError", "++ and -- need a number.");
      writeTarget(runner, stmt.target, current + stmt.delta, line);
      break;
    }
  }
  if (emit) emitEvent(runner, line);
}

function execCallStmt(runner: Runner, obj: string | null, name: string, argSources: string[], line: number): void {
  if (obj === null) {
    if (name === "log" || SENSOR_SET.has(name) || STEP_SET.has(name)) {
      const args = argSources.map((a) => evalSlice(runner, a, line, false));
      runShipCall(runner, name, args, line, true);
      return;
    }
    if (runner.methods.has(name)) {
      const args = argSources.map((a) => evalSlice(runner, a, line, false));
      callMethod(runner, name, args, line);
      return;
    }
    throw unknownNameError(runner, name, line);
  }
  const baseLookup = runner.scope.lookup(obj);
  if (!baseLookup.found) throw unknownNameError(runner, obj, line);
  const args = argSources.map((a) => evalSlice(runner, a, line, false));
  evalObjCall(runner, baseLookup.value, name, args, line, true);
}

function execExpressionStatement(code: string, node: Cst, runner: Runner): void {
  const line = offsetsOf(node).line;
  const text = sliceOf(code, node).trim().replace(/;\s*$/, "").trim();
  if (text.length === 0) return;
  execMiniStmt(runner, parseMiniStmt(text, line), line, true);
}

function execVarDecl(code: string, node: Cst, runner: Runner): void {
  const line = offsetsOf(node).line;
  const decl = child(node, "localVariableDeclaration");
  if (!decl) throw new LearnerError(line, "SyntaxError", "Bad variable declaration.");
  const typeText = decl ? sliceOf(code, children(decl, "localVariableType")[0]).trim() : "";
  checkDeclType(typeText, line);
  const list = child(decl, "variableDeclaratorList");
  if (!list) throw new LearnerError(line, "SyntaxError", "Bad variable declaration.");
  for (const declarator of children(list, "variableDeclarator")) {
    const id = child(declarator, "variableDeclaratorId");
    const name = id ? tokenImage(id, "Identifier") : undefined;
    if (!name) throw new LearnerError(line, "SyntaxError", "Bad variable declaration.");
    const inits = children(declarator, "variableInitializer");
    const value = inits.length > 0 ? evalSlice(runner, sliceOf(code, inits[0]), line, false) : defaultForType(typeText, line);
    runner.scope.define(name, value);
  }
  emitEvent(runner, line);
}

function checkDeclType(typeText: string, line: number): void {
  const t = typeText.replace(/\s+/g, " ").trim();
  const ok =
    /^(int|double|String|boolean)(\s*\[\s*\])?$/.test(t) ||
    /^ArrayList\s*<.*>$/.test(t) ||
    /^(Ship|Radar)(\s*\[\s*\])?$/.test(t);
  if (!ok) throw new LearnerError(line, "UnsupportedJava", `Type ${t || "?"} is outside the Cadet subset.`);
}

function defaultForType(typeText: string, line: number): unknown {
  const t = typeText.replace(/\s+/g, "");
  if (t === "int" || t === "double") return 0;
  if (t === "boolean") return false;
  if (t === "String") return null;
  if (t.endsWith("[]")) return makeArray([]);
  if (t.startsWith("ArrayList")) return makeArray([]);
  throw new LearnerError(line, "UnsupportedJava", `Type ${typeText} needs a starting value.`);
}

function declNames(decl: Cst | undefined): string[] {
  if (!decl) return [];
  const names: string[] = [];
  const walk = (node: Cst): void => {
    if (!node?.children) return;
    for (const [key, values] of Object.entries(node.children as Record<string, Cst[]>)) {
      if (key === "variableDeclaratorId") {
        const id = tokenImage(values[0], "Identifier");
        if (id) names.push(id);
        continue;
      }
      for (const value of values) walk(value);
    }
  };
  const list = child(decl, "variableDeclaratorList");
  if (list) walk(list);
  return names;
}

function execForInit(code: string, node: Cst, runner: Runner): void {
  const decl = child(node, "localVariableDeclaration");
  if (decl) {
    const line = offsetsOf(node).line;
    const typeText = sliceOf(code, children(decl, "localVariableType")[0]).trim();
    checkDeclType(typeText, line);
    const list = child(decl, "variableDeclaratorList");
    if (!list) throw new LearnerError(line, "SyntaxError", "Bad for-loop start.");
    for (const declarator of children(list, "variableDeclarator")) {
      const id = child(declarator, "variableDeclaratorId");
      const name = id ? tokenImage(id, "Identifier") : undefined;
      if (!name) throw new LearnerError(line, "SyntaxError", "Bad for-loop start.");
      const inits = children(declarator, "variableInitializer");
      runner.scope.define(name, inits.length > 0 ? evalSlice(runner, sliceOf(code, inits[0]), line, false) : defaultForType(typeText, line));
    }
    return;
  }
  const list = child(node, "statementExpressionList");
  if (list) {
    execUpdateList(runner, sliceOf(code, list), offsetsOf(node).line);
    return;
  }
  throw new LearnerError(offsetsOf(node).line, "SyntaxError", "Bad for-loop start.");
}

function execUpdateList(runner: Runner, src: string, line: number): void {
  for (const part of splitTopLevel(src, ",")) {
    const text = part.trim();
    if (text.length === 0) continue;
    execMiniStmt(runner, parseMiniStmt(text, line), line, false);
  }
}

// ---------------------------------------------------------------------------
// Values: arrays, hosts
// ---------------------------------------------------------------------------

interface ArrayValue {
  __arrayItems: unknown[];
}

function makeArray(items: unknown[]): ArrayValue {
  return { __arrayItems: items };
}

function isArrayValue(value: unknown): value is ArrayValue {
  return typeof value === "object" && value !== null && "__arrayItems" in (value as Record<string, unknown>);
}

function toArrayItems(value: unknown, line: number): unknown[] {
  if (isArrayValue(value)) return value.__arrayItems;
  throw new LearnerError(line, "TypeError", "That loop needs a list.");
}

interface ShipHost {
  __host: "ship";
}

interface RadarHost {
  __host: "radar";
  data: ArenaRadarSnapshot;
}

function evalObjCall(runner: Runner, base: unknown, method: string, args: unknown[], line: number, allowAction: boolean): unknown {
  void allowAction;
  if (typeof base === "string") {
    if (method === "equals" && args.length === 1) return base === asString(args[0]);
    if (method === "length" && args.length === 0) return base.length;
    throw new LearnerError(line, "UnknownName", `Unknown call: String.${method}.`);
  }
  if (isArrayValue(base)) {
    if (method === "add" && args.length === 1) {
      base.__arrayItems.push(args[0]);
      return null;
    }
    if (method === "get" && args.length === 1) {
      const index = requireInt(args[0], line);
      if (index < 0 || index >= base.__arrayItems.length) {
        throw new LearnerError(line, "IndexOutOfRange", `Index ${index} is outside the list.`);
      }
      return base.__arrayItems[index];
    }
    if (method === "set" && args.length === 2) {
      const index = requireInt(args[0], line);
      if (index < 0 || index >= base.__arrayItems.length) {
        throw new LearnerError(line, "IndexOutOfRange", `Index ${index} is outside the list.`);
      }
      base.__arrayItems[index] = args[1];
      return null;
    }
    if (method === "size" && args.length === 0) return base.__arrayItems.length;
    throw new LearnerError(line, "UnknownName", `Unknown call: list.${method}.`);
  }
  throw new LearnerError(line, "TypeError", "That call needs a list or a String.");
}

function requireInt(value: unknown, line: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new LearnerError(line, "TypeError", "That needs a whole number.");
  }
  return value;
}

function divideNumbers(a: number, b: number, line: number): number {
  if (b === 0) throw new LearnerError(line, "DivideByZero", "Dividing by zero stops the run.");
  if (Number.isInteger(a) && Number.isInteger(b)) return Math.trunc(a / b);
  return a / b;
}

// ---------------------------------------------------------------------------
// Expression tokenizer, parser (AST), evaluator
// ---------------------------------------------------------------------------

type Token =
  | { kind: "number"; text: string; value: number }
  | { kind: "string"; text: string; value: string }
  | { kind: "ident"; text: string }
  | { kind: "op"; text: string };

function tokenizeExpr(src: string, line: number): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const ops = ["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "+", "-", "*", "/", "%", "<", ">", "!", "=", "?", ":", ".", ",", ";", "(", ")", "[", "]", "{", "}"];
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"') {
      let out = "";
      let j = i + 1;
      let closed = false;
      while (j < src.length) {
        const c = src[j];
        if (c === "\\") {
          const next = src[j + 1];
          if (next === "n") out += "\n";
          else if (next === "t") out += "\t";
          else if (next === '"') out += '"';
          else if (next === "\\") out += "\\";
          else out += next ?? "";
          j += 2;
          continue;
        }
        if (c === '"') {
          closed = true;
          j += 1;
          break;
        }
        out += c;
        j += 1;
      }
      if (!closed) throw new LearnerError(line, "SyntaxError", "That String never closes.");
      tokens.push({ kind: "string", text: src.slice(i, j), value: out });
      i = j;
      continue;
    }
    if (ch === "'") {
      const end = src.indexOf("'", i + 1);
      if (end === -1) throw new LearnerError(line, "SyntaxError", "That character never closes.");
      const body = src.slice(i + 1, end);
      if (body.length !== 1) throw new LearnerError(line, "SyntaxError", 'Use double quotes for text ("hi").');
      tokens.push({ kind: "string", text: src.slice(i, end + 1), value: body });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+(\.[0-9]+)?/.exec(src.slice(i));
      const text = match?.[0] ?? ch;
      tokens.push({ kind: "number", text, value: Number(text) });
      i += text.length;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const match = /^[A-Za-z_$][\w$]*/.exec(src.slice(i));
      const text = match?.[0] ?? ch;
      tokens.push({ kind: "ident", text });
      i += text.length;
      continue;
    }
    const three = src.slice(i, i + 3);
    void three;
    const two = src.slice(i, i + 2);
    if (ops.includes(two)) {
      tokens.push({ kind: "op", text: two });
      i += 2;
      continue;
    }
    if (ops.includes(ch)) {
      if (ch === "&" || ch === "|" || ch === "^") {
        throw new LearnerError(line, "UnsupportedJava", "Single & and | are outside the Cadet subset. Use && and ||.");
      }
      tokens.push({ kind: "op", text: ch });
      i += 1;
      continue;
    }
    throw new LearnerError(line, "SyntaxError", `Bad character: ${ch}.`);
  }
  return tokens;
}

type ExprNode =
  | { t: "lit"; value: unknown }
  | { t: "var"; name: string }
  | { t: "bin"; op: string; a: ExprNode; b: ExprNode }
  | { t: "un"; op: string; a: ExprNode }
  | { t: "tern"; c: ExprNode; a: ExprNode; b: ExprNode }
  | { t: "notnull"; a: ExprNode }
  | { t: "call"; base: ExprNode | null; method: string; args: ExprNode[] }
  | { t: "field"; base: ExprNode; field: string }
  | { t: "index"; base: ExprNode; index: ExprNode }
  | { t: "newArray"; size: ExprNode | null; init: ExprNode[] | null }
  | { t: "newList" }
  | { t: "arrayLit"; items: ExprNode[] };

class ExprParser {
  pos = 0;
  constructor(
    readonly tokens: Token[],
    readonly line: number,
  ) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  next(): Token {
    const token = this.tokens[this.pos];
    if (!token) throw new LearnerError(this.line, "SyntaxError", "That expression ends early.");
    this.pos += 1;
    return token;
  }

  eatOp(text: string): boolean {
    const token = this.peek();
    if (token?.kind === "op" && token.text === text) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  expectOp(text: string): void {
    if (!this.eatOp(text)) throw new LearnerError(this.line, "SyntaxError", `That expression needs ${text}.`);
  }

  parse(): ExprNode {
    const node = this.parseTernary();
    if (this.pos < this.tokens.length) throw new LearnerError(this.line, "SyntaxError", "Extra text after that expression.");
    return node;
  }

  parseTernary(): ExprNode {
    const cond = this.parseOr();
    if (this.eatOp("?")) {
      const yes = this.parseTernary();
      this.expectOp(":");
      const no = this.parseTernary();
      return { t: "tern", c: cond, a: yes, b: no };
    }
    return cond;
  }

  parseOr(): ExprNode {
    let left = this.parseAnd();
    while (this.eatOp("||")) left = { t: "bin", op: "||", a: left, b: this.parseAnd() };
    return left;
  }

  parseAnd(): ExprNode {
    let left = this.parseEquality();
    while (this.eatOp("&&")) left = { t: "bin", op: "&&", a: left, b: this.parseEquality() };
    return left;
  }

  parseEquality(): ExprNode {
    let left = this.parseRelational();
    for (;;) {
      if (this.eatOp("==")) left = { t: "bin", op: "==", a: left, b: this.parseRelational() };
      else if (this.eatOp("!=")) left = { t: "bin", op: "!=", a: left, b: this.parseRelational() };
      else return left;
    }
  }

  parseRelational(): ExprNode {
    let left = this.parseAdd();
    for (;;) {
      if (this.eatOp("<=")) left = { t: "bin", op: "<=", a: left, b: this.parseAdd() };
      else if (this.eatOp(">=")) left = { t: "bin", op: ">=", a: left, b: this.parseAdd() };
      else if (this.eatOp("<")) left = { t: "bin", op: "<", a: left, b: this.parseAdd() };
      else if (this.eatOp(">")) left = { t: "bin", op: ">", a: left, b: this.parseAdd() };
      else return left;
    }
  }

  parseAdd(): ExprNode {
    let left = this.parseMul();
    for (;;) {
      if (this.eatOp("+")) left = { t: "bin", op: "+", a: left, b: this.parseMul() };
      else if (this.eatOp("-")) left = { t: "bin", op: "-", a: left, b: this.parseMul() };
      else return left;
    }
  }

  parseMul(): ExprNode {
    let left = this.parseUnary();
    for (;;) {
      if (this.eatOp("*")) left = { t: "bin", op: "*", a: left, b: this.parseUnary() };
      else if (this.eatOp("/")) left = { t: "bin", op: "/", a: left, b: this.parseUnary() };
      else if (this.eatOp("%")) left = { t: "bin", op: "%", a: left, b: this.parseUnary() };
      else return left;
    }
  }

  parseUnary(): ExprNode {
    if (this.eatOp("!")) return { t: "un", op: "!", a: this.parseUnary() };
    if (this.eatOp("-")) return { t: "un", op: "-", a: this.parseUnary() };
    if (this.eatOp("+")) return this.parseUnary();
    if (this.eatOp("++") || this.eatOp("--")) {
      throw new LearnerError(this.line, "SyntaxError", "++ and -- run only as their own line.");
    }
    return this.parsePostfix();
  }

  parsePostfix(): ExprNode {
    let node = this.parsePrimary();
    for (;;) {
      if (this.eatOp(".")) {
        const name = this.next();
        if (name?.kind !== "ident") throw new LearnerError(this.line, "SyntaxError", "That . needs a name.");
        if (this.peekIs("(")) {
          this.next();
          const args = this.parseArgList();
          node = { t: "call", base: node, method: name.text, args };
        } else {
          node = { t: "field", base: node, field: name.text };
        }
        continue;
      }
      if (this.eatOp("[")) {
        const index = this.parseTernary();
        this.expectOp("]");
        node = { t: "index", base: node, index };
        continue;
      }
      return node;
    }
  }

  peekIs(text: string): boolean {
    const token = this.peek();
    return token?.kind === "op" && token.text === text;
  }

  parseArgList(): ExprNode[] {
    const args: ExprNode[] = [];
    if (this.peekIs(")")) {
      this.next();
      return args;
    }
    for (;;) {
      args.push(this.parseTernary());
      if (this.eatOp(",")) continue;
      this.expectOp(")");
      return args;
    }
  }

  parsePrimary(): ExprNode {
    const token = this.next();
    if (token.kind === "number" || token.kind === "string") return { t: "lit", value: token.value };
    if (token.kind === "ident") {
      if (token.text === "true") return { t: "lit", value: true };
      if (token.text === "false") return { t: "lit", value: false };
      if (token.text === "null") return { t: "lit", value: null };
      if (token.text === "new") return this.parseNew();
      if (token.text === "this" || token.text === "super") {
        throw new LearnerError(this.line, "UnsupportedJava", "this and super are outside the Cadet subset.");
      }
      if (this.peekIs("(")) {
        this.next();
        return { t: "call", base: null, method: token.text, args: this.parseArgList() };
      }
      return { t: "var", name: token.text };
    }
    if (token.kind === "op" && token.text === "(") {
      const inner = this.parseTernary();
      this.expectOp(")");
      return inner;
    }
    if (token.kind === "op" && token.text === "{") {
      const items: ExprNode[] = [];
      if (!this.peekIs("}")) {
        for (;;) {
          items.push(this.parseTernary());
          if (this.eatOp(",")) {
            if (this.peekIs("}")) break;
            continue;
          }
          break;
        }
      }
      this.expectOp("}");
      return { t: "arrayLit", items };
    }
    throw new LearnerError(this.line, "SyntaxError", "That expression is not valid here.");
  }

  parseNew(): ExprNode {
    const type = this.next();
    if (type?.kind !== "ident") throw new LearnerError(this.line, "SyntaxError", "new needs a type.");
    if (type.text === "ArrayList") {
      while (this.peekIs("<")) this.skipGeneric();
      this.expectOp("(");
      this.expectOp(")");
      return { t: "newList" };
    }
    let dims = 0;
    while (this.peekIs("[")) {
      this.next();
      if (this.peekIs("]")) {
        this.next();
        dims += 1;
        continue;
      }
      const size = this.parseTernary();
      this.expectOp("]");
      if (dims === 0 && !this.peekIs("[") && !this.peekIs("{")) return { t: "newArray", size, init: null };
      dims += 1;
      void size;
    }
    if (this.peekIs("{")) {
      this.next();
      const items: ExprNode[] = [];
      if (!this.peekIs("}")) {
        for (;;) {
          items.push(this.parseTernary());
          if (this.eatOp(",")) {
            if (this.peekIs("}")) break;
            continue;
          }
          break;
        }
      }
      this.expectOp("}");
      return { t: "newArray", size: null, init: items };
    }
    if (dims > 0) return { t: "newArray", size: { t: "lit", value: 0 }, init: [] };
    throw new LearnerError(this.line, "UnsupportedJava", "That new shape is outside the Cadet subset.");
  }

  skipGeneric(): void {
    this.expectOp("<");
    let depth = 1;
    while (depth > 0) {
      const token = this.next();
      if (token.kind !== "op") continue;
      if (token.text === "<") depth += 1;
      if (token.text === ">") depth -= 1;
    }
  }
}

function evalExprNode(runner: Runner, node: ExprNode, line: number, allowAction: boolean): unknown {
  switch (node.t) {
    case "lit":
      return node.value;
    case "var": {
      const found = runner.scope.lookup(node.name);
      if (!found.found) throw unknownNameError(runner, node.name, line);
      return found.value;
    }
    case "bin":
      return evalBin(runner, node.op, node.a, node.b, line, allowAction);
    case "un": {
      const value = evalExprNode(runner, node.a, line, allowAction);
      if (node.op === "!") {
        if (typeof value !== "boolean") throw new LearnerError(line, "TypeError", "! needs a true/false answer.");
        return !value;
      }
      if (typeof value !== "number") throw new LearnerError(line, "TypeError", "That minus needs a number.");
      return -value;
    }
    case "tern": {
      const test = evalExprNode(runner, node.c, line, allowAction);
      requireBoolean(test, line);
      return test ? evalExprNode(runner, node.a, line, allowAction) : evalExprNode(runner, node.b, line, allowAction);
    }
    case "notnull":
      return evalExprNode(runner, node.a, line, allowAction) !== null;
    case "call": {
      const args = node.args.map((a) => evalExprNode(runner, a, line, false));
      if (node.base === null) {
        if (node.method === "log" || SENSOR_SET.has(node.method) || STEP_SET.has(node.method)) {
          return runShipCall(runner, node.method, args, line, allowAction);
        }
        if (runner.methods.has(node.method)) return callMethod(runner, node.method, args, line);
        throw unknownNameError(runner, node.method, line);
      }
      const base = evalExprNode(runner, node.base, line, allowAction);
      return evalObjCall(runner, base, node.method, args, line, allowAction);
    }
    case "field": {
      const base = evalExprNode(runner, node.base, line, allowAction);
      return evalField(runner, base, node.field, line);
    }
    case "index": {
      const base = evalExprNode(runner, node.base, line, allowAction);
      if (!isArrayValue(base)) throw new LearnerError(line, "TypeError", "Only lists use [ ].");
      const index = evalExprNode(runner, node.index, line, allowAction);
      const at = requireInt(index, line);
      if (at < 0 || at >= base.__arrayItems.length) {
        throw new LearnerError(line, "IndexOutOfRange", `Index ${at} is outside the list.`);
      }
      return base.__arrayItems[at];
    }
    case "arrayLit":
      return makeArray(node.items.map((item) => evalExprNode(runner, item, line, false)));
    case "newArray": {
      if (node.init) return makeArray(node.init.map((item) => evalExprNode(runner, item, line, false)));
      if (node.size) {
        const size = evalExprNode(runner, node.size, line, false);
        const count = requireInt(size, line);
        if (count < 0) throw new LearnerError(line, "TypeError", "List size cannot be negative.");
        if (count > 1000) throw new LearnerError(line, "TypeError", "That list is too big.");
        return makeArray(new Array<unknown>(count).fill(0));
      }
      return makeArray([]);
    }
    case "newList":
      return makeArray([]);
  }
}

function evalField(runner: Runner, base: unknown, field: string, line: number): unknown {
  if (base !== null && typeof base === "object" && "__host" in (base as Record<string, unknown>)) {
    const host = base as ShipHost | RadarHost;
    if (host.__host === "ship") {
      const value = readShipSnapshotField(runner.sim, field);
      if (value === undefined) throw new LearnerError(line, "UnknownName", `Ship has no field ${field}.`);
      return value;
    }
    const radar = (host as RadarHost).data;
    const record = radar as unknown as Record<string, unknown>;
    if (!(field in record)) throw new LearnerError(line, "UnknownName", `Radar has no field ${field}.`);
    return record[field];
  }
  if (isArrayValue(base)) {
    if (field === "length") return base.__arrayItems.length;
    throw new LearnerError(line, "UnknownName", `Lists have length, not ${field}.`);
  }
  throw new LearnerError(line, "TypeError", "That . needs a ship, radar, list, or String.");
}

function evalBin(runner: Runner, op: string, aNode: ExprNode, bNode: ExprNode, line: number, allowAction: boolean): unknown {
  if (op === "&&") {
    const left = evalExprNode(runner, aNode, line, allowAction);
    requireBoolean(left, line);
    if (!left) return false;
    const right = evalExprNode(runner, bNode, line, allowAction);
    requireBoolean(right, line);
    return right;
  }
  if (op === "||") {
    const left = evalExprNode(runner, aNode, line, allowAction);
    requireBoolean(left, line);
    if (left) return true;
    const right = evalExprNode(runner, bNode, line, allowAction);
    requireBoolean(right, line);
    return right;
  }
  const a = evalExprNode(runner, aNode, line, allowAction);
  const b = evalExprNode(runner, bNode, line, allowAction);
  if (op === "==" || op === "!=") {
    if (typeof a === "string" && typeof b === "string") {
      throw new LearnerError(line, "StringEquals", 'Compare Strings with .equals("..."), not ==.');
    }
    const same = a === b;
    return op === "==" ? same : !same;
  }
  if (op === "+") {
    if (typeof a === "string" || typeof b === "string") return `${asString(a)}${asString(b)}`;
    if (typeof a === "number" && typeof b === "number") return a + b;
    throw new LearnerError(line, "TypeError", "+ needs numbers or text.");
  }
  if (typeof a !== "number" || typeof b !== "number") {
    throw new LearnerError(line, "TypeError", "That comparison needs numbers.");
  }
  switch (op) {
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return divideNumbers(a, b, line);
    case "%":
      if (b === 0) throw new LearnerError(line, "DivideByZero", "Dividing by zero stops the run.");
      return a % b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "<=":
      return a <= b;
    case ">=":
      return a >= b;
    default:
      throw new LearnerError(line, "SyntaxError", `Bad operator: ${op}.`);
  }
}

function evalSlice(runner: Runner, src: string, line: number, allowAction: boolean): unknown {
  const text = src.trim();
  if (text.length === 0) throw new LearnerError(line, "SyntaxError", "Missing value there.");
  try {
    const parser = new ExprParser(tokenizeExpr(text, line), line);
    const node = parser.parse();
    return evalExprNode(runner, node, line, runner.arenaTick ? false : allowAction);
  } catch (error) {
    if (error instanceof LearnerError) {
      if (error.line === 0) error.line = line;
      throw error;
    }
    throw new LearnerError(line, "SyntaxError", error instanceof Error ? error.message : "Bad expression.");
  }
}

function callMethod(runner: Runner, name: string, args: unknown[], line: number): unknown {
  const def = runner.methods.get(name);
  if (!def) throw unknownNameError(runner, name, line);
  if (args.length !== def.params.length) {
    throw new LearnerError(line, "ArgCount", `Wrong argument count for ${name}: expected ${def.params.length}, got ${args.length}.`);
  }
  runner.calls += 1;
  if (runner.calls > 500) throw new LearnerError(line, "EventCap", "Too many calls.");
  const outer = runner.scope;
  const frame = new Scope(rootScopeOf(runner));
  def.params.forEach((param, index) => frame.define(param, args[index]));
  runner.scope = frame;
  try {
    execBlock(def.body, runner);
    return undefined;
  } catch (error) {
    if (error instanceof ReturnSignal) return error.value;
    throw error;
  } finally {
    runner.scope = outer;
  }
}

// ---------------------------------------------------------------------------
// Run entry points
// ---------------------------------------------------------------------------

export interface CadetJavaRunInput {
  code: string;
  layout: AuthoredLayout;
  maxSteps?: number;
  maxEvents?: number;
  maxWallMs?: number;
}

export interface JavaTickInput {
  code: string;
  ship: { x: number; y: number; z: number; heading: string; energy: number; shield: boolean; crystals: number };
  radar: ArenaRadarSnapshot;
  maxEvents?: number;
  maxWallMs?: number;
}

export interface JavaTickResult {
  action: string | null;
  normalized: string | null;
  valid: boolean;
  trace: JavaTraceEvent[];
  error?: ErrorFrame;
  stdout: string;
}

const TICK_ACTIONS = new Set(["move", "turn_left", "turn_right", "ascend", "descend", "laser", "harvest", "shield", "wait"]);

function normalizeTickAction(raw: unknown): { action: string | null; normalized: string | null; valid: boolean } {
  if (typeof raw !== "string") return { action: null, normalized: null, valid: false };
  const camel = raw === "turnLeft" ? "turn_left" : raw === "turnRight" ? "turn_right" : raw;
  if (!TICK_ACTIONS.has(camel)) return { action: raw, normalized: null, valid: false };
  return { action: raw, normalized: camel, valid: true };
}

function initialOf(sim: ShipSim): JavaRunResult["initial"] {
  const snapshot = sim.snapshot();
  return {
    ship: { ...snapshot.ship },
    entities: JSON.parse(JSON.stringify(snapshot.entities)) as Record<string, Record<string, unknown>>,
  };
}

function toErrorFrame(error: unknown, line: number): ErrorFrame {
  if (error instanceof LearnerError) {
    return { kind: "error", line: error.line || line, excType: error.excType, message: error.message };
  }
  return { kind: "error", line, excType: "RuntimeError", message: error instanceof Error ? error.message : String(error) };
}

function statusOf(excType: string): JavaStopReason {
  if (excType === "StepCap") return "step-cap";
  if (excType === "EventCap") return "event-cap";
  if (excType === "TimeCap") return "time-cap";
  return "error";
}

function makeRunner(code: string, sim: ShipSim, options: { maxSteps: number; maxEvents: number; maxWallMs: number; radar: ArenaRadarSnapshot | null }): Runner {
  const root = new Scope(null);
  root.define("ship", { __host: "ship" } satisfies ShipHost);
  if (options.radar) root.define("radar", { __host: "radar", data: options.radar } satisfies RadarHost);
  const runner: Runner = {
    code,
    sim,
    scope: root,
    methods: new Map(),
    trace: [],
    stdout: "",
    stepsUsed: 0,
    pendingDelta: null,
    pendingLog: null,
    startedAt: Date.now(),
    maxSteps: options.maxSteps,
    maxEvents: options.maxEvents,
    maxWallMs: options.maxWallMs,
    radar: options.radar,
    calls: 0,
    arenaTick: false,
  };
  return runner;
}

/** The root scope holds `ship` (and `radar` on ticks). Methods hang off it. */
function rootScopeOf(runner: Runner): Scope {
  let scope = runner.scope;
  while (scope.parent) scope = scope.parent;
  return scope;
}

export function runCadetJava(input: CadetJavaRunInput): JavaRunResult {
  const maxSteps = input.maxSteps ?? JAVA_MAX_SHIP_STEPS;
  const maxEvents = input.maxEvents ?? JAVA_MAX_TRACE_EVENTS;
  const maxWallMs = input.maxWallMs ?? JAVA_MAX_WALL_SECONDS * 1000;
  let sim: ShipSim;
  try {
    sim = new ShipSim(input.layout);
  } catch (error) {
    return {
      status: "error",
      trace: [],
      stdout: "",
      error: { kind: "error", line: 0, excType: "InvalidLayout", message: error instanceof Error ? error.message : "Invalid layout." },
      stopReason: "error",
      initial: { ship: { x: 0, y: 0, z: 0, heading: "north", energy: 0, shield: false, crystals: 0 }, entities: {} },
      bounds: { maxX: 12, maxY: 5, maxZ: 12 },
    };
  }
  const initial = initialOf(sim);
  const runner = makeRunner(input.code, sim, { maxSteps, maxEvents, maxWallMs, radar: null });
  try {
    const cst = parseJava(input.code) as Cst;
    const mainClass = findMainClass(cst);
    runner.methods = collectMethods(mainClass, input.code);
    const main = runner.methods.get("main");
    if (!main) throw new LearnerError(offsetsOf(mainClass).line, "NoMain", "No main method found. Write public static void main inside Main.");
    const frame = new Scope(rootScopeOf(runner));
    if (main.params.length > 0) frame.define(main.params[0], makeArray([]));
    for (let i = 1; i < main.params.length; i++) frame.define(main.params[i], undefined);
    runner.scope = frame;
    try {
      execBlock(main.body, runner);
    } catch (error) {
      if (error instanceof ReturnSignal) {
        // `return;` inside main ends the run normally.
      } else {
        throw error;
      }
    }
    return { status: "ok", trace: runner.trace, stdout: runner.stdout, stopReason: "none", initial, bounds: sim.snapshot().bounds };
  } catch (error) {
    if (error instanceof BreakSignal) {
      const frame = toErrorFrame(new LearnerError(0, "TypeError", "break runs only inside a loop or switch."), 0);
      return { status: "error", trace: runner.trace, stdout: runner.stdout, error: frame, stopReason: "error", initial, bounds: sim.snapshot().bounds };
    }
    if (error instanceof ContinueSignal) {
      const frame = toErrorFrame(new LearnerError(0, "TypeError", "continue runs only inside a loop."), 0);
      return { status: "error", trace: runner.trace, stdout: runner.stdout, error: frame, stopReason: "error", initial, bounds: sim.snapshot().bounds };
    }
    if (error instanceof LearnerError) {
      const frame = toErrorFrame(error, error.line);
      const status = statusOf(error.excType);
      return { status, trace: runner.trace, stdout: runner.stdout, error: frame, stopReason: status, initial, bounds: sim.snapshot().bounds };
    }
    if (error instanceof Error && /parse|Parse|mismatched|no viable|extraneous/i.test(error.message)) {
      const frame: ErrorFrame = { kind: "error", line: syntaxLine(error), excType: "SyntaxError", message: error.message.slice(0, 300) };
      return { status: "error", trace: runner.trace, stdout: runner.stdout, error: frame, stopReason: "error", initial, bounds: sim.snapshot().bounds };
    }
    const frame = toErrorFrame(error, 0);
    return { status: "error", trace: runner.trace, stdout: runner.stdout, error: frame, stopReason: "error", initial, bounds: sim.snapshot().bounds };
  }
}

export function runJavaTick(input: JavaTickInput): JavaTickResult {
  const maxEvents = input.maxEvents ?? JAVA_MAX_TRACE_EVENTS;
  const maxWallMs = input.maxWallMs ?? JAVA_MAX_WALL_SECONDS * 1000;
  const fallbackLayout: AuthoredLayout = {
    shipStart: { x: input.ship.x, y: input.ship.y, z: input.ship.z, heading: "north", energy: input.ship.energy },
    bounds: { maxX: 12, maxY: 5, maxZ: 12 },
    entities: [],
  };
  const sim = new ShipSim(fallbackLayout);
  const runner = makeRunner(input.code, sim, { maxSteps: 0, maxEvents, maxWallMs, radar: input.radar });
  runner.arenaTick = true;
  try {
    const cst = parseJava(input.code) as Cst;
    const mainClass = findMainClass(cst);
    runner.methods = collectMethods(mainClass, input.code);
    const tick = runner.methods.get("onTick");
    if (!tick) {
      throw new LearnerError(offsetsOf(mainClass).line, "NoOnTick", "No onTick method found. Write onTick(ship, radar) inside Main.");
    }
    if (tick.params.length !== 2) {
      throw new LearnerError(tick.line, "ArgCount", `Wrong argument count for onTick: expected 2, got ${tick.params.length}.`);
    }
    const frame = new Scope(rootScopeOf(runner));
    frame.define(tick.params[0], { __host: "ship" } satisfies ShipHost);
    frame.define(tick.params[1], { __host: "radar", data: input.radar } satisfies RadarHost);
    runner.scope = frame;
    let returned: unknown = undefined;
    let sawReturn = false;
    const outerCalls = runner.calls;
    void outerCalls;
    try {
      execBlock(tick.body, runner);
    } catch (error) {
      if (error instanceof ReturnSignal) {
        returned = error.value;
        sawReturn = true;
      } else {
        throw error;
      }
    }
    if (!sawReturn) {
      return { action: null, normalized: null, valid: false, trace: runner.trace, stdout: runner.stdout };
    }
    const shaped = normalizeTickAction(returned);
    return { ...shaped, trace: runner.trace, stdout: runner.stdout };
  } catch (error) {
    if (error instanceof LearnerError) {
      return { action: null, normalized: null, valid: false, trace: runner.trace, error: toErrorFrame(error, error.line), stdout: runner.stdout };
    }
    return { action: null, normalized: null, valid: false, trace: runner.trace, error: toErrorFrame(error, 0), stdout: runner.stdout };
  }
}

