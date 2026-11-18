// Orbit home map, Planet panel, and quest stats (spec §§3,10, issue #68).
// Glossary: Mission, Planet, Boss Gate, Pass, Star, Cadet. Variant A
// Orbit system (issue #39): sun with concentric SVG orbits, Planet panel
// with Mission states, Stars, and Boss Gate. Server-safe: no client hooks,
// no three/monaco imports. States read Locked/Open/Passed in text, never
// by colour alone.

import Link from "next/link";
import { orbitStarsLabel, orbitStateLabel, type OrbitView } from "@/lib/orbit";

const ORBITS = [70, 110, 150, 190, 230];
const CENTER = 300;

// Presentation tints only; state always travels as text.
const PLANET_TINTS = ["#e8b04b", "#7fb3d5", "#a3c585", "#d98c8c", "#b39ddb"];

function planetPoint(index: number): { x: number; y: number } {
  const angle = ((-90 + index * 72) * Math.PI) / 180;
  const r = ORBITS[index % ORBITS.length];
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

export function OrbitMap({ view }: { view: OrbitView }): React.ReactElement {
  return (
    <>
      <section aria-label="Orbit map">
        <svg
          role="img"
          aria-label="Orbit map: the Sun with five Planet orbits"
          viewBox="0 0 600 600"
          className="orbit-svg"
        >
          {ORBITS.map((r) => (
            <circle
              key={r}
              cx={CENTER}
              cy={CENTER}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.35"
              strokeWidth="2"
            />
          ))}
          <circle cx={CENTER} cy={CENTER} r="36" fill="#ffc53d" />
          <text x={CENTER} y={CENTER + 6} textAnchor="middle" className="orbit-sun-label">
            Sun
          </text>
          {view.planets.map((planet, index) => {
            const { x, y } = planetPoint(index);
            const stateWord =
              planet.boss.state === "passed"
                ? "Passed"
                : planet.locked
                  ? "Locked"
                  : "Open";
            return (
              <g key={planet.planet}>
                <circle
                  cx={x}
                  cy={y}
                  r="18"
                  fill={PLANET_TINTS[index % PLANET_TINTS.length]}
                  stroke={planet.locked ? "currentColor" : "#ffc53d"}
                  strokeWidth={planet.locked ? 2 : 4}
                  strokeDasharray={planet.locked ? "5 4" : undefined}
                />
                <text x={x} y={y - 26} textAnchor="middle" className="orbit-planet-label">
                  {planet.name}
                </text>
                <text x={x} y={y + 34} textAnchor="middle" className="orbit-planet-state">
                  {stateWord}
                </text>
              </g>
            );
          })}
        </svg>
      </section>

      <section className="map-stats" aria-label="Your quest so far">
        <p>
          Total Stars: <strong>{view.totalStars} of 75</strong>
        </p>
        <p>
          Day streak: <strong>{view.streak}</strong>
        </p>
        <p>
          Missions passed: <strong>{view.passedCount} of 25</strong>
        </p>
      </section>

      <ol className="orbit-planets">
        {view.planets.map((planet) => (
          <li key={planet.planet} id={`planet-${planet.planet}`} className="orbit-planet">
            <h2 className="orbit-planet-name">
              {planet.name}{" "}
              <span className={`state-chip ${planet.locked ? "state-locked" : "state-open"}`}>
                {planet.locked ? "Locked" : planet.boss.state === "passed" ? "Gate passed" : "Open"}
              </span>
            </h2>
            <p className="orbit-planet-meta">
              Skill Radar: {planet.score} of 100{planet.locked ? " (locked)" : ""}
            </p>
            <ol className="level-list">
              {planet.missions.map((mission) => {
                const inner = (
                  <>
                    <span className="level-card-text">
                      <span className="level-card-title">{mission.title}</span>
                      <span className="level-card-meta">
                        {planet.name} Mission · {orbitStarsLabel(mission.stars)}
                      </span>
                    </span>
                    <span className={`state-chip state-${mission.state}`}>
                      {orbitStateLabel(mission.state)}
                    </span>
                    {mission.state !== "locked" && <span className="level-action">Play</span>}
                  </>
                );
                return (
                  <li key={mission.slug}>
                    {mission.href === null ? (
                      <span className="level-card level-card-locked" aria-disabled="true">
                        {inner}
                      </span>
                    ) : (
                      <Link className="level-card" href={mission.href}>
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
              <li>
                {planet.boss.href === null ? (
                  <span className="level-card level-card-locked" aria-disabled="true">
                    <span className="level-card-text">
                      <span className="level-card-title">{planet.boss.title}</span>
                      <span className="level-card-meta">Boss Gate · five Passes open it</span>
                    </span>
                    <span className={`state-chip state-${planet.boss.state}`}>
                      {orbitStateLabel(planet.boss.state)}
                    </span>
                  </span>
                ) : (
                  <Link className="level-card" href={planet.boss.href}>
                    <span className="level-card-text">
                      <span className="level-card-title">{planet.boss.title}</span>
                      <span className="level-card-meta">Boss Gate · five Passes open it</span>
                    </span>
                    <span className={`state-chip state-${planet.boss.state}`}>
                      {orbitStateLabel(planet.boss.state)}
                    </span>
                    <span className="level-action">Play</span>
                  </Link>
                )}
              </li>
            </ol>
          </li>
        ))}
      </ol>
    </>
  );
}
