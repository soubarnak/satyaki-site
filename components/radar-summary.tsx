// Skill Radar summary (spec §6, ADR-0015). Glossary: Skill Radar,
// Planet, Mission, Star. Presentational: scores in as props, no hooks.
// Five axes always render; a locked Planet scores 0 with a locked mark.

import type { RadarAxisV2 } from "@/lib/radar";
import { PLANET_PACKS } from "@/lib/planet-packs";

function planetName(slug: string): string {
  return PLANET_PACKS.find((pack) => pack.planet.slug === slug)?.planet.name ?? slug;
}

export function RadarSummary({ axes }: { axes: RadarAxisV2[] }): React.ReactElement {
  return (
    <section aria-label="Skill Radar summary" className="radar-summary">
      <h2>Skill Radar</h2>
      <p className="map-intro">Five Planet axes, scored from Mission Stars. More Stars, higher axis.</p>
      <ol className="radar-list">
        {axes.map((axis) => (
          <li key={axis.planet} className="radar-row">
            <span className="radar-planet">{planetName(axis.planet)}</span>
            <span className="radar-score">
              {axis.score} of 100{axis.locked ? " (locked)" : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
