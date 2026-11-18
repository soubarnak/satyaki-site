// Progress core (ADR-0007 pure core: no framework imports, never touches
// `window`). Implements ADR-0006: per-field sanitization on load, total
// points derived from passed levels (never stored), streak count computed
// from stored dates under the FR-015 forgiving rule. Browser storage sits
// behind the adapter in lib/progress-storage.ts.

import { LEVELS, getLevel } from "./levels";
import { isHangarTier } from "./hangar";
import { gzipSync, gunzipSync } from "fflate";
import type { AuthoredLayout } from "./ship-sim";
import type { PassCheck, PlanetPack } from "./content";

/** Earned badge names known to v1, in level order, from the content pack. */
export const KNOWN_BADGES: readonly string[] = LEVELS.flatMap((level) =>
  level.badge ? [level.badge] : [],
);

/**
 * Sanitized learner progress. Total points and streak count are derived
 * from this value on read; neither is ever stored (ADR-0006).
 */
export interface Progress {
  passedLevelIds: readonly number[];
  badges: readonly string[];
  /** Device-local calendar dates, YYYY-MM-DD, unique, sorted ascending. */
  streakDates: readonly string[];
}

export const EMPTY_PROGRESS: Progress = {
  passedLevelIds: [],
  badges: [],
  streakDates: [],
};

const RECORD_VERSION = 1;

function sanitizePassedLevelIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(
    (id): id is number =>
      typeof id === "number" && Number.isInteger(id) && getLevel(id) !== undefined,
  );
  return [...new Set(valid)].sort((a, b) => a - b);
}

function sanitizeBadges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const earned = new Set(value.filter((badge) => typeof badge === "string"));
  return KNOWN_BADGES.filter((badge) => earned.has(badge));
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date in strict YYYY-MM-DD form. */
export function isStreakDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function sanitizeStreakDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isStreakDate))].sort();
}

function sanitizeProgress(fields: {
  passedLevelIds: unknown;
  badges: unknown;
  streakDates: unknown;
}): Progress {
  return {
    passedLevelIds: sanitizePassedLevelIds(fields.passedLevelIds),
    badges: sanitizeBadges(fields.badges),
    streakDates: sanitizeStreakDates(fields.streakDates),
  };
}

/**
 * Parse stored record text into progress (ADR-0006). Unparseable JSON, a
 * non-object record, or an unknown `version` means no progress; each known
 * field is sanitized on its own, so one corrupt field loses only itself.
 */
export function parseProgress(raw: string | null): Progress {
  if (raw === null || raw === "") return EMPTY_PROGRESS;
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return EMPTY_PROGRESS;
  }
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return EMPTY_PROGRESS;
  }
  const fields = record as Record<string, unknown>;
  if (fields.version !== RECORD_VERSION) return EMPTY_PROGRESS;
  return sanitizeProgress({
    passedLevelIds: fields.passedLevelIds,
    badges: fields.badges,
    streakDates: fields.streakDates,
  });
}

/** Serialize progress as the single stored JSON record (ADR-0006). */
export function serializeProgress(progress: Progress): string {
  const clean = sanitizeProgress(progress);
  return JSON.stringify({ version: RECORD_VERSION, ...clean });
}

/**
 * Total points, derived on read (DR-003): the sum of point values of passed
 * levels. Each level counts once, so FR-008 holds by construction.
 */
export function totalPoints(progress: Progress): number {
  return sanitizePassedLevelIds(progress.passedLevelIds).reduce(
    (sum, id) => sum + (getLevel(id)?.points ?? 0),
    0,
  );
}

export function isPassed(progress: Progress, levelId: number): boolean {
  return progress.passedLevelIds.includes(levelId);
}

/**
 * Record a pass (FR-008, FR-014): adds the level and, where the level names
 * one, its badge. A repeat pass changes nothing. When `runDate` is given it
 * joins the streak dates, so the caller persists the whole change in the
 * one storage write ADR-0006 requires.
 */
export function recordPass(
  progress: Progress,
  levelId: number,
  runDate?: string,
): Progress {
  const level = getLevel(levelId);
  if (level === undefined) return sanitizeProgress(progress);
  return sanitizeProgress({
    passedLevelIds: [...progress.passedLevelIds, level.id],
    badges: level.badge ? [...progress.badges, level.badge] : progress.badges,
    streakDates:
      runDate === undefined
        ? progress.streakDates
        : [...progress.streakDates, runDate],
  });
}

/** Record a run on a local calendar day (FR-015); malformed dates are dropped. */
export function recordRunDay(progress: Progress, date: string): Progress {
  return sanitizeProgress({
    ...progress,
    streakDates: [...progress.streakDates, date],
  });
}

/** Device-local calendar date of `date` as YYYY-MM-DD (DR-004). */
export function localDateString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/**
 * Streak count on `today` (FR-015 forgiving rule): run days chain while the
 * gap between neighbours is at most 2 days (exactly 1 missed day keeps the
 * count); a longer gap starts a new chain. The chain is still alive when
 * the latest run day is at most 2 days before `today`, and 0 after that.
 */
export function streakCount(progress: Progress, today: string): number {
  if (!isStreakDate(today)) return 0;
  const todayNumber = dayNumber(today);
  const days = sanitizeStreakDates(progress.streakDates)
    .map(dayNumber)
    .filter((day) => day <= todayNumber);
  if (days.length === 0) return 0;

  const latest = days[days.length - 1];
  if (todayNumber - latest > 2) return 0;

  let count = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] > 2) break;
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Progress v2 (Space Coder): one record shape for server, localStorage, and
// Save Code. Glossary: Mission, Pass, Star, Par, Boss Gate, Save Code,
// Creation, Challenge, Arena, Hangar, Skill Radar, Daily Recall Drill.
// Spec §6, ADR-0010 plus ADR-0014 extensions, ADR-0015 (radar/drill read).
// Pure core: no framework, DOM, or worker imports. fflate is pure JS and
// runs in Node and browsers.
// ---------------------------------------------------------------------------

/** v2 record version. v1 records (version 1) never auto-convert passes. */
export const PROGRESS_V2_VERSION = 2;
/** Local-only owner tag for a logged-out device. */
export const GUEST_OWNER = "guest";
/** Per Mission per language autosaved draft cap (spec §6). */
export const DRAFT_MAX_CHARS = 32_768;
/** Save Code decoded-JSON cap: rejected whole over 2 MiB (spec §6). */
export const SAVE_CODE_MAX_BYTES = 2 * 1024 * 1024;
/** Streak run-day cap: newest 400 kept (spec §6). */
export const STREAK_MAX_DAYS = 400;
/** Creation caps (ADR-0014): max 20 per Cadet, title max 40 chars. */
export const CREATION_MAX_COUNT = 20;
export const CREATION_TITLE_MAX = 40;
export const CREATION_ID_PATTERN = /^c_[0-9a-z]{12}$/;
/** localStorage key for the v2 record (v1 key stays for migration read). */
export const PROGRESS_V2_STORAGE_KEY = "satyaki-progress-v2";
/** Save Code prefix: `SSC2.` + base64url(gzip(versioned JSON)) + `.` + checksum. */
export const SAVE_CODE_PREFIX = "SSC2.";

export type CadetLanguage = "python" | "java";
export const CADET_LANGUAGES: readonly CadetLanguage[] = ["python", "java"];

export type MissionStars = 0 | 1 | 2 | 3;

export interface MissionLanguageV2 {
  draft: string;
  draftUpdatedAt: string;
  /** Best Stars earned in this language (max, never downgrades). */
  bestStars: MissionStars;
  passingCode: string | null;
  passingStars: MissionStars;
  passingUpdatedAt: string | null;
}

export interface MissionV2 {
  runs: number;
  passes: number;
  hintsUsed: number;
  firstPassAt: string | null;
  lastPassAt: string | null;
  lastLanguage: CadetLanguage | null;
  python: MissionLanguageV2;
  java: MissionLanguageV2;
}

export interface BossV2 {
  passed: boolean;
  attempts: number;
  lastAttemptAt: string | null;
}

export interface HangarV2 {
  hull: string;
  trim: string;
  thruster: string;
  laserColour: string;
}

export interface CreationDraftsV2 {
  python: string;
  java: string;
}

export interface CreationV2 {
  id: string;
  title: string;
  world: AuthoredLayout;
  goals: PassCheck[];
  drafts: CreationDraftsV2;
  updatedAt: string;
}

export interface ArenaRecordV2 {
  played: number;
  won: number;
  bestWave: number;
  lastLanguage: CadetLanguage | null;
}

export interface ProgressV2 {
  version: 2;
  missions: Record<string, MissionV2>;
  bosses: Record<string, BossV2>;
  streakDates: readonly string[];
  hangar: HangarV2;
  creations: readonly CreationV2[];
  arena: ArenaRecordV2;
  owner?: string;
}

export const EMPTY_HANGAR_V2: HangarV2 = {
  hull: "training",
  trim: "training",
  thruster: "training",
  laserColour: "training",
};

export const EMPTY_ARENA_V2: ArenaRecordV2 = {
  played: 0,
  won: 0,
  bestWave: 0,
  lastLanguage: null,
};

const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isCadetLanguage(value: unknown): value is CadetLanguage {
  return value === "python" || value === "java";
}

function sanitizeStars(value: unknown): MissionStars {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : 0;
}

function sanitizeCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const n = Math.floor(value);
  if (n <= 0) return 0;
  return Math.min(n, Number.MAX_SAFE_INTEGER);
}

function sanitizeIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 64) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : value;
}

function sanitizeIsoOrEpoch(value: unknown): string {
  const iso = sanitizeIsoOrNull(value);
  return iso ?? EPOCH_ISO;
}

function sanitizeDraftText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.length > DRAFT_MAX_CHARS ? value.slice(0, DRAFT_MAX_CHARS) : value;
}

function sanitizePassingCode(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.length > DRAFT_MAX_CHARS ? value.slice(0, DRAFT_MAX_CHARS) : value;
}

function sanitizeHangarSlot(value: unknown): string {
  if (typeof value !== "string") return "training";
  const t = value.trim();
  return isHangarTier(t) ? t : "training";
}

function sanitizeMissionLanguage(value: unknown): MissionLanguageV2 {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const bestStars = Math.max(
    sanitizeStars(v.bestStars),
    sanitizeStars(v.passingStars),
  ) as MissionStars;
  return {
    draft: sanitizeDraftText(v.draft),
    draftUpdatedAt: sanitizeIsoOrEpoch(v.draftUpdatedAt),
    bestStars,
    passingCode: sanitizePassingCode(v.passingCode),
    passingStars: sanitizeStars(v.passingStars),
    passingUpdatedAt: sanitizeIsoOrNull(v.passingUpdatedAt),
  };
}

function sanitizeMission(value: unknown): MissionV2 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const runs = sanitizeCount(v.runs);
  const passes = sanitizeCount(v.passes);
  return {
    runs: Math.max(runs, passes),
    passes,
    hintsUsed: sanitizeCount(v.hintsUsed),
    firstPassAt: sanitizeIsoOrNull(v.firstPassAt),
    lastPassAt: sanitizeIsoOrNull(v.lastPassAt),
    lastLanguage: isCadetLanguage(v.lastLanguage) ? v.lastLanguage : null,
    python: sanitizeMissionLanguage(v.python),
    java: sanitizeMissionLanguage(v.java),
  };
}

function sanitizeMissions(value: unknown): Record<string, MissionV2> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, MissionV2> = {};
  for (const [slug, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!SLUG_PATTERN.test(slug) || slug.length > 128) continue;
    const m = sanitizeMission(entry);
    if (m !== null) out[slug] = m;
  }
  return out;
}

function sanitizeBoss(value: unknown): BossV2 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    passed: v.passed === true,
    attempts: sanitizeCount(v.attempts),
    lastAttemptAt: sanitizeIsoOrNull(v.lastAttemptAt),
  };
}

function sanitizeBosses(value: unknown): Record<string, BossV2> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, BossV2> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!SLUG_PATTERN.test(key) || key.length > 128) continue;
    const b = sanitizeBoss(entry);
    if (b !== null) out[key] = b;
  }
  return out;
}

function sanitizeStreakDatesV2(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const days = [...new Set(value.filter(isStreakDate))].sort();
  return days.slice(Math.max(0, days.length - STREAK_MAX_DAYS));
}

function sanitizeHangar(value: unknown): HangarV2 {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  return {
    hull: sanitizeHangarSlot(v.hull),
    trim: sanitizeHangarSlot(v.trim),
    thruster: sanitizeHangarSlot(v.thruster),
    laserColour: sanitizeHangarSlot((v as Record<string, unknown>).laserColour),
  };
}

function isValidWorld(value: unknown): value is AuthoredLayout {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  const bounds = w.bounds as Record<string, unknown> | undefined;
  const shipStart = w.shipStart as Record<string, unknown> | undefined;
  if (typeof bounds !== "object" || bounds === null) return false;
  if (typeof shipStart !== "object" || shipStart === null) return false;
  for (const k of ["maxX", "maxY", "maxZ"] as const) {
    if (typeof bounds[k] !== "number" || !Number.isFinite(bounds[k] as number)) return false;
  }
  if ((bounds.maxX as number) > 16 || (bounds.maxY as number) > 6 || (bounds.maxZ as number) > 16)
    return false;
  if (!Array.isArray(w.entities) || (w.entities as unknown[]).length > 40) return false;
  return true;
}

function sanitizeGoals(value: unknown): PassCheck[] {
  if (!Array.isArray(value)) return [];
  const out: PassCheck[] = [];
  // ADR-0014: 1-3 goals; a reach-cell goal expands to one check per axis,
  // so up to 9 flattened checks survive sanitization (content precedent:
  // a reach objective pairs a ship.x check with a lane check).
  for (const g of value.slice(0, 9)) {
    if (typeof g !== "object" || g === null) continue;
    const goal = g as Record<string, unknown>;
    if (
      typeof goal.id !== "string" ||
      typeof goal.label !== "string" ||
      typeof goal.statePath !== "string" ||
      typeof goal.comparator !== "string" ||
      !["eq", "ne", "gte", "lte"].includes(goal.comparator as string) ||
      (typeof goal.expected !== "string" &&
        typeof goal.expected !== "number" &&
        typeof goal.expected !== "boolean") ||
      (goal.timing !== "final" && goal.timing !== "intermediate")
    )
      continue;
    out.push(goal as unknown as PassCheck);
  }
  return out;
}

function sanitizeCreation(value: unknown): CreationV2 | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !CREATION_ID_PATTERN.test(v.id)) return null;
  if (typeof v.title !== "string" || v.title.length === 0) return null;
  if (!isValidWorld(v.world)) return null;
  const updatedAt = sanitizeIsoOrNull(v.updatedAt);
  if (updatedAt === null) return null;
  const drafts = (typeof v.drafts === "object" && v.drafts !== null ? v.drafts : {}) as Record<
    string,
    unknown
  >;
  return {
    id: v.id,
    title: v.title.slice(0, CREATION_TITLE_MAX),
    world: v.world,
    goals: sanitizeGoals(v.goals),
    drafts: {
      python: sanitizeDraftText(drafts.python),
      java: sanitizeDraftText(drafts.java),
    },
    updatedAt,
  };
}

function sanitizeCreations(value: unknown): readonly CreationV2[] {
  if (!Array.isArray(value)) return [];
  const valid: CreationV2[] = [];
  for (const entry of value) {
    const c = sanitizeCreation(entry);
    if (c !== null) valid.push(c);
  }
  valid.sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1,
  );
  return valid.slice(0, CREATION_MAX_COUNT);
}

function sanitizeArena(value: unknown): ArenaRecordV2 {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const played = sanitizeCount(v.played);
  const won = Math.min(sanitizeCount(v.won), played);
  const bestWave = Math.min(sanitizeCount(v.bestWave), 5);
  return {
    played,
    won,
    bestWave,
    lastLanguage: isCadetLanguage(v.lastLanguage) ? v.lastLanguage : null,
  };
}

function sanitizeOwner(value: unknown): string {
  if (value === undefined) return GUEST_OWNER;
  if (typeof value !== "string" || value.length === 0 || value.length > 128) return GUEST_OWNER;
  if (value !== GUEST_OWNER && !/^[A-Za-z0-9_-]+$/.test(value)) return GUEST_OWNER;
  return value;
}

/** Empty v2 record: no Missions, no Boss Gates, guest owner. */
export function emptyProgressV2(owner: string = GUEST_OWNER): ProgressV2 {
  return {
    version: PROGRESS_V2_VERSION,
    missions: {},
    bosses: {},
    streakDates: [],
    hangar: { ...EMPTY_HANGAR_V2 },
    creations: [],
    arena: { ...EMPTY_ARENA_V2 },
    owner: sanitizeOwner(owner),
  };
}

export const EMPTY_PROGRESS_V2: ProgressV2 = emptyProgressV2();

/**
 * Sanitize any unknown value into a v2 record. Unknown `version` means no
 * progress; each known field sanitizes on its own so one corrupt entry
 * loses only itself (ADR-0010). v1 records (version 1) keep streak dates
 * only; v1 passes never convert to Missions.
 */
export function sanitizeProgressV2(value: unknown): ProgressV2 {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return emptyProgressV2();
  const v = value as Record<string, unknown>;
  if (v.version === 1) {
    return {
      ...emptyProgressV2(),
      streakDates: sanitizeStreakDatesV2(v.streakDates),
    };
  }
  if (v.version !== PROGRESS_V2_VERSION) return emptyProgressV2();
  return {
    version: PROGRESS_V2_VERSION,
    missions: sanitizeMissions(v.missions),
    bosses: sanitizeBosses(v.bosses),
    streakDates: sanitizeStreakDatesV2(v.streakDates),
    hangar: sanitizeHangar(v.hangar),
    creations: sanitizeCreations(v.creations),
    arena: sanitizeArena(v.arena),
    owner: sanitizeOwner(v.owner),
  };
}

/** Parse stored v2 JSON text; corrupt text means empty progress. */
export function parseProgressV2(raw: string | null): ProgressV2 {
  if (raw === null || raw === "") return emptyProgressV2();
  try {
    return sanitizeProgressV2(JSON.parse(raw));
  } catch {
    return emptyProgressV2();
  }
}

/** Serialize a v2 record as the single stored JSON record. */
export function serializeProgressV2(progress: ProgressV2): string {
  const clean = sanitizeProgressV2(progress);
  return JSON.stringify(clean);
}

/** Carry v1 streak dates into an empty v2 record (v1 passes do not convert). */
export function migrateV1StreakToV2(v1: Progress): ProgressV2 {
  return {
    ...emptyProgressV2(),
    streakDates: sanitizeStreakDatesV2(v1.streakDates),
  };
}

// --- Derived: Mission Stars, totals, unlocks, streak (never stored) ---

/** Mission Stars: best across Python and Java (ADR-0010). Unpassed is 0. */
export function missionStarsV2(progress: ProgressV2, slug: string): MissionStars {
  const m = progress.missions[slug];
  if (!m) return 0;
  return Math.max(m.python.bestStars, m.java.bestStars) as MissionStars;
}

/** Total Stars, derived on read, max 75 (25 Missions × 3). */
export function totalStarsV2(progress: ProgressV2): number {
  let sum = 0;
  for (const slug of Object.keys(progress.missions)) sum += missionStarsV2(progress, slug);
  return Math.min(sum, 75);
}

export function isMissionPassedV2(progress: ProgressV2, slug: string): boolean {
  return missionStarsV2(progress, slug) > 0;
}

// --- Linear unlocks (derived, never stored): Mission → previous Pass;
// Boss Gate → five Passes; next Planet → Boss Gate. Needs Planet packs. ---

function findPack(packs: readonly PlanetPack[], planet: string): PlanetPack | undefined {
  return packs.find((p) => p.planet.slug === planet || p.planet.id === planet);
}

function packIndex(packs: readonly PlanetPack[], planet: string): number {
  return packs.findIndex((p) => p.planet.slug === planet || p.planet.id === planet);
}

function bossFor(progress: ProgressV2, pack: PlanetPack): BossV2 | undefined {
  return progress.bosses[pack.planet.slug] ?? progress.bosses[pack.planet.id];
}

/** Planet slug owning a Mission slug, or null when unknown. */
export function planetOfMissionV2(
  packs: readonly PlanetPack[],
  slug: string,
): string | null {
  for (const pack of packs) {
    if (pack.planet.missionSlugs.includes(slug)) return pack.planet.slug;
  }
  return null;
}

/** True when the planet is open: first planet, else previous Boss Gate passed. */
export function isPlanetOpenV2(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
  planet: string,
): boolean {
  const idx = packIndex(packs, planet);
  if (idx < 0) return false;
  if (idx === 0) return true;
  const prev = packs[idx - 1];
  const boss = bossFor(progress, prev);
  return boss?.passed === true;
}

/** True when all five Planet Missions passed (Boss Gate open). */
export function isBossOpenV2(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
  planet: string,
): boolean {
  const pack = findPack(packs, planet);
  if (!pack) return false;
  return pack.planet.missionSlugs.every((slug) => isMissionPassedV2(progress, slug));
}

/** True when the Boss Gate passed flag is set. */
export function isBossPassedV2(progress: ProgressV2, planet: string): boolean {
  return progress.bosses[planet]?.passed === true;
}

/** True when a Mission is open under the linear unlock rule. */
export function isMissionOpenV2(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
  slug: string,
): boolean {
  for (let pi = 0; pi < packs.length; pi++) {
    const pack = packs[pi];
    const slugs = pack.planet.missionSlugs;
    const mi = slugs.indexOf(slug);
    if (mi < 0) continue;
    if (pi === 0 && mi === 0) return true;
    if (mi > 0) return isMissionPassedV2(progress, slugs[mi - 1]);
    const boss = bossFor(progress, packs[pi - 1]);
    return boss?.passed === true;
  }
  return false;
}

/** First open unpassed Mission slug in pack order, or null when none. */
export function firstOpenMissionV2(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
): string | null {
  for (const pack of packs) {
    for (const slug of pack.planet.missionSlugs) {
      if (!isMissionPassedV2(progress, slug) && isMissionOpenV2(progress, packs, slug)) {
        return slug;
      }
    }
  }
  return null;
}

/**
 * Strict v2 streak: consecutive run days ending at `today` or yesterday.
 * Any full missed day breaks the chain (no v1 forgiveness).
 */
export function streakCountV2(progress: ProgressV2, today: string): number {
  if (!isStreakDate(today)) return 0;
  const todayNumber = dayNumber(today);
  const days = (sanitizeStreakDatesV2(progress.streakDates) as string[])
    .map(dayNumber)
    .filter((d) => d <= todayNumber);
  if (days.length === 0) return 0;
  if (todayNumber - days[days.length - 1] > 1) return 0;
  let count = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (days[i] - days[i - 1] !== 1) break;
    count += 1;
  }
  return count;
}

// --- Updates: runs and passes (pure; caller persists the returned record) ---

function emptyMissionLanguageV2(): MissionLanguageV2 {
  return {
    draft: "",
    draftUpdatedAt: EPOCH_ISO,
    bestStars: 0,
    passingCode: null,
    passingStars: 0,
    passingUpdatedAt: null,
  };
}

function emptyMissionV2(): MissionV2 {
  return {
    runs: 0,
    passes: 0,
    hintsUsed: 0,
    firstPassAt: null,
    lastPassAt: null,
    lastLanguage: null,
    python: emptyMissionLanguageV2(),
    java: emptyMissionLanguageV2(),
  };
}

/** Record a Mission Run day; malformed dates are dropped. */
export function recordRunDayV2(progress: ProgressV2, date: string): ProgressV2 {
  return sanitizeProgressV2({
    ...progress,
    streakDates: [...progress.streakDates, date],
  });
}

/**
 * Record one Mission Run in a language: runs + 1 and last language set.
 * When `date` is given it joins the streak dates in the same record.
 */
export function recordMissionRunV2(
  progress: ProgressV2,
  slug: string,
  language: CadetLanguage,
  date?: string,
): ProgressV2 {
  if (!SLUG_PATTERN.test(slug)) return sanitizeProgressV2(progress);
  const prev = progress.missions[slug] ?? emptyMissionV2();
  return sanitizeProgressV2({
    ...progress,
    missions: {
      ...progress.missions,
      [slug]: {
        ...prev,
        runs: prev.runs + 1,
        lastLanguage: language,
        python: { ...prev.python },
        java: { ...prev.java },
      },
    },
    streakDates: date === undefined ? progress.streakDates : [...progress.streakDates, date],
  });
}

export interface MissionPassInput {
  slug: string;
  language: CadetLanguage;
  stars: MissionStars;
  /** Passing program text; stored per the ADR-0010 replacement rule. */
  code?: string | null;
  /** Pass time as ISO; defaults to now. */
  at?: string;
  /** Local run day YYYY-MM-DD; joins streak dates when given. */
  date?: string;
  /** Hints used delta for this Pass (default 0). */
  hintsUsedDelta?: number;
}

/**
 * Record one Mission Pass: passes + 1 (and runs + 1, a Pass is a Run),
 * best Stars per language take the max, passing code replaces only on more
 * Stars (equal Stars: newer wins), first/last Pass times maintained.
 */
export function recordMissionPassV2(progress: ProgressV2, input: MissionPassInput): ProgressV2 {
  if (!SLUG_PATTERN.test(input.slug)) return sanitizeProgressV2(progress);
  const at = sanitizeIsoOrNull(input.at) ?? new Date().toISOString();
  const prev = progress.missions[input.slug] ?? emptyMissionV2();
  const langPrev = prev[input.language];
  const stars = sanitizeStars(input.stars);
  const bestStars = Math.max(langPrev.bestStars, stars) as MissionStars;
  let passingCode = langPrev.passingCode;
  let passingStars = langPrev.passingStars;
  let passingUpdatedAt = langPrev.passingUpdatedAt;
  const candidateCode = input.code ?? null;
  if (candidateCode !== null && stars > 0) {
    if (stars > passingStars) {
      passingCode = sanitizePassingCode(candidateCode);
      passingStars = stars;
      passingUpdatedAt = at;
    } else if (stars === passingStars && stars > 0) {
      if (passingUpdatedAt === null || at >= passingUpdatedAt) {
        passingCode = sanitizePassingCode(candidateCode);
        passingStars = stars;
        passingUpdatedAt = at;
      }
    }
  } else if (stars > passingStars) {
    passingStars = stars;
    passingUpdatedAt = at;
  } else if (stars === passingStars && stars > 0 && passingUpdatedAt === null) {
    passingUpdatedAt = at;
  }
  const firstPassAt = prev.firstPassAt === null || at < prev.firstPassAt ? at : prev.firstPassAt;
  const lastPassAt = prev.lastPassAt === null || at >= prev.lastPassAt ? at : prev.lastPassAt;
  return sanitizeProgressV2({
    ...progress,
    missions: {
      ...progress.missions,
      [input.slug]: {
        runs: prev.runs + 1,
        passes: prev.passes + 1,
        hintsUsed: prev.hintsUsed + sanitizeCount(input.hintsUsedDelta),
        firstPassAt,
        lastPassAt,
        lastLanguage: input.language,
        python:
          input.language === "python"
            ? { ...langPrev, bestStars, passingCode, passingStars, passingUpdatedAt }
            : { ...prev.python },
        java:
          input.language === "java"
            ? { ...langPrev, bestStars, passingCode, passingStars, passingUpdatedAt }
            : { ...prev.java },
      },
    },
    streakDates: input.date === undefined ? progress.streakDates : [...progress.streakDates, input.date],
  });
}

/** Save a Mission draft; truncates over the 32,768 cap, orders by updatedAt. */
export function saveDraftV2(
  progress: ProgressV2,
  slug: string,
  language: CadetLanguage,
  draft: string,
  updatedAt?: string,
): ProgressV2 {
  if (!SLUG_PATTERN.test(slug)) return sanitizeProgressV2(progress);
  const prev = progress.missions[slug] ?? emptyMissionV2();
  const at = sanitizeIsoOrNull(updatedAt) ?? new Date().toISOString();
  return sanitizeProgressV2({
    ...progress,
    missions: {
      ...progress.missions,
      [slug]: {
        ...prev,
        python:
          language === "python"
            ? { ...prev.python, draft: sanitizeDraftText(draft), draftUpdatedAt: at }
            : { ...prev.python },
        java:
          language === "java"
            ? { ...prev.java, draft: sanitizeDraftText(draft), draftUpdatedAt: at }
            : { ...prev.java },
      },
    },
  });
}

/** Record a Boss Gate attempt; a clear sets passed and never downgrades. */
export function recordBossAttemptV2(
  progress: ProgressV2,
  planet: string,
  passed: boolean,
  at?: string,
): ProgressV2 {
  if (!SLUG_PATTERN.test(planet)) return sanitizeProgressV2(progress);
  const prev = progress.bosses[planet] ?? { passed: false, attempts: 0, lastAttemptAt: null };
  const stamp = sanitizeIsoOrNull(at) ?? new Date().toISOString();
  return sanitizeProgressV2({
    ...progress,
    bosses: {
      ...progress.bosses,
      [planet]: {
        passed: prev.passed || passed,
        attempts: prev.attempts + 1,
        lastAttemptAt: stamp,
      },
    },
  });
}

function mintCreationId(): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz";
  let tail = "";
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) tail += chars[b % 36];
  } else {
    for (let i = 0; i < 12; i++) tail += chars[Math.floor(Math.random() * 36)];
  }
  return `c_${tail}`;
}

/** True for a minted Creation id (`c_` + 12 base36). */
export function isCreationId(value: unknown): value is string {
  return typeof value === "string" && CREATION_ID_PATTERN.test(value);
}

export interface SaveCreationInput {
  title: string;
  world: AuthoredLayout;
  goals?: PassCheck[];
  drafts?: { python?: string; java?: string };
  updatedAt?: string;
}

/** Save a Creation copy; at the 20-cap the oldest is dropped. */
export function saveCreationV2(progress: ProgressV2, input: SaveCreationInput): ProgressV2 {
  const updatedAt = sanitizeIsoOrNull(input.updatedAt) ?? new Date().toISOString();
  const creation: CreationV2 = {
    id: mintCreationId(),
    title: input.title.slice(0, CREATION_TITLE_MAX),
    world: input.world,
    goals: sanitizeGoals(input.goals ?? []),
    drafts: {
      python: sanitizeDraftText(input.drafts?.python),
      java: sanitizeDraftText(input.drafts?.java),
    },
    updatedAt,
  };
  if (!isValidWorld(creation.world) || creation.title.length === 0) {
    return sanitizeProgressV2(progress);
  }
  return sanitizeProgressV2({
    ...progress,
    creations: [creation, ...progress.creations],
  });
}

/** Record one finished Arena battle; abandoned battles write nothing. */
export function recordArenaBattleV2(
  progress: ProgressV2,
  result: { won: boolean; wave: number; language: CadetLanguage },
): ProgressV2 {
  return sanitizeProgressV2({
    ...progress,
    arena: {
      played: progress.arena.played + 1,
      won: progress.arena.won + (result.won ? 1 : 0),
      bestWave: Math.min(5, Math.max(progress.arena.bestWave, sanitizeCount(result.wave))),
      lastLanguage: result.language,
    },
  });
}

// --- Merge: one per-field rule for login, Save Code import, multi-device ---

function laterIso(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return b >= a ? b : a;
}

function mergeMissionLanguage(a: MissionLanguageV2, b: MissionLanguageV2): MissionLanguageV2 {
  const draft = b.draftUpdatedAt >= a.draftUpdatedAt ? b.draft : a.draft;
  const draftUpdatedAt =
    b.draftUpdatedAt >= a.draftUpdatedAt ? b.draftUpdatedAt : a.draftUpdatedAt;
  let passingCode = a.passingCode;
  let passingStars = a.passingStars;
  let passingUpdatedAt = a.passingUpdatedAt;
  if (b.passingStars > passingStars) {
    passingCode = b.passingCode;
    passingStars = b.passingStars;
    passingUpdatedAt = b.passingUpdatedAt;
  } else if (b.passingStars === passingStars && b.passingStars > 0) {
    if (
      b.passingUpdatedAt !== null &&
      (passingUpdatedAt === null || b.passingUpdatedAt >= passingUpdatedAt)
    ) {
      passingCode = b.passingCode;
      passingStars = b.passingStars;
      passingUpdatedAt = b.passingUpdatedAt;
    }
  }
  return {
    draft,
    draftUpdatedAt,
    bestStars: Math.max(a.bestStars, b.bestStars) as MissionStars,
    passingCode,
    passingStars,
    passingUpdatedAt,
  };
}

function mergeMission(a: MissionV2, b: MissionV2): MissionV2 {
  const firstPassAt =
    a.firstPassAt === null
      ? b.firstPassAt
      : b.firstPassAt === null
        ? a.firstPassAt
        : a.firstPassAt <= b.firstPassAt
          ? a.firstPassAt
          : b.firstPassAt;
  const lastPassAt = laterIso(a.lastPassAt, b.lastPassAt);
  return {
    runs: Math.max(a.runs, b.runs),
    passes: Math.max(a.passes, b.passes),
    hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
    firstPassAt,
    lastPassAt,
    lastLanguage:
      (b.lastPassAt ?? "") >= (a.lastPassAt ?? "")
        ? (b.lastLanguage ?? a.lastLanguage)
        : a.lastLanguage,
    python: mergeMissionLanguage(a.python, b.python),
    java: mergeMissionLanguage(a.java, b.java),
  };
}

function mergeBoss(a: BossV2, b: BossV2): BossV2 {
  return {
    passed: a.passed || b.passed,
    attempts: Math.max(a.attempts, b.attempts),
    lastAttemptAt: laterIso(a.lastAttemptAt, b.lastAttemptAt),
  };
}

function mergeArena(a: ArenaRecordV2, b: ArenaRecordV2): ArenaRecordV2 {
  const played = Math.max(a.played, b.played);
  return {
    played,
    won: Math.min(Math.max(a.won, b.won), played),
    bestWave: Math.min(5, Math.max(a.bestWave, b.bestWave)),
    lastLanguage: b.played > a.played ? (b.lastLanguage ?? a.lastLanguage) : a.lastLanguage,
  };
}

function mergeHangar(a: HangarV2, b: HangarV2): HangarV2 {
  const pick = (x: string, y: string): string => {
    if (x === y) return x;
    // An unequipped default never overwrites an equipped cosmetic: the
    // training default is the only value a record holds before its Cadet
    // equips anything, so preferring the other side keeps equips through
    // sync (both merge orders) and Save Code import. Two differing
    // equipped values keep the current (`a`) side, deterministically.
    if (x === "" || x === "training") return y;
    if (y === "" || y === "training") return x;
    return x;
  };
  return {
    hull: pick(a.hull, b.hull),
    trim: pick(a.trim, b.trim),
    thruster: pick(a.thruster, b.thruster),
    laserColour: pick(a.laserColour, b.laserColour),
  };
}

/**
 * One per-field merge (ADR-0010): Stars/Boss Gates/streak dates union with
 * higher Stars winning and never a downgrade; drafts per Mission+language
 * by `updatedAt`; Creations by id with newest whole-Creation winning.
 * Owner stays on the current (`a`) record; use `loginMergeV2` for login.
 */
export function mergeProgressV2(a: ProgressV2, b: ProgressV2): ProgressV2 {
  const cleanA = sanitizeProgressV2(a);
  const cleanB = sanitizeProgressV2(b);
  const slugs = new Set([...Object.keys(cleanA.missions), ...Object.keys(cleanB.missions)]);
  const missions: Record<string, MissionV2> = {};
  for (const slug of slugs) {
    const ma = cleanA.missions[slug];
    const mb = cleanB.missions[slug];
    missions[slug] = ma && mb ? mergeMission(ma, mb) : (ma ?? mb)!;
  }
  const planets = new Set([...Object.keys(cleanA.bosses), ...Object.keys(cleanB.bosses)]);
  const bosses: Record<string, BossV2> = {};
  for (const planet of planets) {
    const ba = cleanA.bosses[planet];
    const bb = cleanB.bosses[planet];
    bosses[planet] = ba && bb ? mergeBoss(ba, bb) : (ba ?? bb)!;
  }
  const byId = new Map<string, CreationV2>();
  for (const c of cleanA.creations) byId.set(c.id, c);
  for (const c of cleanB.creations) {
    const prev = byId.get(c.id);
    if (!prev || c.updatedAt >= prev.updatedAt) byId.set(c.id, c);
  }
  const creations = [...byId.values()]
    .sort((x, y) =>
      x.updatedAt < y.updatedAt ? 1 : x.updatedAt > y.updatedAt ? -1 : x.id < y.id ? -1 : 1,
    )
    .slice(0, CREATION_MAX_COUNT);
  const streakDates = [
    ...new Set([...cleanA.streakDates, ...cleanB.streakDates].filter(isStreakDate)),
  ]
    .sort()
    .slice(-STREAK_MAX_DAYS);
  return {
    version: PROGRESS_V2_VERSION,
    missions,
    bosses,
    streakDates,
    hangar: mergeHangar(cleanA.hangar, cleanB.hangar),
    creations,
    arena: mergeArena(cleanA.arena, cleanB.arena),
    owner: cleanA.owner,
  };
}

export interface LoginMergeV2 {
  progress: ProgressV2;
  /** True when a different Account replaced the local record. */
  replaced: boolean;
}

/**
 * Login merge: merges only when the local owner is `guest` or the same
 * Account; a different Account replaces the local record (the old Account
 * stays intact on the server).
 */
export function loginMergeV2(
  local: ProgressV2,
  server: ProgressV2,
  accountId: string,
): LoginMergeV2 {
  const cleanLocal = sanitizeProgressV2(local);
  const cleanServer = sanitizeProgressV2(server);
  const owner = sanitizeOwner(accountId);
  if (cleanLocal.owner === GUEST_OWNER || cleanLocal.owner === owner) {
    return {
      progress: { ...mergeProgressV2(cleanLocal, cleanServer), owner },
      replaced: false,
    };
  }
  return { progress: { ...cleanServer, owner }, replaced: true };
}

// --- Save Code codec: SSC2. + base64url(gzip(versioned JSON)) + checksum ---

function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = typeof Buffer !== "undefined"
    ? Buffer.from(binary, "binary").toString("base64")
    : btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length === 0) return null;
  let base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  try {
    const binary =
      typeof Buffer !== "undefined"
        ? Buffer.from(base64, "base64").toString("binary")
        : atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

export type SaveCodeDecodeReason =
  | "bad-format"
  | "bad-checksum"
  | "decompress-failed"
  | "invalid-json"
  | "unknown-version"
  | "too-large";

export type SaveCodeDecode =
  | { ok: true; record: ProgressV2 }
  | { ok: false; reason: SaveCodeDecodeReason };

/** Encode a v2 record as a Save Code (owner stays local, never exported). */
export function encodeSaveCodeV2(progress: ProgressV2): string {
  const clean = sanitizeProgressV2(progress);
  const { owner: _owner, ...exported } = clean;
  void _owner;
  const json = JSON.stringify({ ...exported, version: PROGRESS_V2_VERSION });
  const payload = bytesToBase64Url(gzipSync(new TextEncoder().encode(json)));
  return `${SAVE_CODE_PREFIX}${payload}.${fnv1aHex(payload)}`;
}

/**
 * Decode a Save Code. Unknown version or decoded payload over 2 MiB
 * rejects the whole Code; single malformed entries drop via sanitization.
 */
export function decodeSaveCodeV2(code: string): SaveCodeDecode {
  if (typeof code !== "string" || !code.startsWith(SAVE_CODE_PREFIX)) {
    return { ok: false, reason: "bad-format" };
  }
  const rest = code.slice(SAVE_CODE_PREFIX.length);
  const dot = rest.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "bad-format" };
  const payload = rest.slice(0, dot);
  const checksum = rest.slice(dot + 1);
  if (!/^[0-9a-f]{8}$/.test(checksum) || fnv1aHex(payload) !== checksum) {
    return { ok: false, reason: "bad-checksum" };
  }
  const compressed = base64UrlToBytes(payload);
  if (compressed === null) return { ok: false, reason: "bad-format" };
  let raw: Uint8Array;
  try {
    raw = gunzipSync(compressed);
  } catch {
    return { ok: false, reason: "decompress-failed" };
  }
  if (raw.length > SAVE_CODE_MAX_BYTES) return { ok: false, reason: "too-large" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { ok: false, reason: "invalid-json" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "invalid-json" };
  }
  const version = (parsed as Record<string, unknown>).version;
  if (version !== PROGRESS_V2_VERSION) return { ok: false, reason: "unknown-version" };
  return { ok: true, record: sanitizeProgressV2(parsed) };
}

export interface SaveCodePreviewV2 {
  newMissions: string[];
  starsGained: number;
  draftsReplaced: number;
  passingReplaced: number;
  creationsAdded: number;
  creationsUpdated: number;
  totalStarsBefore: number;
  totalStarsAfter: number;
}

/**
 * Preview what a Save Code import would gain: Missions gained, Stars
 * gained, and code replaced. Counts only, applies nothing.
 */
export function previewSaveCodeImportV2(
  current: ProgressV2,
  incoming: ProgressV2,
): SaveCodePreviewV2 {
  const a = sanitizeProgressV2(current);
  const b = sanitizeProgressV2(incoming);
  const newMissions: string[] = [];
  let starsGained = 0;
  let draftsReplaced = 0;
  let passingReplaced = 0;
  for (const [slug, mb] of Object.entries(b.missions)) {
    const ma = a.missions[slug];
    const before = ma ? Math.max(ma.python.bestStars, ma.java.bestStars) : 0;
    const after = Math.max(mb.python.bestStars, mb.java.bestStars);
    if (after > 0 && before === 0) newMissions.push(slug);
    if (after > before) starsGained += after - before;
    if (ma) {
      for (const lang of CADET_LANGUAGES) {
        if (
          mb[lang].draft !== ma[lang].draft &&
          mb[lang].draftUpdatedAt >= ma[lang].draftUpdatedAt
        ) {
          draftsReplaced += 1;
        }
        if (
          mb[lang].passingCode !== null &&
          mb[lang].passingCode !== ma[lang].passingCode &&
          (mb[lang].passingStars > ma[lang].passingStars ||
            (mb[lang].passingStars === ma[lang].passingStars &&
              mb[lang].passingStars > 0 &&
              (mb[lang].passingUpdatedAt ?? "") >= (ma[lang].passingUpdatedAt ?? "")))
        ) {
          passingReplaced += 1;
        }
      }
    } else {
      for (const lang of CADET_LANGUAGES) {
        if (mb[lang].draft !== "") draftsReplaced += 1;
        if (mb[lang].passingCode !== null) passingReplaced += 1;
      }
    }
  }
  newMissions.sort();
  const beforeIds = new Set(a.creations.map((c) => c.id));
  let creationsAdded = 0;
  let creationsUpdated = 0;
  for (const c of b.creations) {
    const prev = a.creations.find((x) => x.id === c.id);
    if (!prev && !beforeIds.has(c.id)) creationsAdded += 1;
    else if (prev && c.updatedAt > prev.updatedAt) creationsUpdated += 1;
  }
  const merged = mergeProgressV2(a, b);
  return {
    newMissions,
    starsGained,
    draftsReplaced,
    passingReplaced,
    creationsAdded,
    creationsUpdated,
    totalStarsBefore: totalStarsV2(a),
    totalStarsAfter: totalStarsV2(merged),
  };
}

/** Apply a confirmed Save Code import (preview first, then merge). */
export function applySaveCodeImportV2(current: ProgressV2, incoming: ProgressV2): ProgressV2 {
  return mergeProgressV2(current, incoming);
}
