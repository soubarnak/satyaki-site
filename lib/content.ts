// Mission content schema and build-time validation (ADR-0011,
// spec §8). Glossary: Mission, Planet, Boss Gate, Pass, Par, Star,
// Training Wheels, Rosetta Pair, Seed, World State.
// Pure core: no framework, DOM, or worker imports.

import type { AuthoredLayout } from "./ship-sim";
import { MAX_BOUNDS } from "./ship-sim";

/** Tier, defaulting from Mission position: 1 intro, 2-4 core, 5 stretch. */
export const TIERS = ["intro", "core", "stretch"] as const;
export type Tier = (typeof TIERS)[number];

/** One Planet concept per Planet (five Planets). */
export const PLANET_CONCEPTS = [
  "variable",
  "conditional",
  "loop",
  "function",
  "list",
] as const;
export type PlanetConceptId = (typeof PLANET_CONCEPTS)[number];

/** The one new concept each Mission teaches (25 Missions). */
export const CONCEPT_IDS = [
  "sequence",
  "arithmetic_expression",
  "variable_assignment",
  "variable_update",
  "sensor_variable",
  "comparison",
  "if_statement",
  "if_else",
  "else_if_chain",
  "boolean_decision",
  "for_loop",
  "loop_counter",
  "while_loop",
  "nested_loop",
  "loop_with_conditional",
  "function_definition",
  "function_parameter",
  "function_return",
  "local_variable",
  "function_composition",
  "list_creation",
  "list_indexing",
  "list_update",
  "list_iteration",
  "list_driven_route",
] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

/** Java scaffold stage: full-scaffold Planets 1-2, partial 3-4, minimal 5. */
export const TRAINING_WHEELS = ["full-scaffold", "partial", "minimal"] as const;
export type TrainingWheels = (typeof TRAINING_WHEELS)[number];

export const COMPARATORS = ["eq", "ne", "gte", "lte"] as const;
export type Comparator = (typeof COMPARATORS)[number];

export const CHECK_TIMINGS = ["final", "intermediate"] as const;
export type CheckTiming = (typeof CHECK_TIMINGS)[number];

export const QUIZ_KINDS = ["choice", "spot-bug", "predict-state"] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];

/** Total Seeds per tier, practice Seed included (ADR-0013). */
export const SEED_COUNTS: Record<Tier, number> = {
  intro: 2,
  core: 3,
  stretch: 4,
};
/** Boss Gate Part B always uses 3 Seeds. */
export const BOSS_PART_B_SEEDS = 3;

export interface PassCheck {
  id: string;
  label: string;
  statePath: string;
  comparator: Comparator;
  expected: string | number | boolean;
  timing: CheckTiming;
}

export interface Objective {
  text: string;
  checkIds: string[];
}

export interface RosettaPair {
  python: string;
  java: string;
  note: string;
}

export interface Mission {
  slug: string;
  planet: string;
  position: number;
  conceptId: ConceptId;
  planetConceptId: PlanetConceptId;
  tier: Tier;
  title: string;
  /** Max 280 chars. */
  story: string;
  /** One sentence. */
  briefing: string;
  /** 1-3 objectives, each mapped to check ids. */
  objectives: Objective[];
  pythonStarter: string;
  javaStarter: string;
  /** Defaults from the Planet; per-Mission override allowed. */
  trainingWheels?: TrainingWheels;
  layout: AuthoredLayout;
  /** First entry is the practice Seed. */
  seedPool: number[];
  checks: PassCheck[];
  par: { maxSteps: number; maxEnergy: number };
  /** The Planet concept only (ADR-0013). */
  star3Concept: PlanetConceptId;
  /** Exactly 3 tiers: nudge, stronger, near-solution. */
  hints: [string, string, string] | string[];
  rosetta: RosettaPair;
}

export interface Planet {
  id: string;
  slug: string;
  name: string;
  themeId: string;
  planetConceptId: PlanetConceptId;
  /** Exactly 5 Mission slugs in order. */
  missionSlugs: string[];
}

export interface BossQuizItem {
  kind: QuizKind;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface BossPartB {
  slug: string;
  briefing: string;
  objectives: Objective[];
  pythonStarter: string;
  javaStarter: string;
  trainingWheels?: TrainingWheels;
  layout: AuthoredLayout;
  seedPool: number[];
  checks: PassCheck[];
  hints: [string, string, string] | string[];
  // No par, star3Concept, rosetta, or tier: Part B awards no Stars.
}

export interface BossGate {
  slug: string;
  planet: string;
  title: string;
  /** Exactly 5 quiz items in authored order. */
  partA: BossQuizItem[];
  partB: BossPartB;
}

export interface PlanetPack {
  planet: Planet;
  missions: Mission[];
  boss: BossGate;
}

/**
 * Reference solutions. Registry lives outside shipped content
 * (content/references/ or test fixtures); the grader ticket runs each
 * on every Seed and every solution must Pass (ADR-0011).
 */
export interface ReferenceSolutionSet {
  [slug: string]: { python: string; java: string };
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CHECK_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STATE_PATH =
  /^(ship\.[A-Za-z0-9_]+|entities\.[A-Za-z0-9_-]+\.[A-Za-z0-9_]+|bounds\.[A-Za-z0-9_]+)$/;

const PYTHON_BELOW = "# YOUR CODE BELOW";
const PYTHON_ABOVE = "# YOUR CODE ABOVE";
const JAVA_BELOW = "// YOUR CODE BELOW";
const JAVA_ABOVE = "// YOUR CODE ABOVE";

/** Tier default for a Mission position. */
export function tierForPosition(position: number): Tier {
  if (position === 1) return "intro";
  if (position >= 5) return "stretch";
  return "core";
}

/** Training Wheels default for a Planet number (1-5). */
export function trainingWheelsForPlanet(planetNumber: number): TrainingWheels {
  if (planetNumber <= 2) return "full-scaffold";
  if (planetNumber <= 4) return "partial";
  return "minimal";
}

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
 * Lightweight parse check: balanced (), [], {} outside string
 * literals and line comments, plus non-empty code. Java also needs a
 * statement or block marker (`;` or `{`). With `requireCode: false`
 * (starters) a comment-only program is valid: Training Wheels `minimal`
 * Java starters carry comments and markers only.
 */
export function codeParses(
  language: "python" | "java",
  code: string,
  options?: { requireCode?: boolean },
): boolean {
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: string[] = [];
  let quote: string | null = null;
  let meaningful = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    if (quote !== null) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "#" && language === "python") {
      while (i < code.length && code[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && code[i + 1] === "/" && language === "java") {
      while (i < code.length && code[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== pairs[ch]) return false;
    }
    if (!/\s/.test(ch)) meaningful = true;
  }
  const requireCode = options?.requireCode ?? true;
  if (quote !== null || stack.length > 0 || (requireCode && !meaningful)) {
    return false;
  }
  if (language === "java" && requireCode) return code.includes(";") || code.includes("{");
  return true;
}

function checkStarters(
  errors: string[],
  slug: string,
  pythonStarter: string,
  javaStarter: string,
  trainingWheels: TrainingWheels | undefined,
): void {
  if (!pythonStarter || typeof pythonStarter !== "string") {
    errors.push(`${slug}: pythonStarter is empty`);
  } else {
    if (countOccurrences(pythonStarter, PYTHON_BELOW) !== 1) {
      errors.push(`${slug}: pythonStarter needs ${PYTHON_BELOW} exactly once`);
    }
    if (countOccurrences(pythonStarter, PYTHON_ABOVE) !== 1) {
      errors.push(`${slug}: pythonStarter needs ${PYTHON_ABOVE} exactly once`);
    }
    if (!codeParses("python", pythonStarter, { requireCode: false })) {
      errors.push(`${slug}: pythonStarter does not parse`);
    }
  }
  if (!javaStarter || typeof javaStarter !== "string") {
    errors.push(`${slug}: javaStarter is empty`);
  } else {
    if (countOccurrences(javaStarter, JAVA_BELOW) !== 1) {
      errors.push(`${slug}: javaStarter needs ${JAVA_BELOW} exactly once`);
    }
    if (countOccurrences(javaStarter, JAVA_ABOVE) !== 1) {
      errors.push(`${slug}: javaStarter needs ${JAVA_ABOVE} exactly once`);
    }
    if (!codeParses("java", javaStarter, { requireCode: false })) {
      errors.push(`${slug}: javaStarter does not parse`);
    }
    if (trainingWheels === "full-scaffold") {
      if (!javaStarter.includes("class") || !javaStarter.includes("main")) {
        errors.push(`${slug}: full-scaffold javaStarter needs class and main`);
      }
    }
  }
}

function checkLayout(errors: string[], slug: string, layout: AuthoredLayout): void {
  const bounds = layout?.bounds;
  if (
    !bounds ||
    !Number.isInteger(bounds.maxX) ||
    !Number.isInteger(bounds.maxY) ||
    !Number.isInteger(bounds.maxZ) ||
    bounds.maxX < 1 ||
    bounds.maxY < 1 ||
    bounds.maxZ < 1 ||
    bounds.maxX > MAX_BOUNDS.maxX ||
    bounds.maxY > MAX_BOUNDS.maxY ||
    bounds.maxZ > MAX_BOUNDS.maxZ
  ) {
    errors.push(`${slug}: bounds must fit 1..16x1..16x1..6`);
    return;
  }
  const start = layout.shipStart;
  const headings = ["north", "east", "south", "west"];
  if (
    !start ||
    !Number.isInteger(start.x) ||
    !Number.isInteger(start.y) ||
    !Number.isInteger(start.z) ||
    !headings.includes(start.heading) ||
    !Number.isInteger(start.energy) ||
    start.energy < 1 ||
    start.x < 0 ||
    start.x >= bounds.maxX ||
    start.y < 0 ||
    start.y >= bounds.maxY ||
    start.z < 0 ||
    start.z >= bounds.maxZ
  ) {
    errors.push(`${slug}: shipStart outside bounds or invalid`);
  }
  const seen = new Set<string>();
  const gateLinks = new Set<string>();
  const switchLinks = new Set<string>();
  for (const e of layout.entities ?? []) {
    if (!e || typeof e.id !== "string" || seen.has(e.id)) {
      errors.push(`${slug}: duplicate or missing entity id`);
      continue;
    }
    seen.add(e.id);
    if (
      !Number.isInteger(e.x) ||
      !Number.isInteger(e.y) ||
      !Number.isInteger(e.z) ||
      e.x < 0 ||
      e.x >= bounds.maxX ||
      e.y < 0 ||
      e.y >= bounds.maxY ||
      e.z < 0 ||
      e.z >= bounds.maxZ
    ) {
      errors.push(`${slug}: entity ${e.id} outside bounds`);
    }
    if (start && e.x === start.x && e.y === start.y && e.z === start.z) {
      errors.push(`${slug}: entity ${e.id} spawns on the Ship start`);
    }
    const typed = e as unknown as Record<string, unknown>;
    const knownTypes = [
      "asteroid_cracked",
      "asteroid_titanium",
      "crystal",
      "switch",
      "gate",
      "wormhole",
      "drone",
    ];
    if (!knownTypes.includes(e.type)) {
      errors.push(`${slug}: entity ${e.id} has unknown type ${e.type}`);
      continue;
    }
    if (e.type === "switch") {
      if (typeof typed["linkId"] !== "string" || typed["linkId"] === "") {
        errors.push(`${slug}: switch ${e.id} needs a linkId`);
      } else {
        switchLinks.add(typed["linkId"] as string);
      }
    } else if (e.type === "gate") {
      if (typeof typed["linkId"] !== "string" || typed["linkId"] === "") {
        errors.push(`${slug}: gate ${e.id} needs a linkId`);
      } else {
        gateLinks.add(typed["linkId"] as string);
      }
    } else if (e.type === "wormhole") {
      if (typeof typed["pairId"] !== "string" || typed["pairId"] === "") {
        errors.push(`${slug}: wormhole ${e.id} needs a pairId`);
      }
    } else if (e.type === "drone") {
      if (!headings.includes(typed["heading"] as string)) {
        errors.push(`${slug}: drone ${e.id} needs a heading`);
      }
    }
  }
  for (const link of gateLinks) {
    if (!switchLinks.has(link)) {
      errors.push(`${slug}: gate linkId ${link} has no matching switch`);
    }
  }
}

function checkChecks(
  errors: string[],
  slug: string,
  checks: PassCheck[],
  objectives: Objective[],
): void {
  if (!Array.isArray(checks) || checks.length === 0) {
    errors.push(`${slug}: needs at least one Pass check`);
    return;
  }
  const ids = new Set<string>();
  for (const check of checks) {
    if (!check || !CHECK_ID.test(check.id ?? "")) {
      errors.push(`${slug}: check id ${check?.id} is invalid`);
      continue;
    }
    if (ids.has(check.id)) errors.push(`${slug}: duplicate check id ${check.id}`);
    ids.add(check.id);
    if (!check.label) errors.push(`${slug}: check ${check.id} needs a label`);
    if (!STATE_PATH.test(check.statePath ?? "")) {
      errors.push(`${slug}: check ${check.id} has bad statePath ${check.statePath}`);
    }
    if (!(COMPARATORS as readonly string[]).includes(check.comparator)) {
      errors.push(`${slug}: check ${check.id} has bad comparator`);
    }
    if (
      typeof check.expected !== "string" &&
      typeof check.expected !== "number" &&
      typeof check.expected !== "boolean"
    ) {
      errors.push(`${slug}: check ${check.id} expected must be a JSON scalar`);
    }
    if (!(CHECK_TIMINGS as readonly string[]).includes(check.timing)) {
      errors.push(`${slug}: check ${check.id} has bad timing`);
    }
  }
  if (!Array.isArray(objectives) || objectives.length < 1 || objectives.length > 3) {
    errors.push(`${slug}: needs 1-3 objectives`);
    return;
  }
  for (const objective of objectives) {
    if (!objective.text) errors.push(`${slug}: objective needs text`);
    if (!Array.isArray(objective.checkIds) || objective.checkIds.length === 0) {
      errors.push(`${slug}: objective needs at least one check`);
      continue;
    }
    for (const id of objective.checkIds) {
      if (!ids.has(id)) errors.push(`${slug}: objective maps to unknown check ${id}`);
    }
  }
  for (const id of ids) {
    if (!objectives.some((o) => o.checkIds?.includes(id))) {
      errors.push(`${slug}: check ${id} is mapped by no objective`);
    }
  }
}

function checkSeedPool(
  errors: string[],
  slug: string,
  seedPool: number[],
  expectedCount: number,
): void {
  if (!Array.isArray(seedPool) || seedPool.length !== expectedCount) {
    errors.push(`${slug}: seedPool needs exactly ${expectedCount} Seeds`);
    return;
  }
  const seen = new Set<number>();
  for (const seed of seedPool) {
    if (!Number.isInteger(seed)) errors.push(`${slug}: Seed ${seed} is not an integer`);
    if (seen.has(seed)) errors.push(`${slug}: duplicate Seed ${seed}`);
    seen.add(seed);
  }
}

function checkHints(errors: string[], slug: string, hints: Mission["hints"]): void {
  if (!Array.isArray(hints) || hints.length !== 3) {
    errors.push(`${slug}: needs exactly 3 hints`);
    return;
  }
  for (const hint of hints) {
    if (!hint || typeof hint !== "string") errors.push(`${slug}: hint is empty`);
  }
}

function isOneSentence(text: string): boolean {
  if (!text || typeof text !== "string" || text.includes("\n")) return false;
  const trimmed = text.trim();
  if (!/[.!?]$/.test(trimmed)) return false;
  return !/[.!?]/.test(trimmed.slice(0, -1));
}

/** Validate one Mission. Returns error strings; empty means valid. */
export function validateMission(mission: Mission): string[] {
  const errors: string[] = [];
  const slug = mission?.slug ?? "<missing>";
  if (!SLUG.test(mission?.slug ?? "")) errors.push(`${slug}: invalid slug`);
  if (!mission || typeof mission !== "object") return ["<missing>: not a Mission"];
  if (!Number.isInteger(mission.position) || mission.position < 1 || mission.position > 5) {
    errors.push(`${slug}: position must be 1-5`);
  }
  if (!(CONCEPT_IDS as readonly string[]).includes(mission.conceptId)) {
    errors.push(`${slug}: unknown conceptId ${mission.conceptId}`);
  }
  if (!(PLANET_CONCEPTS as readonly string[]).includes(mission.planetConceptId)) {
    errors.push(`${slug}: unknown planetConceptId ${mission.planetConceptId}`);
  }
  if (!(TIERS as readonly string[]).includes(mission.tier)) {
    errors.push(`${slug}: unknown tier ${mission.tier}`);
  }
  if (!mission.title) errors.push(`${slug}: title is empty`);
  if (!mission.story || mission.story.length > 280) {
    errors.push(`${slug}: story must be 1-280 chars`);
  }
  if (!isOneSentence(mission.briefing)) {
    errors.push(`${slug}: briefing must be one sentence`);
  }
  if (
    mission.trainingWheels !== undefined &&
    !(TRAINING_WHEELS as readonly string[]).includes(mission.trainingWheels)
  ) {
    errors.push(`${slug}: unknown trainingWheels ${mission.trainingWheels}`);
  }
  checkStarters(errors, slug, mission.pythonStarter, mission.javaStarter, mission.trainingWheels);
  checkLayout(errors, slug, mission.layout);
  checkSeedPool(errors, slug, mission.seedPool, SEED_COUNTS[mission.tier] ?? 0);
  checkChecks(errors, slug, mission.checks, mission.objectives);
  if (
    !mission.par ||
    !Number.isInteger(mission.par.maxSteps) ||
    mission.par.maxSteps < 1 ||
    !Number.isInteger(mission.par.maxEnergy) ||
    mission.par.maxEnergy < 1
  ) {
    errors.push(`${slug}: par needs positive maxSteps and maxEnergy`);
  }
  if (mission.star3Concept !== mission.planetConceptId) {
    errors.push(`${slug}: star3Concept must be the Planet concept`);
  }
  checkHints(errors, slug, mission.hints);
  const rosetta = mission.rosetta;
  if (!rosetta || typeof rosetta !== "object") {
    errors.push(`${slug}: rosetta is missing`);
  } else {
    for (const language of ["python", "java"] as const) {
      const snippet = rosetta[language];
      if (!snippet || typeof snippet !== "string") {
        errors.push(`${slug}: rosetta ${language} is empty`);
      } else {
        if (snippet.split("\n").length > 12) {
          errors.push(`${slug}: rosetta ${language} exceeds 12 lines`);
        }
        if (!codeParses(language, snippet)) {
          errors.push(`${slug}: rosetta ${language} does not parse`);
        }
      }
    }
    if (!rosetta.note || typeof rosetta.note !== "string" || rosetta.note.includes("\n")) {
      errors.push(`${slug}: rosetta note must be one line`);
    }
  }
  return errors;
}

/** Validate one Boss Gate. Returns error strings; empty means valid. */
export function validateBossGate(boss: BossGate): string[] {
  const errors: string[] = [];
  const slug = boss?.slug ?? "<missing>";
  if (!boss || typeof boss !== "object") return ["<missing>: not a Boss Gate"];
  if (!SLUG.test(boss.slug ?? "")) errors.push(`${slug}: invalid slug`);
  if (!boss.title) errors.push(`${slug}: title is empty`);
  if (!Array.isArray(boss.partA) || boss.partA.length !== 5) {
    errors.push(`${slug}: Part A needs exactly 5 quiz items`);
  } else {
    for (const [index, item] of boss.partA.entries()) {
      const tag = `${slug}: Part A item ${index + 1}`;
      if (!(QUIZ_KINDS as readonly string[]).includes(item?.kind)) {
        errors.push(`${tag} has bad kind`);
      }
      if (!item?.prompt) errors.push(`${tag} needs a prompt`);
      if (!Array.isArray(item?.options) || item.options.length < 3 || item.options.length > 4) {
        errors.push(`${tag} needs 3-4 options`);
      }
      if (
        !Number.isInteger(item?.correctIndex) ||
        item.correctIndex < 0 ||
        item.correctIndex >= (item?.options?.length ?? 0)
      ) {
        errors.push(`${tag} has a bad correctIndex`);
      }
      if (!item?.explanation || item.explanation.includes("\n")) {
        errors.push(`${tag} needs a one-line explanation`);
      }
    }
  }
  const partB = boss.partB;
  if (!partB || typeof partB !== "object") {
    errors.push(`${slug}: Part B is missing`);
    return errors;
  }
  const forbidden = ["par", "star3Concept", "rosetta", "tier"];
  for (const key of forbidden) {
    if (key in partB) errors.push(`${slug}: Part B must not carry ${key}`);
  }
  const bSlug = partB.slug ?? `${slug}-part-b`;
  if (!SLUG.test(bSlug)) errors.push(`${slug}: Part B has an invalid slug`);
  if (!isOneSentence(partB.briefing)) {
    errors.push(`${slug}: Part B briefing must be one sentence`);
  }
  if (
    partB.trainingWheels !== undefined &&
    !(TRAINING_WHEELS as readonly string[]).includes(partB.trainingWheels)
  ) {
    errors.push(`${slug}: Part B has unknown trainingWheels`);
  }
  checkStarters(errors, bSlug, partB.pythonStarter, partB.javaStarter, partB.trainingWheels);
  checkLayout(errors, bSlug, partB.layout);
  checkSeedPool(errors, bSlug, partB.seedPool, BOSS_PART_B_SEEDS);
  checkChecks(errors, bSlug, partB.checks, partB.objectives);
  checkHints(errors, bSlug, partB.hints);
  return errors;
}

/**
 * Validate a full Planet pack: Planet record, its five Missions, and its
 * Boss Gate, including permanent-slug reuse across the pack.
 */
export function validatePlanetPack(pack: PlanetPack): string[] {
  const errors: string[] = [];
  const { planet, missions, boss } = pack;
  if (!planet || !Array.isArray(missions) || !boss) {
    return ["pack: needs a Planet, Missions, and a Boss Gate"];
  }
  if (!(PLANET_CONCEPTS as readonly string[]).includes(planet.planetConceptId)) {
    errors.push(`${planet.slug}: unknown planetConceptId`);
  }
  if (!Array.isArray(planet.missionSlugs) || planet.missionSlugs.length !== 5) {
    errors.push(`${planet.slug}: needs exactly 5 missionSlugs`);
  }
  const slugs = new Set<string>();
  const claim = (slug: string, what: string): void => {
    if (!slug) {
      errors.push(`pack: ${what} has no slug`);
      return;
    }
    if (slugs.has(slug)) errors.push(`pack: slug reuse ${slug}`);
    slugs.add(slug);
  };
  claim(planet.slug, "Planet");
  claim(boss.slug, "Boss Gate");
  if (boss.partB) claim(boss.partB.slug, "Boss Part B");
  for (const mission of missions) claim(mission?.slug, "Mission");
  for (const mission of missions) {
    for (const error of validateMission(mission)) errors.push(error);
    if (mission.planet !== planet.slug) {
      errors.push(`${mission.slug}: planet ${mission.planet} is not ${planet.slug}`);
    }
    if (mission.planetConceptId !== planet.planetConceptId) {
      errors.push(`${mission.slug}: planetConceptId drifts from the Planet`);
    }
  }
  for (const error of validateBossGate(boss)) errors.push(error);
  if (boss.planet !== planet.slug) {
    errors.push(`${boss.slug}: planet ${boss.planet} is not ${planet.slug}`);
  }
  const ordered = [...missions].sort((a, b) => a.position - b.position);
  const orderedSlugs = ordered.map((m) => m.slug);
  if (JSON.stringify(orderedSlugs) !== JSON.stringify(planet.missionSlugs)) {
    errors.push(`${planet.slug}: missionSlugs do not match Missions in position order`);
  }
  return errors;
}

/**
 * Validate reference-solution coverage: every Mission and Boss Part B
 * needs a Python and a Java solution, and each must parse.
 * Grading each solution on every Seed belongs to the grader ticket.
 */
export function validateReferenceCoverage(
  missions: Mission[],
  boss: BossGate,
  solutions: ReferenceSolutionSet,
): string[] {
  const errors: string[] = [];
  const required = [...missions.map((m) => m.slug), boss?.partB?.slug].filter(
    (slug): slug is string => typeof slug === "string",
  );
  for (const slug of required) {
    const entry = solutions?.[slug];
    if (!entry || typeof entry !== "object") {
      errors.push(`reference ${slug} is missing`);
      continue;
    }
    if (!entry.python || !codeParses("python", entry.python)) {
      errors.push(`reference ${slug} python is missing or unparseable`);
    }
    if (!entry.java || !codeParses("java", entry.java)) {
      errors.push(`reference ${slug} java is missing or unparseable`);
    }
  }
  return errors;
}
