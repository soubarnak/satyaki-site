// Planet 5 — Astral. Transcribed from docs/planet-5-astral-content-spec.md.
// One module per Planet: a content fix stays inside that Planet's data.
// Nothing here is wired into the app (ticket #86); reference solutions
// live in content/references/planet-5/ and are never imported.
//
// Bounds: the spec lists inclusive maximum coordinates; `Bounds` is a
// cell count, so maxX/maxZ add 1 and maxY is at least 1.
//
// Training Wheels are `minimal` on this Planet: the Java starter is
// comments plus the editable-region markers, with no class wrapper.

import type {
  BossGate,
  Mission,
  Objective,
  PassCheck,
  Planet,
  PlanetPack,
  RosettaPair,
} from "@/lib/content";
import type { AuthoredLayout, Bounds, EntityInput } from "@/lib/ship-sim";

function bounds(maxX: number, maxY: number, maxZ: number): Bounds {
  return { maxX: maxX + 1, maxY: Math.max(maxY + 1, 1), maxZ: maxZ + 1 };
}

/** Python starter: comment lines, then the editable region. */
function pythonStarter(comments: string[]): string {
  return [...comments.map((c) => `# ${c}`), "# YOUR CODE BELOW", "", "# YOUR CODE ABOVE", ""].join(
    "\n",
  );
}

/** Java `minimal` starter: comment prompt and the editable-region markers only. */
function javaMinimal(comments: string[]): string {
  return [...comments.map((c) => `// ${c}`), "// YOUR CODE BELOW", "", "// YOUR CODE ABOVE", ""].join(
    "\n",
  );
}

function check(
  id: string,
  label: string,
  statePath: string,
  expected: PassCheck["expected"],
): PassCheck {
  return { id, label, statePath, comparator: "eq", expected, timing: "final" };
}

function objective(text: string, ...checkIds: string[]): Objective {
  return { text, checkIds };
}

function rosetta(python: string[], java: string[], note: string): RosettaPair {
  return { python: python.join("\n"), java: java.join("\n"), note };
}

const switchGate = (id: string, sx: number, sz: number, gx: number, gz: number): EntityInput[] => [
  { id: `switch-${id}`, type: "switch", x: sx, y: 0, z: sz, linkId: `gate-${id}` },
  { id: `gate-${id}`, type: "gate", x: gx, y: 0, z: gz, linkId: `gate-${id}` },
];
const titanium = (x: number, z: number): EntityInput => ({
  id: "asteroid-1",
  type: "asteroid_titanium",
  x,
  y: 0,
  z,
});
const crystal = (x: number, z: number): EntityInput => ({ id: "crystal-1", type: "crystal", x, y: 0, z });

export const astralPlanet: Planet = {
  id: "planet-5",
  slug: "astral",
  name: "Astral",
  themeId: "astral-starfield",
  planetConceptId: "list",
  missionSlugs: ["p5-m1", "p5-m2", "p5-m3", "p5-m4", "p5-m5"],
};

const cargoLayout = (maxX: number, switchX: number, crystalX: number): AuthoredLayout => ({
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
  bounds: bounds(maxX, 0, 2),
  entities: [
    ...switchGate("1", switchX, 0, switchX + 1, 0),
    titanium(maxX, 0),
    crystal(crystalX, 2),
  ],
});

const m1Layout = cargoLayout(6, 4, 1);
const m2Layout = cargoLayout(8, 4, 2);
const m3Layout = cargoLayout(7, 5, 1);
const m4Layout = cargoLayout(6, 4, 1);

const m5Layout: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
  bounds: bounds(6, 0, 6),
  entities: [
    ...switchGate("1", 3, 0, 3, 1),
    ...switchGate("2", 3, 5, 3, 6),
    titanium(4, 0),
    crystal(1, 2),
  ],
};

const partBLayout: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
  bounds: bounds(6, 0, 4),
  entities: [
    ...switchGate("1", 2, 0, 2, 1),
    ...switchGate("2", 2, 3, 2, 4),
    titanium(3, 0),
    crystal(0, 2),
  ],
};

const cargoChecks = (switchX: number): PassCheck[] => [
  check("switch-on", "Flip the cargo switch", "entities.switch-1.on", true),
  check("on-switch", "Reach the cargo switch", "ship.x", switchX),
  check("stay-lane", "Stay in the cargo lane", "ship.z", 0),
];

const reachSwitch = [objective("Reach the cargo switch.", "switch-on", "on-switch", "stay-lane")];

const m1Comments = [
  "Astral star cargo is scattered. Make a list of four 1s, then fly east.",
  "Write public class Main and public static void main(String[] args).",
  "Inside main, move() flies one cell the way the Ship faces.",
];
const m1PyComments = [m1Comments[0], "move() flies one cell the way the Ship faces."];
const m2Comments = [
  "The first slot is the lane length. The second slot is a Static lie.",
  "Write public class Main and public static void main(String[] args).",
  "Inside main, route[0] reads the first slot. move() flies one cell.",
];
const m2PyComments = [m2Comments[0], "route[0] reads the first slot. move() flies one cell."];
const m3Comments = [
  "Static stored 2. The lane length is 5. Write 5 into slot 0, then fly.",
  "Write public class Main and public static void main(String[] args).",
  "Inside main, move() flies one cell the way the Ship faces.",
];
const m3PyComments = [m3Comments[0], "move() flies one cell the way the Ship faces."];
const m4Comments = [
  "Two jumps sit in the list. Walk every index and fly that jump.",
  "Write public class Main and public static void main(String[] args).",
  "Inside main, move() flies one cell the way the Ship faces.",
];
const m4PyComments = [m4Comments[0], "move() flies one cell the way the Ship faces."];
const m5Comments = [
  "The last move slot is wrong. Write 3 there, then fly both lists in order.",
  "Write public class Main and public static void main(String[] args).",
  "Inside main, a turns slot of 1 means turn left before that leg.",
];
const m5PyComments = [
  m5Comments[0],
  "A turns slot of 1 means turn left before that leg. move() flies one cell.",
];
const partBComments = [
  "Haven Station's beacon answers. The second move slot is wrong.",
  "Write public class Main and public static void main(String[] args).",
  "Inside main, write 3 into that slot, then fly. A turns slot of 1 means turn left.",
];
const partBPyComments = [
  partBComments[0],
  "Write 3 there, then fly both lists in order. A turns slot of 1 means turn left.",
];

export const astralMissions: Mission[] = [
  {
    slug: "p5-m1",
    planet: "astral",
    position: 1,
    conceptId: "list_creation",
    planetConceptId: "list",
    tier: "intro",
    title: "Gather the Star Cargo",
    story:
      "You leave the Foundry. Static has scattered Astral's star cargo. Make a list of the four loose stars, then fly the cargo lane.",
    briefing: "Make a list of four 1s, one per loose star, then fly east onto the cargo switch.",
    objectives: reachSwitch,
    pythonStarter: pythonStarter(m1PyComments),
    javaStarter: javaMinimal(m1Comments),
    layout: m1Layout,
    seedPool: [5101, 5102],
    checks: cargoChecks(4),
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "list",
    hints: [
      "A list holds many values under one name. Make one, then fly the lane.",
      "Put four 1s in one list, one per loose star. Then call move() once per star.",
      "Make a list of four 1s, call move() four times, and press Run.",
    ],
    rosetta: rosetta(
      ["stars = [1, 1, 1, 1]"],
      ["int[] stars = {1, 1, 1, 1};"],
      "A list holds many values under one name.",
    ),
  },
  {
    slug: "p5-m2",
    planet: "astral",
    position: 2,
    conceptId: "list_indexing",
    planetConceptId: "list",
    tier: "core",
    title: "Read the First Star",
    story:
      "The first slot of your star list holds the lane length. A second slot is a Static lie. Read the first slot, then fly that far.",
    briefing: "Read index 0 from a list of 4 then 9, and fly that many cells east onto the cargo switch.",
    objectives: reachSwitch,
    pythonStarter: pythonStarter(m2PyComments),
    javaStarter: javaMinimal(m2Comments),
    layout: m2Layout,
    seedPool: [5201, 5202, 5203],
    checks: cargoChecks(4),
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "list",
    hints: [
      "Index 0 is the first slot. The second slot is a Static lie.",
      "Make a list of 4 then 9. Fly as many cells as the first slot.",
      "Make a list of 4 then 9, call move() as many times as index 0, and press Run.",
    ],
    rosetta: rosetta(
      ["route = [4, 9]", "log(route[0])"],
      ["int[] route = {4, 9};", "log(route[0]);"],
      "Index 0 is the first slot in the list.",
    ),
  },
  {
    slug: "p5-m3",
    planet: "astral",
    position: 3,
    conceptId: "list_update",
    planetConceptId: "list",
    tier: "core",
    title: "Correct the Star Count",
    story:
      "Static wrote the wrong count in the star list. Replace that slot with the true lane length, then fly to the cargo switch.",
    briefing:
      "Change the list's only slot from 2 to 5, then fly that many cells east onto the cargo switch.",
    objectives: reachSwitch,
    pythonStarter: pythonStarter(m3PyComments),
    javaStarter: javaMinimal(m3Comments),
    layout: m3Layout,
    seedPool: [5301, 5302, 5303],
    checks: cargoChecks(5),
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "list",
    hints: [
      "Writing a slot replaces that one value. The stored 2 is wrong.",
      "Make a list whose only slot is 2, write 5 into index 0, then fly that many cells.",
      "Set index 0 to 5, call move() that many times, and press Run.",
    ],
    rosetta: rosetta(
      ["route = [2]", "route[0] = 5"],
      ["int[] route = {2};", "route[0] = 5;"],
      "Writing a slot replaces only that one value.",
    ),
  },
  {
    slug: "p5-m4",
    planet: "astral",
    position: 4,
    conceptId: "list_iteration",
    planetConceptId: "list",
    tier: "core",
    title: "Walk the Star List",
    story:
      "The star list holds two jumps along the cargo lane. Walk every slot by its index and fly each jump.",
    briefing:
      "Walk both slots by index, a jump of 1 then a jump of 3, and fly them east onto the cargo switch.",
    objectives: reachSwitch,
    pythonStarter: pythonStarter(m4PyComments),
    javaStarter: javaMinimal(m4Comments),
    layout: m4Layout,
    seedPool: [5401, 5402, 5403],
    checks: cargoChecks(4),
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "list",
    hints: [
      "Visit each slot by its index. Fly the number stored there.",
      "Make a list of 1 then 3. For index 0 and index 1, call move() that many times.",
      "Walk both indexes, fly the jump in each slot, and press Run.",
    ],
    rosetta: rosetta(
      ["route = [1, 3]", "for i in range(2):", "    log(route[i])"],
      ["int[] route = {1, 3};", "for (int i = 0; i < 2; i++) {", "    log(route[i]);", "}"],
      "An index walk visits every slot, starting at 0.",
    ),
  },
  {
    slug: "p5-m5",
    planet: "astral",
    position: 5,
    conceptId: "list_driven_route",
    planetConceptId: "list",
    tier: "stretch",
    title: "Fly the Star Route",
    story:
      "Static scrambled the last star step. Correct the list, follow the ordered star route, and light the Haven rescue signal.",
    briefing:
      "Correct the last move slot from 1 to 3, then follow the move list and the turn list in order to the Haven signal.",
    objectives: [
      objective("Light the first star switch.", "first-switch"),
      objective("Open the star-lane gate.", "lane-gate"),
      objective(
        "Light the Haven rescue signal.",
        "signal-switch",
        "signal-gate",
        "signal-lane",
        "reach-signal",
      ),
    ],
    pythonStarter: pythonStarter(m5PyComments),
    javaStarter: javaMinimal(m5Comments),
    layout: m5Layout,
    seedPool: [5501, 5502, 5503, 5504],
    checks: [
      check("first-switch", "Light the first star switch", "entities.switch-1.on", true),
      check("lane-gate", "Open the star-lane gate", "entities.gate-1.open", true),
      check("signal-switch", "Light the Haven rescue signal", "entities.switch-2.on", true),
      check("signal-gate", "Open the Haven signal gate", "entities.gate-2.open", true),
      check("signal-lane", "Stay on the signal lane", "ship.x", 3),
      check("reach-signal", "Reach the Haven signal", "ship.z", 5),
    ],
    par: { maxSteps: 16, maxEnergy: 16 },
    star3Concept: "list",
    hints: [
      "Two lists share one index. Correct the last move slot before you fly.",
      "Write 3 into the last move slot. For each index, turn left when the turns slot is 1, then fly the move slot.",
      "Set the last move slot to 3, walk both lists from index 0, turn left only when that turns slot is 1, and press Run.",
    ],
    rosetta: rosetta(
      ["route = [3, 2, 3]", "turns = [0, 1, 0]", "log(route[0])"],
      ["int[] route = {3, 2, 3};", "int[] turns = {0, 1, 0};", "log(route[0]);"],
      "Two lists, read in the same order, fly the star route.",
    ),
  },
];

export const astralBossGate: BossGate = {
  slug: "astral-gate",
  planet: "astral",
  title: "Astral Gate",
  partA: [
    {
      kind: "choice",
      prompt: "The first slot of a list is index:",
      options: ["1", "0", "the length", "the Seed"],
      correctIndex: 1,
      explanation: "Lists and arrays in both languages start at index 0.",
    },
    {
      kind: "spot-bug",
      prompt:
        "A Cadet writes a list or array named stars holding four 1s, then four move() calls that never read stars. The lane Passes, but Star 3 does not. What is missing?",
      options: ["a read or write of a slot, such as stars[0]", "a crystal", "another Seed", "a turn"],
      correctIndex: 0,
      explanation:
        "Star 3 for list needs a list or array created and a slot read or written by index, and that code must run.",
    },
    {
      kind: "predict-state",
      prompt:
        "Starting at x 0 facing east, a list or array named route holds 1 then 3. For each index the Ship flies that slot with move(). What is ship.x?",
      options: ["2", "4", "6", "8"],
      correctIndex: 1,
      explanation: "The slots are 1 and 3, so the Ship moves four cells east.",
    },
    {
      kind: "choice",
      prompt:
        "A list or array holds 2 in its first slot, and the code writes 5 into index 0. The first slot is now:",
      options: ["2", "5", "2 and 5", "empty"],
      correctIndex: 1,
      explanation: "Writing a slot replaces that slot only.",
    },
    {
      kind: "choice",
      prompt: "A Ship sensor such as the scan-ahead sensor returns:",
      options: [
        "a list or array of names",
        "one scalar, never a list or array",
        "the Cadet's list or array",
        "the Seed",
      ],
      correctIndex: 1,
      explanation:
        "Sensors return one JSON scalar in v1. A Cadet's list or array is program memory, not a sensor result.",
    },
  ],
  partB: {
    slug: "astral-gate-part-b",
    briefing:
      "Haven Station's automated beacon answers: correct the star route and fly it until the beacon switch lights.",
    objectives: [
      objective("Open the lane gate.", "lane-open"),
      objective(
        "Light the Haven beacon.",
        "beacon-lit",
        "beacon-gate",
        "beacon-lane",
        "reach-beacon",
      ),
    ],
    pythonStarter: pythonStarter(partBPyComments),
    javaStarter: javaMinimal(partBComments),
    layout: partBLayout,
    seedPool: [5601, 5602, 5603],
    checks: [
      check("lane-open", "Open the lane gate", "entities.gate-1.open", true),
      check("beacon-lit", "Light the Haven beacon", "entities.switch-2.on", true),
      check("beacon-gate", "Open the beacon gate", "entities.gate-2.open", true),
      check("beacon-lane", "Stay on the beacon lane", "ship.x", 2),
      check("reach-beacon", "Reach the Haven beacon", "ship.z", 3),
    ],
    hints: [
      "The beacon answers at the end of the route. Correct the second move slot first.",
      "Write 3 into the second move slot. Turn left when the turns slot is 1, then fly the move slot.",
      "Set the second move slot to 3, walk both indexes, turn left only on the second leg, and press Run.",
    ],
  },
};

export const astralPack: PlanetPack = {
  planet: astralPlanet,
  missions: astralMissions,
  boss: astralBossGate,
};
