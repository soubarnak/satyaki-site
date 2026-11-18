// Foundry oracle: literals from docs/planet-4-foundry-content-spec.md.

import type { CheckRow, EntityRow, LayoutOracle, PackOracle } from "./pack-oracle";

const crystal = (id: string, x: number, z: number): EntityRow => [id, "crystal", x, 0, z];
const switchGate = (n: number, sx: number, gx: number): EntityRow[] => [
  [`switch-${n}`, "switch", sx, 0, 0],
  [`gate-${n}`, "gate", gx, 0, 0],
];
const hall = (entities: EntityRow[]): LayoutOracle => ({
  specBounds: { maxX: 8, maxY: 0, maxZ: 2 },
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
  entities,
});
const oneGate = hall([
  ...switchGate(1, 3, 4),
  ["asteroid-1", "asteroid_titanium", 6, 0, 0],
  crystal("crystal-1", 2, 2),
]);
const twoGateMission = hall([
  ...switchGate(1, 3, 4),
  ...switchGate(2, 6, 7),
  ["asteroid-1", "asteroid_titanium", 8, 0, 0],
  crystal("crystal-1", 2, 2),
]);
const twoGatePartB = hall([
  ...switchGate(1, 3, 4),
  ...switchGate(2, 6, 7),
  crystal("crystal-1", 5, 2),
]);
const switchThrough: CheckRow[] = [
  ["switch-on", "entities.switch-1.on", "eq", true, "final"],
  ["through-gate", "ship.x", "eq", 4, "final"],
];
const oneMission = (
  slug: string,
  position: number,
  title: string,
  conceptId: "function_definition" | "function_parameter" | "function_return" | "local_variable",
  tier: "intro" | "core",
  seedPool: number[],
  checks: CheckRow[],
) => ({
  slug,
  position,
  title,
  conceptId,
  tier,
  seedPool,
  refSteps: 4,
  refEnergy: 4,
  par: { maxSteps: 8, maxEnergy: 8 },
  checks,
  layout: oneGate,
});
const bothGates = (last: string): CheckRow[] => [
  ["gate-one-open", "entities.gate-1.open", "eq", true, "final"],
  ["gate-two-open", "entities.gate-2.open", "eq", true, "final"],
  [last, "ship.x", "eq", 7, "final"],
];

export const foundryOracle: PackOracle = {
  planet: {
    id: "planet-4",
    slug: "foundry",
    name: "Foundry",
    themeId: "foundry-forge",
    planetConceptId: "function",
    trainingWheels: "partial",
  },
  missions: [
    oneMission("p4-m1", 1, "Define the Forge Helper", "function_definition", "intro", [4101, 4102], [
      ["switch-on", "entities.switch-1.on", "eq", true, "final"],
      ["gate-open", "entities.gate-1.open", "eq", true, "final"],
      ["through-gate", "ship.x", "eq", 4, "final"],
    ]),
    oneMission("p4-m2", 2, "Feed the Forge Helper", "function_parameter", "core", [4201, 4202, 4203], switchThrough),
    oneMission("p4-m3", 3, "Return the Forge Reading", "function_return", "core", [4301, 4302, 4303], switchThrough),
    oneMission("p4-m4", 4, "Keep the Forge Count Local", "local_variable", "core", [4401, 4402, 4403], switchThrough),
    {
      slug: "p4-m5",
      position: 5,
      title: "Wake Melodia",
      conceptId: "function_composition",
      tier: "stretch",
      seedPool: [4501, 4502, 4503, 4504],
      refSteps: 7,
      refEnergy: 7,
      par: { maxSteps: 13, maxEnergy: 13 },
      checks: bothGates("melodia-wake"),
      layout: twoGateMission,
    },
  ],
  boss: {
    slug: "foundry-gate",
    title: "Foundry Gate",
    partA: [
      { kind: "choice", optionCount: 4, correctIndex: 1 },
      { kind: "spot-bug", optionCount: 4, correctIndex: 0 },
      { kind: "predict-state", optionCount: 4, correctIndex: 1 },
      { kind: "choice", optionCount: 4, correctIndex: 1 },
      { kind: "spot-bug", optionCount: 4, correctIndex: 0 },
    ],
    partB: {
      slug: "foundry-gate-part-b",
      seedPool: [4601, 4602, 4603],
      refSteps: 7,
      refEnergy: 7,
      checks: bothGates("through-both"),
      layout: twoGatePartB,
    },
  },
  referenceDir: "content/references/planet-4",
  contentDir: "content/planets",
};
