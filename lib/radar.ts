// Skill Radar and Daily Recall Drill (ADR-0015, pure TS core).
// Glossary: Skill Radar, Daily Recall Drill, Mission, Pass, Star.
// Derived on read from the v2 aggregates; never stored (ADR-0010).
// No framework, DOM, or worker imports.

import type { PlanetPack } from "./content";
import {
  isPlanetOpenV2,
  missionStarsV2,
  type CadetLanguage,
  type MissionStars,
  type ProgressV2,
} from "./progress";

/** One radar axis: Planet slug, 0–100 score, locked mark. */
export interface RadarAxisV2 {
  planet: string;
  score: number;
  locked: boolean;
}

/** localStorage key for the frozen daily pick (outside the record). */
export const DRILL_PICK_KEY = "satyaki-drill-pick";

/**
 * Planet score: mean of Mission best-Stars/3 across its five Missions,
 * times 100, rounded. Unpassed Missions contribute 0. Counts, hints, and
 * times never change the score; scores never decay.
 */
export function planetScoreV2(
  progress: ProgressV2,
  missionSlugs: readonly string[],
): number {
  if (missionSlugs.length === 0) return 0;
  let sum = 0;
  for (const slug of missionSlugs) sum += missionStarsV2(progress, slug) / 3;
  return Math.round((sum / missionSlugs.length) * 100);
}

/**
 * Five axes in pack order, always rendered. A locked or unstarted Planet
 * scores 0 and carries the locked mark.
 */
export function skillRadarV2(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
): RadarAxisV2[] {
  return packs.map((pack) => {
    const locked = !isPlanetOpenV2(progress, packs, pack.planet.slug);
    const score = locked ? 0 : planetScoreV2(progress, pack.planet.missionSlugs);
    return { planet: pack.planet.slug, score, locked };
  });
}

function scoreByPlanet(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const pack of packs) {
    map.set(pack.planet.slug, planetScoreV2(progress, pack.planet.missionSlugs));
  }
  return map;
}

function fnv1aInt(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function passDay(lastPassAt: string | null): string | null {
  if (lastPassAt === null) return null;
  return lastPassAt.length >= 10 ? lastPassAt.slice(0, 10) : null;
}

/**
 * Drill pool: Passed Missions only, entering the pool the local day after
 * the Pass. A Mission passed today is not eligible today; when every
 * Passed Mission was passed today there is no drill. Boss Gates,
 * Playground, and Arena never enter (no per-Mission aggregates).
 * A 3-Star Mission stays eligible at lowest priority.
 */
export function drillPoolV2(
  progress: ProgressV2,
  today: string,
  packs: readonly PlanetPack[],
): string[] {
  const pool: string[] = [];
  for (const pack of packs) {
    for (const slug of pack.planet.missionSlugs) {
      const m = progress.missions[slug];
      if (!m || m.passes <= 0) continue;
      if (missionStarsV2(progress, slug) <= 0) continue;
      const day = passDay(m.lastPassAt);
      if (day === null) {
        pool.push(slug);
        continue;
      }
      if (day < today) pool.push(slug);
    }
  }
  return pool.sort();
}

interface DrillRow {
  slug: string;
  planetScore: number;
  stars: MissionStars;
  lastPassAt: string | null;
  hintsUsed: number;
  ratio: number;
  tiebreak: number;
}

/**
 * Pick one drill slug per ADR-0015 order: lowest Planet score; fewest
 * Mission Stars; longest since last Pass; most hints used; lowest
 * passes-to-runs ratio; then hash of local date + slug. Returns null
 * when the pool is empty (no Pass, or every Pass was today).
 */
export function selectDailyDrillV2(
  progress: ProgressV2,
  today: string,
  packs: readonly PlanetPack[],
): string | null {
  const pool = drillPoolV2(progress, today, packs);
  if (pool.length === 0) return null;
  const scores = scoreByPlanet(progress, packs);
  const planetOf = new Map<string, string>();
  for (const pack of packs) {
    for (const slug of pack.planet.missionSlugs) planetOf.set(slug, pack.planet.slug);
  }
  const rows: DrillRow[] = pool.map((slug) => {
    const m = progress.missions[slug]!;
    const planet = planetOf.get(slug) ?? "";
    return {
      slug,
      planetScore: scores.get(planet) ?? 0,
      stars: missionStarsV2(progress, slug),
      lastPassAt: m.lastPassAt,
      hintsUsed: m.hintsUsed,
      ratio: m.passes / Math.max(1, m.runs),
      tiebreak: fnv1aInt(`${today}:${slug}`),
    };
  });
  rows.sort((a, b) => {
    if (a.planetScore !== b.planetScore) return a.planetScore - b.planetScore;
    if (a.stars !== b.stars) return a.stars - b.stars;
    const at = a.lastPassAt ?? "";
    const bt = b.lastPassAt ?? "";
    if (at !== bt) return at < bt ? -1 : 1;
    if (a.hintsUsed !== b.hintsUsed) return b.hintsUsed - a.hintsUsed;
    if (a.ratio !== b.ratio) return a.ratio - b.ratio;
    if (a.tiebreak !== b.tiebreak) return a.tiebreak - b.tiebreak;
    return a.slug < b.slug ? -1 : 1;
  });
  return rows[0].slug;
}

/**
 * Drill language: lower best Stars first. A tie goes to the language not
 * used last; a further tie is the Cadet's pick (null).
 */
export function drillLanguageV2(
  progress: ProgressV2,
  slug: string,
): CadetLanguage | null {
  const m = progress.missions[slug];
  if (!m) return null;
  if (m.python.bestStars !== m.java.bestStars) {
    return m.python.bestStars < m.java.bestStars ? "python" : "java";
  }
  if (m.lastLanguage === "python") return "java";
  if (m.lastLanguage === "java") return "python";
  return null;
}

/** Frozen daily pick, held outside the progress record and sync. */
export interface DrillPickV2 {
  date: string;
  slug: string;
  completed: boolean;
}

/** Parse a stored drill pick; malformed state means no pick. */
export function parseDrillPickV2(raw: string | null): DrillPickV2 | null {
  if (raw === null || raw === "") return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    if (typeof v.date !== "string" || typeof v.slug !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return null;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug)) return null;
    return { date: v.date, slug: v.slug, completed: v.completed === true };
  } catch {
    return null;
  }
}

/** Serialize a drill pick for local state. */
export function serializeDrillPickV2(pick: DrillPickV2): string {
  return JSON.stringify({ date: pick.date, slug: pick.slug, completed: pick.completed });
}

/**
 * Resolve the frozen pick for `today`: keep the stored pick when its date
 * matches today; otherwise freeze a fresh selection (runs and Passes
 * during the day never shift the pick). Returns null when no drill.
 */
export function resolveDrillPickV2(
  stored: DrillPickV2 | null,
  today: string,
  progress: ProgressV2,
  packs: readonly PlanetPack[],
): DrillPickV2 | null {
  if (stored !== null && stored.date === today) return stored;
  const slug = selectDailyDrillV2(progress, today, packs);
  if (slug === null) return null;
  return { date: today, slug, completed: false };
}

/**
 * Mark the frozen pick complete when a Pass lands on the picked slug
 * that day (from the drill card or normal Mission play).
 */
export function markDrillCompleteV2(
  pick: DrillPickV2 | null,
  today: string,
  slug: string,
): DrillPickV2 | null {
  if (pick === null || pick.date !== today || pick.slug !== slug) return pick;
  return { ...pick, completed: true };
}
