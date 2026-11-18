// Lumina oracle: literals from docs/planet-3-lumina-content-spec.md.

import type { CheckRow, EntityRow, Heading, LayoutOracle, PackOracle } from "./pack-oracle";

const crystal = (id: string, x: number, z: number): EntityRow => [id, "crystal", x, 0, z];
const lane = (
  maxX: number,
  maxZ: number,
  energy: number,
  entities: EntityRow[],
  heading: Heading = "east",
): LayoutOracle => ({
  specBounds: { maxX, maxY: 0, maxZ },
  shipStart: { x: 0, y: 0, z: 0, heading, energy },
  entities,
});
const switchGate = (sx: number, sz: number, gx: number, gz: number): EntityRow[] => [
  ["switch-1", "switch", sx, 0, sz],
  ["gate-1", "gate", gx, 0, gz],
];
const switchChecks = (x: number): CheckRow[] => [
  ["hit-switch", "entities.switch-1.on", "eq", true, "final"],
  ["reach-switch", "ship.x", "eq", x, "final"],
];
const gateChecks: CheckRow[] = [
  ["gate-open", "entities.gate-1.open", "eq", true, "final"],
  ["through-gate", "ship.x", "eq", 6, "final"],
];
const gridEntities = (crystalX: number): EntityRow[] => [
  ["asteroid-1", "asteroid_titanium", 0, 0, 1],
  ...switchGate(5, 0, 6, 0),
  ["asteroid-2", "asteroid_titanium", 7, 0, 0],
  crystal("crystal-1", crystalX, 2),
];

export const luminaOracle: PackOracle = {
  planet: {
    id: "planet-3",
    slug: "lumina",
    name: "Lumina",
    themeId: "lumina-lightgrid",
    planetConceptId: "loop",
    trainingWheels: "partial",
  },
  missions: [
    {
      slug: "p3-m1",
      position: 1,
      title: "Light the First Tower",
      conceptId: "for_loop",
      tier: "intro",
      seedPool: [3101, 3102],
      refSteps: 4,
      refEnergy: 4,
      par: { maxSteps: 8, maxEnergy: 8 },
      checks: switchChecks(4),
      layout: lane(6, 2, 24, [...switchGate(4, 0, 5, 0), crystal("crystal-1", 2, 2)]),
    },
    {
      slug: "p3-m2",
      position: 2,
      title: "Count the Beacon Steps",
      conceptId: "loop_counter",
      tier: "core",
      seedPool: [3201, 3202, 3203],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: switchChecks(5),
      layout: lane(7, 2, 24, [...switchGate(5, 0, 6, 0), crystal("crystal-1", 3, 2)]),
    },
    {
      slug: "p3-m3",
      position: 3,
      title: "Fly Until the Dark Tower",
      conceptId: "while_loop",
      tier: "core",
      seedPool: [3301, 3302, 3303],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: switchChecks(5),
      layout: lane(7, 2, 24, [
        ["asteroid-1", "asteroid_titanium", 6, 0, 0],
        ["switch-1", "switch", 5, 0, 0],
        ["gate-1", "gate", 5, 0, 2],
        crystal("crystal-1", 2, 2),
      ]),
    },
    {
      slug: "p3-m4",
      position: 4,
      title: "Relight the Beacon Rows",
      conceptId: "nested_loop",
      tier: "core",
      seedPool: [3401, 3402, 3403],
      refSteps: 6,
      refEnergy: 6,
      par: { maxSteps: 11, maxEnergy: 11 },
      checks: [
        ["hit-switch", "entities.switch-1.on", "eq", true, "final"],
        ["reach-switch-x", "ship.x", "eq", 2, "final"],
        ["reach-switch-z", "ship.z", "eq", 2, "final"],
      ],
      layout: lane(4, 4, 24, [...switchGate(2, 2, 2, 3), crystal("crystal-1", 4, 4)]),
    },
    {
      slug: "p3-m5",
      position: 5,
      title: "Relight the Beacon Grid",
      conceptId: "loop_with_conditional",
      tier: "stretch",
      seedPool: [3501, 3502, 3503, 3504],
      refSteps: 8,
      refEnergy: 8,
      par: { maxSteps: 14, maxEnergy: 14 },
      checks: [
        ["shield-up", "ship.shield", "eq", true, "final"],
        ["gate-open", "entities.gate-1.open", "eq", true, "final"],
        ["through-gate", "ship.x", "eq", 6, "final"],
      ],
      layout: lane(8, 2, 30, gridEntities(3), "north"),
    },
  ],
  boss: {
    slug: "lumina-gate",
    title: "Lumina Gate",
    partA: [
      { kind: "choice", optionCount: 4, correctIndex: 0 },
      { kind: "spot-bug", optionCount: 3, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 0 },
      { kind: "choice", optionCount: 4, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 0 },
    ],
    partB: {
      slug: "lumina-gate-part-b",
      seedPool: [3601, 3602, 3603],
      refSteps: 7,
      refEnergy: 7,
      checks: gateChecks,
      layout: lane(8, 2, 30, gridEntities(2), "north"),
    },
  },
  referenceDir: "content/references/planet-3",
  contentDir: "content/planets",
};
