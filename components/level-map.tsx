"use client";

// Level map at `/` (WF-001): 10 levels in fixed order with locked /
// open / passed in text (FR-001), locks enforced (FR-002), total points
// and streak shown (FR-015 display side). All state derives from the
// pure core in lib/level-map.ts; this component only renders it and
// holds Bolt's locked-planet notice.

import Link from "next/link";
import { useState } from "react";
import { levelMapView, lockedNotice, type LevelMapView } from "@/lib/level-map";
import { localDateString } from "@/lib/progress";
import { Bolt } from "./bolt";
import { PlanetOrb, stateLabel } from "./planet-rail";
import { useProgress } from "./use-progress";

function boltMessage(view: LevelMapView, loaded: boolean): string {
  if (!loaded) return "Loading your quest map, Cadet.";
  if (view.nextLevel === null) {
    return "Every planet passed, Cadet. The quest is complete!";
  }
  if (view.passedCount === 0) {
    return "Welcome, Cadet. Wake Bolt on Volta to begin.";
  }
  return `Good flying, Cadet. Level ${view.nextLevel.id} on ${view.nextLevel.planet} is open next.`;
}

export function LevelMap() {
  const { progress, loaded } = useProgress();
  const [notice, setNotice] = useState<string | null>(null);
  const view = levelMapView(progress, localDateString(new Date()));

  return (
    <>
      <h1>JavaQuest</h1>
      <p className="map-intro">
        Pick a planet, Cadet. Pass each level to open the next planet.
      </p>

      <div className="bolt-row">
        <Bolt size={88} />
        <p className="bolt-bubble" role="status">
          {notice ?? boltMessage(view, loaded)}
        </p>
      </div>

      {/* Until the stored record loads, show no states at all: a brief
          loading line beats a flash of wrong locks and points. */}
      {loaded && (
        <>
      <section className="map-stats" aria-label="Your quest so far">
        <p>
          Total points: <strong>{view.totalPoints}</strong>
        </p>
        <p>
          Day streak: <strong>{view.streak}</strong>
        </p>
        <p>
          Levels passed: <strong>{view.passedCount} of 10</strong>
        </p>
      </section>

      <ol className="level-list">
        {view.entries.map((entry, index) => {
          const { level, state, href } = entry;
          const inner = (
            <>
              <PlanetOrb index={index} label={String(level.id)} />
              <span className="level-card-text">
                <span className="level-card-title">
                  Level {level.id}: {level.title}
                </span>
                <span className="level-card-meta">
                  Planet {level.planet} · New skill: {level.concept} ·{" "}
                  {level.points} points
                  {level.badge ? ` · Badge: ${level.badge}` : ""}
                </span>
              </span>
              <span className={`state-chip state-${state}`}>
                {stateLabel(state)}
              </span>
              {state !== "locked" && <span className="level-action">Play</span>}
            </>
          );
          return (
            <li key={level.id}>
              {href === null ? (
                <button
                  type="button"
                  className="level-card level-card-locked"
                  onClick={() => setNotice(lockedNotice(progress, level))}
                >
                  {inner}
                </button>
              ) : (
                <Link className="level-card" href={href} onClick={() => setNotice(null)}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
        </>
      )}
    </>
  );
}
