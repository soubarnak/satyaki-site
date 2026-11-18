// Oracle row types and the pack checker. Expected values come from a
// Planet content spec (docs/planet-N-*-content-spec.md), written as
// literals in the Planet's oracle file, never derived from shipped content.
// Pure: no vitest, no World State, no Ship simulation.

import type {
  BossGate,
  CheckTiming,
  ConceptId,
  Mission,
  PlanetConceptId,
  PlanetPack,
  Tier,
  TrainingWheels,
} from "@/lib/content";
import {
  BOSS_PART_B_SEEDS,
  COMPARATORS,
  QUIZ_KINDS,
  SEED_COUNTS,
  validatePlanetPack,
} from "@/lib/content";
import { JAVA_NAMES, PYTHON_NAMES } from "@/lib/ship-sim";
import { javaParses, javaSnippetParses, pythonParses } from "./syntax";

export type CheckRow = [id: string, statePath: string, comparator: string, expected: string | number | boolean, timing: CheckTiming];
export type EntityRow = [id: string, type: string, x: number, y: number, z: number];

export type Heading = "north" | "east" | "south" | "west";

export interface ShipStartOracle {
  x: number;
  y: number;
  z: number;
  heading: Heading;
  energy: number;
}

export interface LayoutOracle {
  /** Inclusive maximum coordinates exactly as the spec lists them. */
  specBounds: { maxX: number; maxY: number; maxZ: number };
  shipStart: ShipStartOracle;
  entities: EntityRow[];
}

export interface MissionOracle {
  slug: string;
  position: number;
  title: string;
  conceptId: ConceptId;
  tier: Tier;
  seedPool: number[];
  refSteps: number;
  refEnergy: number;
  /** Par as printed in the spec's summary table. */
  par: { maxSteps: number; maxEnergy: number };
  checks: CheckRow[];
  layout: LayoutOracle;
}

export interface PartBOracle {
  slug: string;
  seedPool: number[];
  refSteps: number;
  refEnergy: number;
  checks: CheckRow[];
  layout: LayoutOracle;
}

export interface QuizOracle {
  kind: string;
  optionCount: number;
  correctIndex: number;
}

export interface PackOracle {
  planet: {
    id: string;
    slug: string;
    name: string;
    themeId: string;
    planetConceptId: PlanetConceptId;
    /** trainingWheelsForPlanet value for this Planet, from its spec. */
    trainingWheels: TrainingWheels;
  };
  missions: MissionOracle[];
  boss: { slug: string; title: string; partA: QuizOracle[]; partB: PartBOracle };
  /** Directory of reference files, relative to the repo root. */
  referenceDir: string;
  /** Planet content directory whose sources must never import references. */
  contentDir: string;
}

export const parFormula = (ref: number): number => Math.ceil(1.5 * ref) + 2;

export const PYTHON_MARKERS = ["# YOUR CODE BELOW", "# YOUR CODE ABOVE"] as const;
export const JAVA_MARKERS = ["// YOUR CODE BELOW", "// YOUR CODE ABOVE"] as const;

/** Text outside the editable region (before BELOW, after ABOVE). */
export function scaffoldOutside(code: string, markers: readonly [string, string]): string {
  const below = code.indexOf(markers[0]);
  const above = code.indexOf(markers[1]);
  if (below === -1 || above === -1) return code;
  return code.slice(0, below) + code.slice(above + markers[1].length);
}

export function stripComments(code: string, language: "python" | "java"): string {
  const marker = language === "python" ? "#" : "//";
  return code
    .split("\n")
    .map((line) => (line.includes(marker) ? line.slice(0, line.indexOf(marker)) : line))
    .join("\n");
}

/** Ship API names (any language) called as `name(` in code. */
export function shipCalls(code: string, language: "python" | "java"): string[] {
  const names = language === "python" ? PYTHON_NAMES : JAVA_NAMES;
  const calls: string[] = [];
  for (const match of code.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)) {
    if (names.includes(match[1])) calls.push(match[1]);
  }
  return calls;
}

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function checkStarterPair(
  errors: string[],
  slug: string,
  python: string,
  java: string,
  override: string | undefined,
  stage: TrainingWheels,
): void {
  for (const [lang, code, markers] of [
    ["python", python, PYTHON_MARKERS],
    ["java", java, JAVA_MARKERS],
  ] as const) {
    for (const marker of markers) {
      if (countOf(code, marker) !== 1) errors.push(`${slug}: ${lang} starter needs ${marker} once`);
    }
    const outside = stripComments(scaffoldOutside(code, markers), lang);
    const calls = shipCalls(outside, lang);
    if (calls.length > 0) {
      errors.push(`${slug}: ${lang} scaffold calls Ship action ${calls.join(",")}`);
    }
  }
  if (!pythonParses(python)) errors.push(`${slug}: python starter fails real parse`);
  if (!javaParses(java)) errors.push(`${slug}: java starter fails real parse`);
  if (override !== undefined) errors.push(`${slug}: carries a Training Wheels override`);
  checkJavaStage(errors, slug, java, stage);
}

/** Java starter shape for a Training Wheels stage. Exported for tests. */
export function checkJavaStage(
  errors: string[],
  slug: string,
  java: string,
  stage: TrainingWheels,
): void {
  if (stage === "minimal") return;
  const outside = scaffoldOutside(java, JAVA_MARKERS);
  if (!/public class Main/.test(outside)) {
    errors.push(`${slug}: ${stage} java starter needs public class Main outside the markers`);
  }
  const mainOutside = /public static void main/.test(outside);
  if (stage === "full-scaffold") {
    if (!mainOutside) errors.push(`${slug}: full-scaffold java starter needs main outside the markers`);
    return;
  }
  // partial: the Cadet writes main and its closing brace inside the markers,
  // so the shipped scaffold outside them must not contain main.
  if (mainOutside) {
    errors.push(`${slug}: partial java starter has main outside the markers`);
  }
}

const shipStartRow = (s: ShipStartOracle): unknown[] => [s.x, s.y, s.z, s.heading, s.energy];

function checkLayout(
  errors: string[],
  slug: string,
  layout: Mission["layout"],
  oracle: LayoutOracle,
): void {
  const { maxX, maxY, maxZ } = oracle.specBounds;
  const want = { maxX: maxX + 1, maxY: Math.max(maxY + 1, 1), maxZ: maxZ + 1 };
  if (JSON.stringify(layout.bounds) !== JSON.stringify(want)) {
    errors.push(`${slug}: bounds ${JSON.stringify(layout.bounds)} are not ${JSON.stringify(want)}`);
  }
  if (JSON.stringify(shipStartRow(layout.shipStart)) !== JSON.stringify(shipStartRow(oracle.shipStart))) {
    errors.push(`${slug}: shipStart disagrees with the spec`);
  }
  const rows = layout.entities.map((e) => [e.id, e.type, e.x, e.y, e.z]);
  if (JSON.stringify(rows) !== JSON.stringify(oracle.entities)) {
    errors.push(`${slug}: entities disagree with the spec`);
  }
}

function checkChecks(
  errors: string[],
  slug: string,
  checks: Mission["checks"],
  oracle: CheckRow[],
): void {
  const rows = checks.map((c) => [c.id, c.statePath, c.comparator, c.expected, c.timing]);
  if (JSON.stringify(rows) !== JSON.stringify(oracle)) {
    errors.push(`${slug}: Pass checks disagree with the spec`);
  }
  for (const c of checks) {
    if (!(COMPARATORS as readonly string[]).includes(c.comparator)) {
      errors.push(`${slug}: comparator ${c.comparator} is outside the closed set`);
    }
    if (typeof c.expected === "object") errors.push(`${slug}: ${c.id} expected is not a scalar`);
    if (/\d/.test(c.label)) errors.push(`${slug}: label "${c.label}" names a coordinate`);
  }
}

function checkSeeds(errors: string[], slug: string, pool: number[], want: number[]): void {
  if (JSON.stringify(pool) !== JSON.stringify(want)) {
    errors.push(`${slug}: Seed pool ${JSON.stringify(pool)} disagrees with the spec`);
  }
}

const PLAIN_PROSE_BACKTICK = "`";

function checkPlainProse(errors: string[], slug: string, texts: string[]): void {
  for (const text of texts) {
    if (text.includes(PLAIN_PROSE_BACKTICK)) errors.push(`${slug}: markdown backtick in "${text}"`);
  }
}

function checkMission(
  errors: string[],
  mission: Mission,
  oracle: MissionOracle,
  planetConcept: PlanetConceptId,
  stage: TrainingWheels,
): void {
  const slug = oracle.slug;
  if (mission.slug !== oracle.slug) errors.push(`${slug}: slug is ${mission.slug}`);
  if (mission.position !== oracle.position) errors.push(`${slug}: position disagrees`);
  if (mission.title !== oracle.title) errors.push(`${slug}: title disagrees`);
  if (mission.conceptId !== oracle.conceptId) errors.push(`${slug}: conceptId disagrees`);
  if (mission.tier !== oracle.tier) errors.push(`${slug}: tier disagrees`);
  if (SEED_COUNTS[mission.tier] !== mission.seedPool.length) {
    errors.push(`${slug}: Seed count disagrees with tier ${mission.tier}`);
  }
  checkSeeds(errors, slug, mission.seedPool, oracle.seedPool);
  if (mission.star3Concept !== planetConcept) errors.push(`${slug}: star3Concept is not ${planetConcept}`);
  if (!mission.story || !mission.briefing) errors.push(`${slug}: story or briefing missing`);
  const wantSteps = parFormula(oracle.refSteps);
  const wantEnergy = parFormula(oracle.refEnergy);
  if (mission.par.maxSteps !== wantSteps || mission.par.maxEnergy !== wantEnergy) {
    errors.push(`${slug}: Par disagrees with ceil(1.5 x ref) + 2`);
  }
  if (oracle.par.maxSteps !== wantSteps || oracle.par.maxEnergy !== wantEnergy) {
    errors.push(`${slug}: oracle Par row disagrees with the formula`);
  }
  if (mission.par.maxSteps !== oracle.par.maxSteps || mission.par.maxEnergy !== oracle.par.maxEnergy) {
    errors.push(`${slug}: Par disagrees with the spec table`);
  }
  checkStarterPair(errors, slug, mission.pythonStarter, mission.javaStarter, mission.trainingWheels, stage);
  checkLayout(errors, slug, mission.layout, oracle.layout);
  checkChecks(errors, slug, mission.checks, oracle.checks);
  checkPlainProse(errors, slug, [
    mission.story,
    mission.briefing,
    ...mission.objectives.map((o) => o.text),
    ...mission.hints,
    mission.rosetta.note,
  ]);
  const r = mission.rosetta;
  for (const [lang, snippet] of [["python", r.python], ["java", r.java]] as const) {
    if (snippet.split("\n").length > 12) errors.push(`${slug}: rosetta ${lang} over 12 lines`);
  }
  if (!pythonParses(r.python)) errors.push(`${slug}: rosetta python fails real parse`);
  if (!javaSnippetParses(r.java)) errors.push(`${slug}: rosetta java fails real parse`);
}

function checkBoss(
  errors: string[],
  boss: BossGate,
  oracle: PackOracle["boss"],
  stage: TrainingWheels,
): void {
  if (boss.slug !== oracle.slug) errors.push(`${oracle.slug}: boss slug is ${boss.slug}`);
  if (boss.title !== oracle.title) errors.push(`${oracle.slug}: boss title disagrees`);
  if (boss.partA.length !== oracle.partA.length) errors.push(`${oracle.slug}: Part A length`);
  boss.partA.forEach((item, i) => {
    const want = oracle.partA[i];
    const tag = `${oracle.slug}: Part A item ${i + 1}`;
    if (!want) return;
    if (item.kind !== want.kind) errors.push(`${tag} kind disagrees`);
    if (!(QUIZ_KINDS as readonly string[]).includes(item.kind)) errors.push(`${tag} kind unknown`);
    if (item.options.length !== want.optionCount) errors.push(`${tag} option count disagrees`);
    if (item.correctIndex !== want.correctIndex) errors.push(`${tag} correctIndex disagrees`);
    checkPlainProse(errors, tag, [item.prompt, ...item.options, item.explanation]);
  });
  const b = boss.partB;
  const slug = oracle.partB.slug;
  if (b.slug !== slug) errors.push(`${slug}: Part B slug is ${b.slug}`);
  if (b.seedPool.length !== BOSS_PART_B_SEEDS) errors.push(`${slug}: Part B needs 3 Seeds`);
  checkSeeds(errors, slug, b.seedPool, oracle.partB.seedPool);
  checkStarterPair(errors, slug, b.pythonStarter, b.javaStarter, b.trainingWheels, stage);
  checkLayout(errors, slug, b.layout, oracle.partB.layout);
  checkChecks(errors, slug, b.checks, oracle.partB.checks);
  checkPlainProse(errors, slug, [b.briefing, ...b.objectives.map((o) => o.text), ...b.hints]);
}

/**
 * Every error for a pack: the shipped validator plus the oracle checks
 * (Par formula, Seed ids, real syntax, scaffold, spec transcription).
 */
export function checkPack(pack: PlanetPack, oracle: PackOracle): string[] {
  const errors = validatePlanetPack(pack);
  const { planet } = pack;
  for (const key of ["id", "slug", "name", "themeId", "planetConceptId"] as const) {
    if (planet[key] !== oracle.planet[key]) errors.push(`${planet.slug}: Planet ${key} disagrees`);
  }
  if (pack.missions.length !== oracle.missions.length) errors.push(`${planet.slug}: Mission count`);
  oracle.missions.forEach((row, i) => {
    const mission = pack.missions[i];
    if (mission) checkMission(errors, mission, row, oracle.planet.planetConceptId, oracle.planet.trainingWheels);
  });
  checkBoss(errors, pack.boss, oracle.boss, oracle.planet.trainingWheels);
  return errors;
}
