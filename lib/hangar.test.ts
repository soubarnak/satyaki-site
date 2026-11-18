// Hangar suites (issue #73, catalogue from #57, spec §6).
// Seams: pure catalogue/unlock/equip helpers in lib/hangar.ts.
// Glossary: Hangar, Star, Mission, Pass, Save Code stay in test names.

import { describe, expect, it } from "vitest";
import {
  HANGAR_CATALOGUE,
  HANGAR_SLOTS,
  HANGAR_TIERS,
  HANGAR_SLOT_LABELS,
  canEquipHangar,
  effectiveHangar,
  equipHangar,
  hangarTierThreshold,
  isHangarUnlocked,
  type HangarTier,
} from "./hangar";

describe("Hangar catalogue (decision #57, thresholds only, never spent)", () => {
  it("holds 4 slots x 5 tiers = 20 cosmetics", () => {
    expect(HANGAR_SLOTS).toEqual(["hull", "trim", "thruster", "laserColour"]);
    expect(HANGAR_TIERS).toEqual(["training", "bronze", "steel", "solar_gold", "nebula_crystal"]);
    expect(HANGAR_CATALOGUE).toHaveLength(20);
  });

  it("labels the laserColour slot Laser", () => {
    expect(HANGAR_SLOT_LABELS).toEqual({
      hull: "Hull",
      trim: "Trim",
      thruster: "Thruster",
      laserColour: "Laser",
    });
  });

  it("uses the decided Star thresholds: 0, 5, 15, 30, 50", () => {
    expect(hangarTierThreshold("training")).toBe(0);
    expect(hangarTierThreshold("bronze")).toBe(5);
    expect(hangarTierThreshold("steel")).toBe(15);
    expect(hangarTierThreshold("solar_gold")).toBe(30);
    expect(hangarTierThreshold("nebula_crystal")).toBe(50);
  });

  it("names cosmetics '<Tier> <Slot>', e.g. Steel Hull and Nebula Crystal Laser", () => {
    const names = new Map(HANGAR_CATALOGUE.map((c) => [`${c.slot}:${c.tier}`, c.name]));
    expect(names.get("hull:steel")).toBe("Steel Hull");
    expect(names.get("laserColour:nebula_crystal")).toBe("Nebula Crystal Laser");
    expect(names.get("trim:bronze")).toBe("Bronze Trim");
    expect(names.get("thruster:solar_gold")).toBe("Solar Gold Thruster");
  });

  it("keeps the laser beam colours Blue, Amber, Emerald, Crimson, Violet by tier", () => {
    const beams = new Map(
      HANGAR_CATALOGUE.filter((c) => c.slot === "laserColour").map((c) => [c.tier, c.detail]),
    );
    expect(beams.get("training")).toMatch(/Blue/);
    expect(beams.get("bronze")).toMatch(/Amber/);
    expect(beams.get("steel")).toMatch(/Emerald/);
    expect(beams.get("solar_gold")).toMatch(/Crimson/);
    expect(beams.get("nebula_crystal")).toMatch(/Violet/);
  });

  it("unlocks a tier exactly at its threshold Stars", () => {
    expect(isHangarUnlocked(0, "training")).toBe(true);
    expect(isHangarUnlocked(4, "bronze")).toBe(false);
    expect(isHangarUnlocked(5, "bronze")).toBe(true);
    expect(isHangarUnlocked(14, "steel")).toBe(false);
    expect(isHangarUnlocked(15, "steel")).toBe(true);
    expect(isHangarUnlocked(29, "solar_gold")).toBe(false);
    expect(isHangarUnlocked(30, "solar_gold")).toBe(true);
    expect(isHangarUnlocked(49, "nebula_crystal")).toBe(false);
    expect(isHangarUnlocked(50, "nebula_crystal")).toBe(true);
  });
});

describe("Hangar equip rules (locked cannot equip, never auto-equips)", () => {
  const empty = { hull: "training", trim: "training", thruster: "training", laserColour: "training" };

  it("a locked cosmetic cannot be equipped: the record is unchanged", () => {
    expect(canEquipHangar(4, "bronze")).toBe(false);
    expect(equipHangar(empty, 4, "hull", "bronze")).toEqual(empty);
  });

  it("an unlocked cosmetic equips into its slot only", () => {
    expect(canEquipHangar(5, "bronze")).toBe(true);
    const next = equipHangar(empty, 5, "hull", "bronze");
    expect(next).toEqual({ ...empty, hull: "bronze" });
  });

  it("an unknown tier slug cannot be equipped", () => {
    expect(equipHangar(empty, 75, "hull", "ultraviolet" as HangarTier)).toEqual(empty);
  });

  it("unlocking never auto-equips: high Stars keep the training default", () => {
    expect(effectiveHangar(empty, 75)).toEqual(empty);
  });

  it("a locked stored value falls back to training for that slot only", () => {
    const stored = { ...empty, hull: "steel", trim: "bronze" };
    expect(effectiveHangar(stored, 5)).toEqual({ ...empty, hull: "training", trim: "bronze" });
  });

  it("an unknown stored value falls back to training for that slot only", () => {
    const stored = { ...empty, hull: "ultraviolet", trim: "bronze" };
    expect(effectiveHangar(stored, 75)).toEqual({ ...empty, hull: "training", trim: "bronze" });
  });
});
