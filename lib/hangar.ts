// Hangar catalogue and equip rules (issue #73, decided in #57, spec §6).
// Glossary: Hangar, Star, Ship. Pure core: no framework, DOM, or worker
// imports. Thresholds only; Stars are never spent (ADR-0010). Stored
// equipped values are tier slugs only; the field names the slot, so no
// slot prefix is stored. `training` is the default in every slot.

import type { HangarV2 } from "./progress";

/** The four Hangar slots, in display order. `laserColour` shows as Laser. */
export const HANGAR_SLOTS = ["hull", "trim", "thruster", "laserColour"] as const;
export type HangarSlot = (typeof HANGAR_SLOTS)[number];

/** The five Hangar tiers, lowest first. The set is closed. */
export const HANGAR_TIERS = [
  "training",
  "bronze",
  "steel",
  "solar_gold",
  "nebula_crystal",
] as const;
export type HangarTier = (typeof HANGAR_TIERS)[number];

/** Total-Star threshold unlocking each tier (thresholds only, never spent). */
const HANGAR_THRESHOLDS: Record<HangarTier, number> = {
  training: 0,
  bronze: 5,
  steel: 15,
  solar_gold: 30,
  nebula_crystal: 50,
};

/** Display names for tiers and slots. The laser list names the set, not the beam. */
const TIER_LABELS: Record<HangarTier, string> = {
  training: "Training",
  bronze: "Bronze",
  steel: "Steel",
  solar_gold: "Solar Gold",
  nebula_crystal: "Nebula Crystal",
};

/** Display label per slot. `laserColour` shows as Laser. */
export const HANGAR_SLOT_LABELS: Record<HangarSlot, string> = {
  hull: "Hull",
  trim: "Trim",
  thruster: "Thruster",
  laserColour: "Laser",
};

const SLOT_LABELS: Record<HangarSlot, string> = HANGAR_SLOT_LABELS;

/** Verbatim #57 catalogue detail per slot and tier. */
const CATALOGUE_DETAILS: Record<HangarSlot, Record<HangarTier, string>> = {
  hull: {
    training: "Rounded nose, balanced body",
    bronze: "Slim pointed nose, Scout shape",
    steel: "Wide boxy body, cargo fins",
    solar_gold: "Low body, swept wings, Racer shape",
    nebula_crystal: "Angular body, crystal canopy, twin fins",
  },
  trim: {
    training: "Slate Grey accent colour",
    bronze: "Copper accent colour",
    steel: "Teal accent colour",
    solar_gold: "Gold accent colour",
    nebula_crystal: "Magenta accent colour",
  },
  thruster: {
    training: "Ion Blue, single round flame",
    bronze: "Ember Orange, teardrop flame",
    steel: "Plasma Teal, twin jets",
    solar_gold: "Solar Gold, triple fan",
    nebula_crystal: "Nebula Violet, star-sparkle trail",
  },
  laserColour: {
    training: "Blue beam",
    bronze: "Amber beam",
    steel: "Emerald beam",
    solar_gold: "Crimson beam",
    nebula_crystal: "Violet beam",
  },
};

export interface HangarCosmetic {
  slot: HangarSlot;
  tier: HangarTier;
  /** Cosmetic name: `<Tier> <Slot>`, e.g. `Steel Hull`. */
  name: string;
  /** Total-Star threshold unlocking this cosmetic. */
  threshold: number;
  /** Full preview text shown for locked and unlocked cosmetics alike. */
  detail: string;
}

/** Display name for one cosmetic: `<Tier> <Slot>`. */
export function hangarCosmeticName(slot: HangarSlot, tier: HangarTier): string {
  return `${TIER_LABELS[tier]} ${SLOT_LABELS[slot]}`;
}

/** All 20 cosmetics: 4 slots x 5 tiers. */
export const HANGAR_CATALOGUE: readonly HangarCosmetic[] = HANGAR_SLOTS.flatMap((slot) =>
  HANGAR_TIERS.map((tier) => ({
    slot,
    tier,
    name: hangarCosmeticName(slot, tier),
    threshold: HANGAR_THRESHOLDS[tier],
    detail: CATALOGUE_DETAILS[slot][tier],
  })),
);

/** True for a known tier slug; the set is closed. */
export function isHangarTier(value: unknown): value is HangarTier {
  return (HANGAR_TIERS as readonly string[]).includes(value as string);
}

/** True for a known slot name. */
export function isHangarSlot(value: unknown): value is HangarSlot {
  return (HANGAR_SLOTS as readonly string[]).includes(value as string);
}

/** Total-Star threshold unlocking a tier. */
export function hangarTierThreshold(tier: HangarTier): number {
  return HANGAR_THRESHOLDS[tier];
}

/** True when total Stars reach the tier threshold. */
export function isHangarUnlocked(totalStars: number, tier: HangarTier): boolean {
  if (!isHangarTier(tier)) return false;
  return totalStars >= HANGAR_THRESHOLDS[tier];
}

/**
 * Effective tier for one slot: the stored tier when it is known and
 * unlocked at this total Stars, else `training`. A locked or unknown
 * stored value (for example from an imported Save Code) never renders
 * and never blocks the record.
 */
export function effectiveHangarTier(stored: unknown, totalStars: number): HangarTier {
  if (isHangarTier(stored) && isHangarUnlocked(totalStars, stored)) return stored;
  return "training";
}

/**
 * Effective equipped set for rendering: per-slot fallback to `training`.
 * Unlocking never auto-equips, so a stored `training` stays `training`.
 */
export function effectiveHangar(hangar: HangarV2, totalStars: number): HangarV2 {
  return {
    hull: effectiveHangarTier(hangar.hull, totalStars),
    trim: effectiveHangarTier(hangar.trim, totalStars),
    thruster: effectiveHangarTier(hangar.thruster, totalStars),
    laserColour: effectiveHangarTier(hangar.laserColour, totalStars),
  };
}

/** True when a tier is known and unlocked, so it can be equipped. */
export function canEquipHangar(totalStars: number, tier: unknown): boolean {
  return isHangarTier(tier) && isHangarUnlocked(totalStars, tier);
}

/**
 * Equip one cosmetic: returns the next Hangar record when the tier is
 * known and unlocked, else the record unchanged. Locked cosmetics
 * cannot be equipped.
 */
export function equipHangar(
  hangar: HangarV2,
  totalStars: number,
  slot: HangarSlot,
  tier: unknown,
): HangarV2 {
  if (!isHangarSlot(slot) || !canEquipHangar(totalStars, tier)) return hangar;
  return { ...hangar, [slot]: tier };
}
