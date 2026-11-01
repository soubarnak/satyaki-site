"use client";

// The persistent planet left rail of the Mission control shell
// (ADR-0008): the ordered level map in compact form, present on every
// learner view. States read locked / open / passed in text, never by
// colour alone; locked planets are not links (FR-002).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { levelMapView } from "@/lib/level-map";
import { localDateString } from "@/lib/progress";
import { Bolt } from "./bolt";
import { useProgress } from "./use-progress";

// Muted planet tints, presentation only; state always travels as text.
const PLANET_TINTS = [
  "#e8b04b",
  "#7fb3d5",
  "#a3c585",
  "#d98c8c",
  "#b39ddb",
  "#90a4ae",
  "#f0e68c",
  "#80cbc4",
  "#bcb8b1",
  "#ffcc80",
];

export function PlanetOrb({ index, label }: { index: number; label: string }) {
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

export function PlanetRail() {
  const pathname = usePathname();
  const { progress, loaded } = useProgress();
  const view = levelMapView(progress, localDateString(new Date()));

  return (
    <aside className="planet-rail">
      <div className="rail-brand">
        <Bolt size={44} />
        <span className="rail-brand-name">JavaQuest</span>
      </div>
      {/* No planet states until the stored record loads (see level map). */}
      {loaded && (
      <nav aria-label="Planets">
        <ol className="rail-list">
          {view.entries.map((entry, index) => {
            const { level, state, href } = entry;
            const inner = (
              <>
                <PlanetOrb index={index} label={String(level.id)} />
                <span className="rail-planet-text">
                  <span className="rail-planet-name">{level.planet}</span>
                  <span className="rail-planet-state">
                    Level {level.id} · {stateLabel(state)}
                  </span>
                </span>
              </>
            );
            return (
              <li key={level.id}>
                {href === null ? (
                  <span className="rail-planet rail-planet-locked" aria-disabled="true">
                    {inner}
                  </span>
                ) : (
                  <Link
                    className="rail-planet"
                    href={href}
                    aria-current={pathname === href ? "page" : undefined}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      )}
    </aside>
  );
}

export function stateLabel(state: "locked" | "open" | "passed"): string {
  return state === "passed" ? "Passed" : state === "open" ? "Open" : "Locked";
}
