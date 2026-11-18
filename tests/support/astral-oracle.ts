// Astral oracle: literals from docs/planet-5-astral-content-spec.md.

import type { CheckRow, EntityRow, LayoutOracle, PackOracle } from "./pack-oracle";

const sw = (n: number, sx: number, sz: number, gx: number, gz: number): EntityRow[] => [
  [`switch-${n}`, "switch", sx, 0, sz],
  [`gate-${n}`, "gate", gx, 0, gz],
];
const titanium = (x: number, z: number): EntityRow => ["asteroid-1", "asteroid_titanium", x, 0, z];
const crystal = (x: number, z: number): EntityRow => ["crystal-1", "crystal", x, 0, z];
const layout = (maxX: number, maxZ: number, entities: EntityRow[]): LayoutOracle => ({
  specBounds: { maxX, maxY: 0, maxZ },
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
  entities,
});
const cargoChecks = (x: number): CheckRow[] => [
  ["switch-on", "entities.switch-1.on", "eq", true, "final"],
  ["on-switch", "ship.x", "eq", x, "final"],
  ["stay-lane", "ship.z", "eq", 0, "final"],
];

export const astralOracle: PackOracle = {
  planet: {
    id: "planet-5",
    slug: "astral",
    name: "Astral",
    themeId: "astral-starfield",
    planetConceptId: "list",
    trainingWheels: "minimal",
  },
  missions: [
    {
      slug: "p5-m1",
      position: 1,
      title: "Gather the Star Cargo",
      conceptId: "list_creation",
      tier: "intro",
      seedPool: [5101, 5102],
      refSteps: 4,
      refEnergy: 4,
      par: { maxSteps: 8, maxEnergy: 8 },
      checks: cargoChecks(4),
      layout: layout(6, 2, [...sw(1, 4, 0, 5, 0), titanium(6, 0), crystal(1, 2)]),
    },
    {
      slug: "p5-m2",
      position: 2,
      title: "Read the First Star",
      conceptId: "list_indexing",
      tier: "core",
      seedPool: [5201, 5202, 5203],
      refSteps: 4,
      refEnergy: 4,
      par: { maxSteps: 8, maxEnergy: 8 },
      checks: cargoChecks(4),
      layout: layout(8, 2, [...sw(1, 4, 0, 5, 0), titanium(8, 0), crystal(2, 2)]),
    },
    {
      slug: "p5-m3",
      position: 3,
      title: "Correct the Star Count",
      conceptId: "list_update",
      tier: "core",
      seedPool: [5301, 5302, 5303],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: cargoChecks(5),
      layout: layout(7, 2, [...sw(1, 5, 0, 6, 0), titanium(7, 0), crystal(1, 2)]),
    },
    {
      slug: "p5-m4",
      position: 4,
      title: "Walk the Star List",
      conceptId: "list_iteration",
      tier: "core",
      seedPool: [5401, 5402, 5403],
      refSteps: 4,
      refEnergy: 4,
      par: { maxSteps: 8, maxEnergy: 8 },
      checks: cargoChecks(4),
      layout: layout(6, 2, [...sw(1, 4, 0, 5, 0), titanium(6, 0), crystal(1, 2)]),
    },
    {
      slug: "p5-m5",
      position: 5,
      title: "Fly the Star Route",
      conceptId: "list_driven_route",
      tier: "stretch",
      seedPool: [5501, 5502, 5503, 5504],
      refSteps: 9,
      refEnergy: 9,
      par: { maxSteps: 16, maxEnergy: 16 },
      checks: [
        ["first-switch", "entities.switch-1.on", "eq", true, "final"],
        ["lane-gate", "entities.gate-1.open", "eq", true, "final"],
        ["signal-switch", "entities.switch-2.on", "eq", true, "final"],
        ["signal-gate", "entities.gate-2.open", "eq", true, "final"],
        ["signal-lane", "ship.x", "eq", 3, "final"],
        ["reach-signal", "ship.z", "eq", 5, "final"],
      ],
      layout: layout(6, 6, [
        ...sw(1, 3, 0, 3, 1),
        ...sw(2, 3, 5, 3, 6),
        titanium(4, 0),
        crystal(1, 2),
      ]),
    },
  ],
  boss: {
    slug: "astral-gate",
    title: "Astral Gate",
    partA: [
      { kind: "choice", optionCount: 4, correctIndex: 1 },
      { kind: "spot-bug", optionCount: 4, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 1 },
      { kind: "choice", optionCount: 4, correctIndex: 1 },
      { kind: "choice", optionCount: 4, correctIndex: 1 },
    ],
    partB: {
      slug: "astral-gate-part-b",
      seedPool: [5601, 5602, 5603],
      refSteps: 6,
      refEnergy: 6,
      checks: [
        ["lane-open", "entities.gate-1.open", "eq", true, "final"],
        ["beacon-lit", "entities.switch-2.on", "eq", true, "final"],
        ["beacon-gate", "entities.gate-2.open", "eq", true, "final"],
        ["beacon-lane", "ship.x", "eq", 2, "final"],
        ["reach-beacon", "ship.z", "eq", 3, "final"],
      ],
      layout: layout(6, 4, [
        ...sw(1, 2, 0, 2, 1),
        ...sw(2, 2, 3, 2, 4),
        titanium(3, 0),
        crystal(0, 2),
      ]),
    },
  },
  referenceDir: "content/references/planet-5",
  contentDir: "content/planets",
};
