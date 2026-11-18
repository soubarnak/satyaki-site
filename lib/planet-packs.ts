// Home-map Planet packs placeholder (issue #68, spec §§3,8).
// Glossary: Planet, Mission, Boss Gate. Uses real Planet identities,
// slugs, and Planet concepts from docs/planet-*-content-spec.md so links
// and unlocks stay stable. Volta Missions reuse the validated shapes
// from tests/fixtures/sample-planet.ts; Planets 2-5 carry minimal valid
// Missions until the content tickets (#74, #82-87) land the transcribed
// packs and replace this module. Every pack passes validatePlanetPack.

import type { BossGate, Mission, Planet, PlanetConceptId, PlanetPack } from "./content";
import { tierForPosition, trainingWheelsForPlanet } from "./content";

const ROSETTA = {
  python: "power = 0\npower = 3\nlog(power)",
  java: "int power = 0;\npower = 3;\nlog(power);",
  note: "A variable is a named box: put a value in, and the name reads it back.",
};

function starters(story: string, planetNumber: number): { pythonStarter: string; javaStarter: string } {
  const training = trainingWheelsForPlanet(planetNumber);
  const javaBody =
    training === "full-scaffold"
      ? `public class Main {\n    public static void main(String[] args) {\n        // ${story}.\n        // YOUR CODE BELOW\n\n        // YOUR CODE ABOVE\n    }\n}\n`
      : `// ${story}; write code below.\n// YOUR CODE BELOW; start here\n\n// YOUR CODE ABOVE\n`;
  return {
    pythonStarter: `# ${story}.\n# YOUR CODE BELOW\n\n# YOUR CODE ABOVE\n`,
    javaStarter: javaBody,
  };
}

function makeMission(
  planet: Planet,
  planetNumber: number,
  conceptId: Mission["conceptId"],
  position: number,
  title: string,
  seedBase: number,
): Mission {
  const tier = tierForPosition(position);
  const seedCount = tier === "intro" ? 2 : tier === "core" ? 3 : 4;
  const seedPool = Array.from({ length: seedCount }, (_, i) => seedBase + i + 1);
  const slug = planet.missionSlugs[position - 1];
  return {
    slug,
    planet: planet.slug,
    position,
    conceptId,
    planetConceptId: planet.planetConceptId,
    tier,
    title,
    story: `Cadet flies the ${planet.name} lane and learns ${conceptId}.`,
    briefing: `Fly the ${planet.name} lane for ${conceptId}.`,
    objectives: [{ text: `Reach the ${planet.name} marker.`, checkIds: [`reach-${slug}`] }],
    ...starters(title, planetNumber),
    trainingWheels: trainingWheelsForPlanet(planetNumber),
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 20 },
      bounds: { maxX: 5, maxY: 1, maxZ: 2 },
      entities: [{ id: "crystal-1", type: "crystal", x: 1, y: 0, z: 1 }],
    },
    seedPool,
    checks: [
      {
        id: `reach-${slug}`,
        label: `Reach the ${planet.name} marker`,
        statePath: "ship.x",
        comparator: "eq",
        expected: 3,
        timing: "final",
      },
    ],
    par: { maxSteps: 7, maxEnergy: 7 },
    star3Concept: planet.planetConceptId,
    hints: [
      `The Ship faces east on ${planet.name}.`,
      `Count the marker cells east of the Ship.`,
      `Call move() three times, one after another, then press Run.`,
    ],
    rosetta: { ...ROSETTA },
  };
}

function makeBoss(planet: Planet, planetNumber: number): BossGate {
  const partBSlug = `${planet.slug}-gate-part-b`;
  const quiz = (n: number) => ({
    kind: "choice" as const,
    prompt: `Question ${n} on ${planet.name}.`,
    options: ["First", "Second", "Third"],
    correctIndex: 0,
    explanation: `The first answer holds on ${planet.name}.`,
  });
  return {
    slug: `${planet.slug}-gate`,
    planet: planet.slug,
    title: `${planet.name} Gate`,
    partA: [quiz(1), quiz(2), quiz(3), quiz(4), quiz(5)],
    partB: {
      slug: partBSlug,
      briefing: `Open the ${planet.name} Gate.`,
      objectives: [{ text: `Open the ${planet.name} Gate.`, checkIds: ["gate-open"] }],
      ...starters(`Open the ${planet.name} Gate`, planetNumber),
      trainingWheels: trainingWheelsForPlanet(planetNumber),
      layout: {
        shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
        bounds: { maxX: 8, maxY: 1, maxZ: 2 },
        entities: [
          { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
          { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
          { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 1 },
        ],
      },
      seedPool: [901, 902, 903],
      checks: [
        {
          id: "gate-open",
          label: `Open the ${planet.name} Gate`,
          statePath: "entities.gate-1.open",
          comparator: "eq",
          expected: true,
          timing: "final",
        },
      ],
      hints: [
        `The switch opens the gate with the same link on ${planet.name}.`,
        `Fly five cells east onto the switch.`,
        `Move five times onto the switch, then press Run.`,
      ],
    },
  };
}

const VOLTA_TITLES = [
  "Wake the Ship",
  "Count the Power Cells",
  "Name the Beacon",
  "Feed the Core",
  "Read the Dials",
];

const PLANETS: Array<{
  planet: Planet;
  concepts: Array<Mission["conceptId"]>;
}> = [
  {
    planet: {
      id: "planet-1",
      slug: "volta",
      name: "Volta",
      themeId: "volta-launchpad",
      planetConceptId: "variable",
      missionSlugs: ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"],
    },
    concepts: [
      "sequence",
      "arithmetic_expression",
      "variable_assignment",
      "variable_update",
      "sensor_variable",
    ],
  },
  {
    planet: {
      id: "planet-2",
      slug: "cometa",
      name: "Cometa",
      themeId: "cometa-stormgate",
      planetConceptId: "conditional",
      missionSlugs: ["p2-m1", "p2-m2", "p2-m3", "p2-m4", "p2-m5"],
    },
    concepts: ["comparison", "if_statement", "if_else", "else_if_chain", "boolean_decision"],
  },
  {
    planet: {
      id: "planet-3",
      slug: "lumina",
      name: "Lumina",
      themeId: "lumina-lightgrid",
      planetConceptId: "loop",
      missionSlugs: ["p3-m1", "p3-m2", "p3-m3", "p3-m4", "p3-m5"],
    },
    concepts: ["for_loop", "loop_counter", "while_loop", "nested_loop", "loop_with_conditional"],
  },
  {
    planet: {
      id: "planet-4",
      slug: "foundry",
      name: "Foundry",
      themeId: "foundry-forge",
      planetConceptId: "function",
      missionSlugs: ["p4-m1", "p4-m2", "p4-m3", "p4-m4", "p4-m5"],
    },
    concepts: [
      "function_definition",
      "function_parameter",
      "function_return",
      "local_variable",
      "function_composition",
    ],
  },
  {
    planet: {
      id: "planet-5",
      slug: "astral",
      name: "Astral",
      themeId: "astral-starfield",
      planetConceptId: "list",
      missionSlugs: ["p5-m1", "p5-m2", "p5-m3", "p5-m4", "p5-m5"],
    },
    concepts: ["list_creation", "list_indexing", "list_update", "list_iteration", "list_driven_route"],
  },
];

function buildPack(
  planet: Planet,
  planetNumber: number,
  concepts: Array<Mission["conceptId"]>,
  titles: string[],
): PlanetPack {
  const planetConcept = planet.planetConceptId as PlanetConceptId;
  const full: Planet = { ...planet, planetConceptId: planetConcept };
  const missions = concepts.map((conceptId, i) =>
    makeMission(full, planetNumber, conceptId, i + 1, titles[i], planetNumber * 1000 + i * 10),
  );
  return { planet: full, missions, boss: makeBoss(full, planetNumber) };
}

/** Five Planet packs in Map order. Replaced by the transcribed content in #74. */
export const PLANET_PACKS: PlanetPack[] = PLANETS.map(({ planet, concepts }, i) => {
  const n = i + 1;
  const titles =
    planet.slug === "volta"
      ? VOLTA_TITLES
      : concepts.map((_, j) => `${planet.name} Mission ${j + 1}`);
  return buildPack(planet, n, concepts, titles);
});
