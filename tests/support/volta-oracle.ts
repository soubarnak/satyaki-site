// Volta oracle: literals from docs/planet-1-volta-content-spec.md.

import type { CheckRow, EntityRow, LayoutOracle, PackOracle } from "./pack-oracle";

const crystal = (id: string, x: number, z: number): EntityRow => [id, "crystal", x, 0, z];
const lane = (maxX: number, maxZ: number, energy: number, entities: EntityRow[]): LayoutOracle => ({
  specBounds: { maxX, maxY: 0, maxZ },
  energy,
  entities,
});
const switchGate = (sx: number, sz: number, gx: number, gz: number): EntityRow[] => [
  ["switch-1", "switch", sx, 0, sz],
  ["gate-1", "gate", gx, 0, gz],
];
const gateChecks: CheckRow[] = [
  ["gate-open", "entities.gate-1.open", "eq", true],
  ["through-gate", "ship.x", "eq", 6],
];
const launchLayout = lane(8, 2, 30, [
  ...switchGate(5, 0, 6, 0),
  ["asteroid-1", "asteroid_titanium", 7, 0, 0],
  crystal("crystal-1", 3, 2),
]);

export const voltaOracle: PackOracle = {
  planet: {
    id: "planet-1",
    slug: "volta",
    name: "Volta",
    themeId: "volta-launchpad",
    planetConceptId: "variable",
  },
  missions: [
    {
      slug: "p1-m1",
      position: 1,
      title: "Wake the Ship",
      conceptId: "sequence",
      tier: "intro",
      seedPool: [101, 102],
      refSteps: 3,
      refEnergy: 3,
      par: { maxSteps: 7, maxEnergy: 7 },
      checks: [
        ["reach-pad", "ship.x", "eq", 3],
        ["reach-pad-lane", "ship.z", "eq", 0],
      ],
      layout: lane(5, 2, 20, [crystal("crystal-1", 1, 2)]),
    },
    {
      slug: "p1-m2",
      position: 2,
      title: "Count the Power Cells",
      conceptId: "arithmetic_expression",
      tier: "core",
      seedPool: [201, 202, 203],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: [
        ["hit-switch", "entities.switch-1.on", "eq", true],
        ["reach-switch", "ship.x", "eq", 5],
      ],
      layout: lane(7, 2, 24, [...switchGate(5, 0, 6, 0), crystal("crystal-1", 2, 2)]),
    },
    {
      slug: "p1-m3",
      position: 3,
      title: "Set Launch Power",
      conceptId: "variable_assignment",
      tier: "core",
      seedPool: [301, 302, 303],
      refSteps: 4,
      refEnergy: 4,
      par: { maxSteps: 8, maxEnergy: 8 },
      checks: [
        ["hit-switch", "entities.switch-1.on", "eq", true],
        ["reach-switch", "ship.z", "eq", 4],
      ],
      layout: lane(2, 6, 24, [...switchGate(0, 4, 0, 5), crystal("crystal-1", 2, 1)]),
    },
    {
      slug: "p1-m4",
      position: 4,
      title: "Charge the Core",
      conceptId: "variable_update",
      tier: "core",
      seedPool: [401, 402, 403],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: [
        ["reach-far-pad", "ship.x", "eq", 4],
        ["shield-up", "ship.shield", "eq", true],
      ],
      layout: lane(6, 2, 24, [crystal("crystal-1", 3, 2)]),
    },
    {
      slug: "p1-m5",
      position: 5,
      title: "Zorba Moon Launch",
      conceptId: "sensor_variable",
      tier: "stretch",
      seedPool: [501, 502, 503, 504],
      refSteps: 6,
      refEnergy: 6,
      par: { maxSteps: 11, maxEnergy: 11 },
      checks: gateChecks,
      layout: launchLayout,
    },
  ],
  boss: {
    slug: "volta-gate",
    title: "Volta Gate",
    partA: [
      { kind: "choice", optionCount: 4, correctIndex: 0 },
      { kind: "spot-bug", optionCount: 3, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 0 },
      { kind: "choice", optionCount: 4, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 0 },
    ],
    partB: {
      slug: "volta-gate-part-b",
      seedPool: [601, 602, 603],
      refSteps: 7,
      refEnergy: 7,
      checks: [...gateChecks, ["shield-up", "ship.shield", "eq", true]],
      layout: launchLayout,
    },
  },
  referenceDir: "content/references/planet-1",
  contentDir: "content/planets",
};
