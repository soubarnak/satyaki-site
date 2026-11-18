"use client";

// Persistent Planet rail (ADR-0008): the orbit map in compact form, present
// on every learner view. Planet states read Locked/Open in text, never by
// colour alone. Renders instantly from the empty record and overlays real
// states when progress arrives: no loading gate. Links land on the Planet
// panel anchors on `/`; Mission routes arrive with the cockpit (#69).

import Link from "next/link";
import { localDateString } from "@/lib/progress";
import { PLANET_PACKS } from "@/lib/planet-packs";
import { orbitView } from "@/lib/orbit";
import { Bolt } from "./bolt";
import { useProgressV2 } from "./use-progress-v2";

export function PlanetOrb({ index, label }: { index: number; label: string }): React.ReactElement {
  return (
    <span
      className="planet-orb"
      style={{ backgroundColor: PLANET_TINTS[index % PLANET_TINTS.length] }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

const PLANET_TINTS = ["#e8b04b", "#7fb3d5", "#a3c585", "#d98c8c", "#b39ddb"];

export function PlanetRail(): React.ReactElement {
  const { progress } = useProgressV2();
  const view = orbitView(progress, PLANET_PACKS, localDateString(new Date()));

  return (
    <aside className="planet-rail">
      <div className="rail-brand">
        <Bolt size={44} />
        <span className="rail-brand-name">Satyaki Space Coder</span>
      </div>
      <nav aria-label="Planets">
        <ol className="rail-list">
          {view.planets.map((planet, index) => {
            const passed = planet.missions.filter((m) => m.state === "passed").length;
            const stateWord = planet.locked ? "Locked" : planet.boss.state === "passed" ? "Gate passed" : "Open";
            const inner = (
              <>
                <PlanetOrb index={index} label={planet.name.slice(0, 1)} />
                <span className="rail-planet-text">
                  <span className="rail-planet-name">{planet.name}</span>
                  <span className="rail-planet-state">
                    {passed} of 5 Missions · {stateWord}
                  </span>
                </span>
              </>
            );
            return (
              <li key={planet.planet}>
                <Link
                  className={`rail-planet${planet.locked ? " rail-planet-locked" : ""}`}
                  href={`/#planet-${planet.planet}`}
                  aria-disabled={planet.locked ? true : undefined}
                >
                  {inner}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}

export function stateLabel(state: "locked" | "open" | "passed"): string {
  return state === "passed" ? "Passed" : state === "open" ? "Open" : "Locked";
}
