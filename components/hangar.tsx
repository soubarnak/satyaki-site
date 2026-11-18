// Hangar cosmetic selection (issue #73, catalogue #57, spec §6).
// Glossary: Hangar, Star, Ship, Cadet. Client wrapper: reads the v2
// record after mount (never gates with a loader), derives total Stars on
// read, and persists equips to the stored record. Sync and Save Code
// carry the hangar field, so an equip written here survives both.

"use client";

import { totalStarsV2, type HangarV2, type ProgressV2 } from "@/lib/progress";
import { browserProgressV2Storage } from "@/lib/progress-v2-storage";
import {
  HANGAR_CATALOGUE,
  HANGAR_SLOTS,
  HANGAR_SLOT_LABELS,
  canEquipHangar,
  effectiveHangar,
  equipHangar,
  type HangarSlot,
  type HangarTier,
} from "@/lib/hangar";
import { useProgressV2 } from "./use-progress-v2";

const SLOT_ORDER: readonly HangarSlot[] = HANGAR_SLOTS;

function slotCosmetics(slot: HangarSlot) {
  return HANGAR_CATALOGUE.filter((entry) => entry.slot === slot);
}

function equipNext(progress: ProgressV2, totalStars: number, slot: HangarSlot, tier: HangarTier): ProgressV2 {
  return { ...progress, hangar: equipHangar(progress.hangar, totalStars, slot, tier) };
}

export function Hangar() {
  const { progress, loaded, refresh } = useProgressV2();
  const totalStars = totalStarsV2(progress);
  const effective: HangarV2 = effectiveHangar(progress.hangar, totalStars);

  function handleEquip(slot: HangarSlot, tier: HangarTier): void {
    if (!canEquipHangar(totalStars, tier)) return;
    try {
      browserProgressV2Storage().save(equipNext(progress, totalStars, slot, tier));
    } catch {
      // Private mode: the equip shows until the next load.
      return;
    }
    refresh();
  }

  return (
    <section aria-label="Hangar" className="hangar">
      <h2>Hangar</h2>
      <p className="map-intro">
        Pick your Ship cosmetics, Cadet. Stars unlock more. Cosmetics are never bought and never
        change your progress.
      </p>
      {!loaded && (
        <p className="orbit-sync-note" role="note">
          Showing total Stars. Your equipped cosmetics overlay when ready.
        </p>
      )}
      <p>
        Total Stars: <strong>{totalStars} of 75</strong>
      </p>
      {SLOT_ORDER.map((slot) => (
        <section key={slot} aria-label={`${HANGAR_SLOT_LABELS[slot]} cosmetics`} className="hangar-slot">
          <h3>
            {HANGAR_SLOT_LABELS[slot]} — equipped{" "}
            {HANGAR_CATALOGUE.find(
              (entry) => entry.slot === slot && entry.tier === effective[slot],
            )?.name ?? HANGAR_SLOT_LABELS[slot]}
          </h3>
          <ol className="hangar-list">
            {slotCosmetics(slot).map((entry) => {
              const unlocked = canEquipHangar(totalStars, entry.tier);
              const equipped = effective[slot] === entry.tier;
              const state = equipped ? "Equipped" : unlocked ? "Unlocked" : "Locked";
              return (
                <li key={entry.tier} className="hangar-row">
                  <span className="hangar-name">{entry.name}</span>
                  <span className="hangar-detail">{entry.detail}</span>
                  <span className="hangar-state">
                    {state}
                    {unlocked
                      ? ` at ${entry.threshold} Stars`
                      : ` — unlocks at ${entry.threshold} Stars`}
                  </span>
                  {!equipped &&
                    (unlocked ? (
                      <button type="button" onClick={() => handleEquip(slot, entry.tier)}>
                        Equip {entry.name}
                      </button>
                    ) : (
                      <button type="button" disabled>
                        Locked
                      </button>
                    ))}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </section>
  );
}
