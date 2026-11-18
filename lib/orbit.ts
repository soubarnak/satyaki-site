// Orbit home map derivation (spec §§3,6,10, issue #68, ADR-0010/0015).
// Glossary: Mission, Planet, Boss Gate, Pass, Star, Skill Radar,
// Daily Recall Drill, Cadet. Pure core: no framework, DOM, or worker
// imports. All numbers derive from lib/progress v2 + lib/radar on read.

import type { PlanetPack } from "./content";
import {
  firstOpenMissionV2,
  isBossOpenV2,
  isBossPassedV2,
  isMissionOpenV2,
  isMissionPassedV2,
  isPlanetOpenV2,
  missionStarsV2,
  streakCountV2,
  totalStarsV2,
  type MissionStars,
  type ProgressV2,
} from "./progress";
import { skillRadarV2, type RadarAxisV2 } from "./radar";

/** Mission state words. Shown as text, never by colour alone. */
export type OrbitMissionState = "locked" | "open" | "passed";

/** Boss Gate state words. Open means five Passes; passed means flag set. */
export type OrbitBossState = "locked" | "open" | "passed";

export interface OrbitMissionEntry {
  slug: string;
  title: string;
  state: OrbitMissionState;
  stars: MissionStars;
  /** Null when locked (not navigable). Points at /missions/[slug]. */
  href: string | null;
}

export interface OrbitBossEntry {
  slug: string;
  title: string;
  state: OrbitBossState;
  /** Null when locked. Points at the Boss Gate flow (`/missions/[bossSlug]`). */
  href: string | null;
}

export interface OrbitPlanetEntry {
  planet: string;
  name: string;
  locked: boolean;
  missions: OrbitMissionEntry[];
  boss: OrbitBossEntry;
  /** Radar score 0-100 for this Planet (locked Planets score 0). */
  score: number;
}

export interface OrbitView {
  planets: OrbitPlanetEntry[];
  radar: RadarAxisV2[];
  totalStars: number;
  streak: number;
  passedCount: number;
  /** First open unpassed Mission slug in pack order, or null. */
  nextMission: string | null;
}

/** Route for a Mission slug (spec §3). Cockpit lands in #69. */
export function missionHref(slug: string): string {
  return `/missions/${slug}`;
}

function missionTitle(pack: PlanetPack, slug: string): string {
  const found = pack.missions.find((m) => m.slug === slug);
  if (found) return found.title;
  const position = pack.planet.missionSlugs.indexOf(slug) + 1;
  return `${pack.planet.name} Mission ${position > 0 ? position : slug}`;
}

/**
 * State of one Mission: passed when Stars > 0, open under the linear
 * unlock rule, locked otherwise. Unknown slugs are locked.
 */
export function orbitMissionState(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
  slug: string,
): OrbitMissionState {
  if (isMissionPassedV2(progress, slug)) return "passed";
  if (isMissionOpenV2(progress, packs, slug)) return "open";
  return "locked";
}

/** State of one Planet's Boss Gate. */
export function orbitBossState(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
  planet: string,
): OrbitBossState {
  if (isBossPassedV2(progress, planet)) return "passed";
  if (isBossOpenV2(progress, packs, planet)) return "open";
  return "locked";
}

/** State word for Mission and Boss Gate chips. */
export function orbitStateLabel(state: OrbitMissionState | OrbitBossState): string {
  if (state === "passed") return "Passed";
  if (state === "open") return "Open";
  return "Locked";
}

/** Stars as text, e.g. "2 of 3 Stars". Never stars alone. */
export function orbitStarsLabel(stars: MissionStars): string {
  return `${stars} of 3 Stars`;
}

/** Whole orbit map for one progress value on one local date. */
export function orbitView(
  progress: ProgressV2,
  packs: readonly PlanetPack[],
  today: string,
): OrbitView {
  const radar = skillRadarV2(progress, packs);
  const scoreOf = new Map(radar.map((axis) => [axis.planet, axis.score]));
  const planets: OrbitPlanetEntry[] = packs.map((pack) => {
    const slug = pack.planet.slug;
    const locked = !isPlanetOpenV2(progress, packs, slug);
    const missions: OrbitMissionEntry[] = pack.planet.missionSlugs.map((missionSlug) => {
      const state = orbitMissionState(progress, packs, missionSlug);
      return {
        slug: missionSlug,
        title: missionTitle(pack, missionSlug),
        state,
        stars: missionStarsV2(progress, missionSlug),
        href: state === "locked" ? null : missionHref(missionSlug),
      };
    });
    const bossState = orbitBossState(progress, packs, slug);
    return {
      planet: slug,
      name: pack.planet.name,
      locked,
      missions,
      boss: {
        slug: pack.boss.slug,
        title: pack.boss.title,
        state: bossState,
        href: bossState === "locked" ? null : missionHref(pack.boss.slug),
      },
      score: scoreOf.get(slug) ?? 0,
    };
  });
  const passedCount = packs.reduce(
    (sum, pack) =>
      sum + pack.planet.missionSlugs.filter((slug) => isMissionPassedV2(progress, slug)).length,
    0,
  );
  return {
    planets,
    radar,
    totalStars: totalStarsV2(progress),
    streak: streakCountV2(progress, today),
    passedCount,
    nextMission: firstOpenMissionV2(progress, packs),
  };
}
