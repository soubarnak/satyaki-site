// Cometa oracle: literals from docs/planet-2-cometa-content-spec.md.

import type { CheckRow, EntityRow, Heading, LayoutOracle, PackOracle } from "./pack-oracle";

const crystal = (x: number, z: number): EntityRow => ["crystal-1", "crystal", x, 0, z];
const switchGate = (sx: number, gx: number): EntityRow[] => [
  ["switch-1", "switch", sx, 0, 0],
  ["gate-1", "gate", gx, 0, 0],
];
const layout = (
  maxX: number,
  start: { x: number; heading: Heading; energy: number },
  entities: EntityRow[],
): LayoutOracle => ({
  specBounds: { maxX, maxY: 0, maxZ: 2 },
  shipStart: { x: start.x, y: 0, z: 0, heading: start.heading, energy: start.energy },
  entities,
});

const switchChecks = (switchX: number): CheckRow[] => [
  ["hit-switch", "entities.switch-1.on", "eq", true, "final"],
  ["reach-switch", "ship.x", "eq", switchX, "final"],
];
const laneChecks: CheckRow[] = [
  ["shield-up", "ship.shield", "eq", true, "final"],
  ["gate-open", "entities.gate-1.open", "eq", true, "final"],
  ["through-gate", "ship.x", "eq", 6, "final"],
];
const stormLane = (crystalX: number): LayoutOracle =>
  layout(8, { x: 0, heading: "north", energy: 30 }, [
    ["asteroid-1", "asteroid_titanium", 0, 0, 1],
    ...switchGate(5, 6),
    ["asteroid-2", "asteroid_titanium", 7, 0, 0],
    crystal(crystalX, 2),
  ]);
const spireLane = layout(6, { x: 1, heading: "north", energy: 24 }, [
  ["asteroid-1", "asteroid_titanium", 1, 0, 1],
  ...switchGate(5, 6),
  crystal(3, 2),
]);

export const cometaOracle: PackOracle = {
  planet: {
    id: "planet-2",
    slug: "cometa",
    name: "Cometa",
    themeId: "cometa-stormgate",
    planetConceptId: "conditional",
    trainingWheels: "full-scaffold",
  },
  missions: [
    {
      slug: "p2-m1",
      position: 1,
      title: "Reach the Storm Gate",
      conceptId: "comparison",
      tier: "intro",
      seedPool: [2101, 2102],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: switchChecks(5),
      layout: layout(7, { x: 0, heading: "east", energy: 24 }, [...switchGate(5, 6), crystal(2, 2)]),
    },
    {
      slug: "p2-m2",
      position: 2,
      title: "Shields Up at the Gate",
      conceptId: "if_statement",
      tier: "core",
      seedPool: [2201, 2202, 2203],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: [["shield-up", "ship.shield", "eq", true, "final"], ...switchChecks(4)],
      layout: layout(7, { x: 0, heading: "east", energy: 24 }, [...switchGate(4, 5), crystal(2, 2)]),
    },
    {
      slug: "p2-m3",
      position: 3,
      title: "Pick the Clear Lane",
      conceptId: "if_else",
      tier: "core",
      seedPool: [2301, 2302, 2303],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: switchChecks(5),
      layout: spireLane,
    },
    {
      slug: "p2-m4",
      position: 4,
      title: "Three Ways Through the Storm",
      conceptId: "else_if_chain",
      tier: "core",
      seedPool: [2401, 2402, 2403],
      refSteps: 5,
      refEnergy: 5,
      par: { maxSteps: 10, maxEnergy: 10 },
      checks: switchChecks(5),
      layout: spireLane,
    },
    {
      slug: "p2-m5",
      position: 5,
      title: "The Final Safe Lane",
      conceptId: "boolean_decision",
      tier: "stretch",
      seedPool: [2501, 2502, 2503, 2504],
      refSteps: 8,
      refEnergy: 8,
      par: { maxSteps: 14, maxEnergy: 14 },
      checks: laneChecks,
      layout: stormLane(3),
    },
  ],
  boss: {
    slug: "cometa-gate",
    title: "Cometa Gate",
    partA: [
      { kind: "choice", optionCount: 4, correctIndex: 0 },
      { kind: "spot-bug", optionCount: 3, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 0 },
      { kind: "choice", optionCount: 4, correctIndex: 0 },
      { kind: "predict-state", optionCount: 3, correctIndex: 0 },
    ],
    partB: {
      slug: "cometa-gate-part-b",
      seedPool: [2601, 2602, 2603],
      refSteps: 8,
      refEnergy: 8,
      checks: laneChecks,
      layout: stormLane(2),
    },
  },
  referenceDir: "content/references/planet-2",
  contentDir: "content/planets",
};
