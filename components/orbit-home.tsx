"use client";

// Orbit home client overlay (spec §§3,6,10, issue #68). The server render
// already paints the map from the empty record, so this wrapper never
// shows a loading gate: it renders the same map instantly, then overlays
// real states, radar, and the drill card once the stored record arrives.

import { useEffect, useState } from "react";
import { localDateString, type ProgressV2 } from "@/lib/progress";
import { PLANET_PACKS } from "@/lib/planet-packs";
import { missionHref, orbitView } from "@/lib/orbit";
import {
  DRILL_PICK_KEY,
  drillLanguageV2,
  parseDrillPickV2,
  resolveDrillPickV2,
  serializeDrillPickV2,
  type DrillPickV2,
} from "@/lib/radar";
import { Bolt } from "./bolt";
import { OrbitMap } from "./orbit-map";
import { RadarSummary } from "./radar-summary";
import { DrillCard, type DrillCardState } from "./drill-card";
import { useProgressV2 } from "./use-progress-v2";

function missionTitle(slug: string): string {
  for (const pack of PLANET_PACKS) {
    const found = pack.missions.find((m) => m.slug === slug);
    if (found) return found.title;
  }
  return slug;
}

function planetNameOf(slug: string): string {
  for (const pack of PLANET_PACKS) {
    if (pack.planet.missionSlugs.includes(slug)) return pack.planet.name;
  }
  return slug;
}

function boltMessage(passedCount: number, nextMission: string | null): string {
  if (passedCount >= 25) return "Every Planet passed, Cadet. The quest is complete!";
  if (passedCount === 0) return "Welcome, Cadet. Wake the Ship on Volta to begin.";
  if (nextMission === null) return "Good flying, Cadet. The Boss Gates wait.";
  return `Good flying, Cadet. ${missionTitle(nextMission)} is open next.`;
}

function drillState(progress: ProgressV2, pick: DrillPickV2 | null, nextMission: string | null): DrillCardState {
  const passedSlugs = Object.keys(progress.missions).filter(
    (slug) => (progress.missions[slug]?.passes ?? 0) > 0,
  );
  if (passedSlugs.length === 0) {
    const slug = nextMission ?? "p1-m1";
    return { kind: "first-mission", missionTitle: missionTitle(slug), missionHref: missionHref(slug) };
  }
  if (pick === null) return { kind: "none-today" };
  if (pick.completed) return { kind: "done", missionTitle: missionTitle(pick.slug) };
  const language = drillLanguageV2(progress, pick.slug);
  return {
    kind: "ready",
    missionTitle: missionTitle(pick.slug),
    missionHref: missionHref(pick.slug),
    language: language === "python" ? "Python" : language === "java" ? "Java" : "your pick",
    planetName: planetNameOf(pick.slug),
  };
}

export function OrbitHome(): React.ReactElement {
  const { progress, loaded } = useProgressV2();
  const today = localDateString(new Date());
  const view = orbitView(progress, PLANET_PACKS, today);
  const [pick, setPick] = useState<DrillPickV2 | null>(null);

  useEffect(() => {
    const sync = (): void => {
      if (!loaded) return;
      let stored: DrillPickV2 | null = null;
      try {
        stored = parseDrillPickV2(window.localStorage.getItem(DRILL_PICK_KEY));
      } catch {
        stored = null;
      }
      let resolved = resolveDrillPickV2(stored, today, progress, PLANET_PACKS);
      if (resolved !== null && !resolved.completed) {
        const day = progress.missions[resolved.slug]?.lastPassAt?.slice(0, 10);
        if (day === today) resolved = { ...resolved, completed: true };
      }
      const before = stored === null ? null : serializeDrillPickV2(stored);
      const after = resolved === null ? null : serializeDrillPickV2(resolved);
      if (before !== after) {
        try {
          if (after === null) window.localStorage.removeItem(DRILL_PICK_KEY);
          else window.localStorage.setItem(DRILL_PICK_KEY, after);
        } catch {
          // Private mode: the pick simply does not freeze.
        }
      }
      setPick(resolved);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("pageshow", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("pageshow", sync);
    };
  }, [progress, loaded, today]);

  return (
    <>
      <h1>Satyaki Space Coder</h1>
      <p className="map-intro">Pick a Planet, Cadet. Pass each Mission to open the next Planet.</p>

      <div className="bolt-row">
        <Bolt size={88} />
        <p className="bolt-bubble" role="status">
          {boltMessage(view.passedCount, view.nextMission)}
        </p>
      </div>

      {!loaded && (
        <p className="orbit-sync-note" role="note">
          Showing the map. Your progress overlays when ready.
        </p>
      )}

      <OrbitMap view={view} />
      <RadarSummary axes={view.radar} />
      <DrillCard drill={drillState(progress, pick, view.nextMission)} />
    </>
  );
}
