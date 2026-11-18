// Planet 1 — Volta. Transcribed from docs/planet-1-volta-content-spec.md.
// One module per Planet: a content fix stays inside that Planet's data.
// Nothing here is wired into the app (ticket #82); reference solutions
// live in content/references/planet-1/ and are never imported.
//
// Bounds: the spec lists inclusive maximum coordinates; `Bounds` is a
// cell count, so maxX/maxZ add 1 and maxY is at least 1.

import type {
  BossGate,
  Mission,
  Objective,
  PassCheck,
  Planet,
  PlanetPack,
  RosettaPair,
} from "@/lib/content";
import type { AuthoredLayout, Bounds } from "@/lib/ship-sim";

function bounds(maxX: number, maxY: number, maxZ: number): Bounds {
  return { maxX: maxX + 1, maxY: Math.max(maxY + 1, 1), maxZ: maxZ + 1 };
}

/** Python starter: comment lines, then the editable region. */
function pythonStarter(comments: string[]): string {
  return [...comments.map((c) => `# ${c}`), "# YOUR CODE BELOW", "", "# YOUR CODE ABOVE", ""].join(
    "\n",
  );
}

/** Java full-scaffold starter: class and main given, markers inside main. */
function javaFullScaffold(comments: string[]): string {
  return [
    "public class Main {",
    "    public static void main(String[] args) {",
    ...comments.map((c) => `        // ${c}`),
    "        // YOUR CODE BELOW",
    "",
    "        // YOUR CODE ABOVE",
    "    }",
    "}",
    "",
  ].join("\n");
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

export const voltaPlanet: Planet = {
  id: "planet-1",
  slug: "volta",
  name: "Volta",
  themeId: "volta-launchpad",
  planetConceptId: "variable",
  missionSlugs: ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"],
};

const lane1: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 20 },
  bounds: bounds(5, 0, 2),
  entities: [{ id: "crystal-1", type: "crystal", x: 1, y: 0, z: 2 }],
};

const lane2: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(7, 0, 2),
  entities: [
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const lane3: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 24 },
  bounds: bounds(2, 0, 6),
  entities: [
    { id: "switch-1", type: "switch", x: 0, y: 0, z: 4, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 0, y: 0, z: 5, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 1 },
  ],
};

const lane4: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(6, 0, 2),
  entities: [{ id: "crystal-1", type: "crystal", x: 3, y: 0, z: 2 }],
};

const launchLane: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
  bounds: bounds(8, 0, 2),
  entities: [
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
    { id: "asteroid-1", type: "asteroid_titanium", x: 7, y: 0, z: 0 },
    { id: "crystal-1", type: "crystal", x: 3, y: 0, z: 2 },
  ],
};

const m1Comments = ["Wake the Ship. move() flies one cell the way the Ship faces."];
const m2Comments = [
  "Two stacks wait: 2 cells, then 3 cells. Add them with + and log the total.",
  "Then fly east onto the switch. move() flies one cell.",
];
const m3Comments = [
  "Launch power is the count 4. Store it in a variable and log it.",
  "Then fly north onto the switch. move() flies one cell.",
];
const m4Comments = [
  "Start a charge counter at 0. At each pad, add 1 to it and log it.",
  "Pads wait 2 cells and 4 cells east. shield() raises the shield.",
];
const m5PythonComments = [
  "Sensors are free questions. distance_ahead() counts clear cells ahead.",
  "Store its answer in a variable and log it. Then fly east: switch, gate, stop.",
];
const m5JavaComments = [
  "Sensors are free questions. distanceAhead() counts clear cells ahead.",
  "Store its answer in a variable and log it. Then fly east: switch, gate, stop.",
];
const partBLead = "Set launch power from the Ship's energy, fly east through the launch gate, and raise the shield.";
const partBComments = [
  partBLead,
  "Store its answer in a variable and log it. Then fly east: switch, gate, stop.",
  "Then end with shield().",
];

export const voltaMissions: Mission[] = [
  {
    slug: "p1-m1",
    planet: "volta",
    position: 1,
    conceptId: "sequence",
    planetConceptId: "variable",
    tier: "intro",
    title: "Wake the Ship",
    story:
      "Dawn lights the Volta launch pad. The Ship sleeps with a dead power core, and Haven Station is silent. Wake the Ship, Cadet.",
    briefing: "Fly the Ship east onto the glowing launch pad.",
    objectives: [objective("Reach the launch pad.", "reach-pad", "reach-pad-lane")],
    pythonStarter: pythonStarter(m1Comments),
    javaStarter: javaFullScaffold(m1Comments),
    layout: lane1,
    seedPool: [101, 102],
    checks: [
      check("reach-pad", "Reach the launch pad", "ship.x", 3),
      check("reach-pad-lane", "Stay in the launch lane", "ship.z", 0),
    ],
    par: { maxSteps: 7, maxEnergy: 7 },
    star3Concept: "variable",
    hints: [
      "The Ship faces east. One move() flies one cell east.",
      "Count the pad cells east of the Ship. Call move() once for each cell.",
      "Call move() three times, one after another, then press Run.",
    ],
    rosetta: rosetta(
      ["power = 0", "power = 3", "log(power)"],
      ["int power = 0;", "power = 3;", "log(power);"],
      "A variable is a named box: put a value in, and the name reads it back.",
    ),
  },
  {
    slug: "p1-m2",
    planet: "volta",
    position: 2,
    conceptId: "arithmetic_expression",
    planetConceptId: "variable",
    tier: "core",
    title: "Count the Power Cells",
    story:
      "The power core wakes hungry. Five power cells wait down the east lane, Cadet, and the core switch sleeps at the far end of the lane.",
    briefing: "Add the two cell stacks, log the total, then fly to the core switch.",
    objectives: [objective("Fly onto the core switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m2Comments),
    javaStarter: javaFullScaffold(m2Comments),
    layout: lane2,
    seedPool: [201, 202, 203],
    checks: [
      check("hit-switch", "Switch the core switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the core switch", "ship.x", 5),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "variable",
    hints: [
      "The + sign adds two numbers. log() shows the answer.",
      "Store 2 + 3 in a variable, log it, and count its answer in move() calls east.",
      "Set a variable to 2 + 3, log it, then call move() five times.",
    ],
    rosetta: rosetta(
      ["cells = 2 + 3", "log(cells)"],
      ["int cells = 2 + 3;", "log(cells);"],
      "Code works out 2 + 3 first, then the variable holds the answer: 5.",
    ),
  },
  {
    slug: "p1-m3",
    planet: "volta",
    position: 3,
    conceptId: "variable_assignment",
    planetConceptId: "variable",
    tier: "core",
    title: "Set Launch Power",
    story:
      "North of the pad, the launch switch waits above the Zorba moon dust. Set the launch power, Cadet, then fly north and switch it on.",
    briefing: "Store the launch power in a variable, log it, then fly north to the launch switch.",
    objectives: [objective("Fly onto the launch switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m3Comments),
    javaStarter: javaFullScaffold(m3Comments),
    layout: lane3,
    seedPool: [301, 302, 303],
    checks: [
      check("hit-switch", "Switch the launch switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the launch switch", "ship.z", 4),
    ],
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "variable",
    hints: [
      "A variable assignment stores a value under a name. Name one power and store 4 in it.",
      "Assign 4 to a variable, log the variable, and count its value in move() calls north.",
      "Name a variable power, store 4 in it, log it, then call move() four times.",
    ],
    rosetta: rosetta(
      ["power = 4", "log(power)"],
      ["int power = 4;", "log(power);"],
      "Assignment puts one value in the box. Java names the box kind: int for a counting number.",
    ),
  },
  {
    slug: "p1-m4",
    planet: "volta",
    position: 4,
    conceptId: "variable_update",
    planetConceptId: "variable",
    tier: "core",
    title: "Charge the Core",
    story:
      "Two charge pads glow along the east lane, dimmed by Static. Charge the core at both pads, Cadet, then raise the shield to hold it.",
    briefing: "Grow a charge counter at each pad, then raise the shield at the far pad.",
    objectives: [
      objective("Reach the far charge pad.", "reach-far-pad"),
      objective("Raise the shield.", "shield-up"),
    ],
    pythonStarter: pythonStarter(m4Comments),
    javaStarter: javaFullScaffold(m4Comments),
    layout: lane4,
    seedPool: [401, 402, 403],
    checks: [
      check("reach-far-pad", "Reach the far charge pad", "ship.x", 4),
      check("shield-up", "Raise the shield", "ship.shield", true),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "variable",
    hints: [
      "Updating a variable reads its old value: charge = charge + 1 grows it by one.",
      "Fly 2 cells, grow the counter, fly 2 more, grow it again, then call shield().",
      "Start charge at 0. After each pair of move() calls, set charge = charge + 1 and log it. End with shield().",
    ],
    rosetta: rosetta(
      ["charge = 0", "charge = charge + 1", "charge = charge + 1", "log(charge)"],
      ["int charge = 0;", "charge = charge + 1;", "charge = charge + 1;", "log(charge);"],
      "An update reads the old value, works out a new one, and stores it under the same name.",
    ),
  },
  {
    slug: "p1-m5",
    planet: "volta",
    position: 5,
    conceptId: "sensor_variable",
    planetConceptId: "variable",
    tier: "stretch",
    title: "Zorba Moon Launch",
    story:
      "Zorba moon sensors blink above the pad. Read them, Cadet, set the launch power from what they say, and fly through the launch gate.",
    briefing: "Store a sensor reading in a variable, log it, then fly through the launch gate.",
    objectives: [
      objective("Open the launch gate.", "gate-open"),
      objective("Fly through the launch gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m5PythonComments),
    javaStarter: javaFullScaffold(m5JavaComments),
    layout: launchLane,
    seedPool: [501, 502, 503, 504],
    checks: [
      check("gate-open", "Open the launch gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the launch gate", "ship.x", 6),
    ],
    par: { maxSteps: 11, maxEnergy: 11 },
    star3Concept: "variable",
    hints: [
      "A sensor answer is a value. Catch the cells-ahead count in a variable.",
      "Store the cells-ahead count and log it. The switch sits 5 cells east; the gate is 1 cell past it.",
      "Store the sensor reading, log it, then call move() six times and stop before the grey asteroid.",
    ],
    rosetta: rosetta(
      ["ahead = distance_ahead()", "log(ahead)"],
      ["int ahead = distanceAhead();", "log(ahead);"],
      "A sensor reading is just a value, so a variable can hold it and log() can show it.",
    ),
  },
];

export const voltaBossGate: BossGate = {
  slug: "volta-gate",
  planet: "volta",
  title: "Volta Gate",
  partA: [
    {
      kind: "choice",
      prompt: "What does a variable do?",
      options: [
        "It holds a value under a name",
        "It flies the Ship",
        "It deletes a value",
        "It blocks an asteroid",
      ],
      correctIndex: 0,
      explanation: "A variable stores one value so later code can read it by name.",
    },
    {
      kind: "spot-bug",
      prompt:
        'This code should store launch power. Tap the bug.\n    power = "4\n    log(power)',
      options: [
        "The value is missing its closing quote",
        "log needs brackets",
        "power needs a capital letter",
      ],
      correctIndex: 0,
      explanation: "Text values need both quotes; a counting number needs none.",
    },
    {
      kind: "predict-state",
      prompt:
        "The Ship starts at x 0 facing east. Code: move() then move(). Where is the Ship?",
      options: ["x 2", "x 1", "x 0", "z 2"],
      correctIndex: 0,
      explanation: "Each move() flies one cell east, so two moves reach x 2.",
    },
    {
      kind: "choice",
      prompt: "charge = charge + 1 does what?",
      options: [
        "Reads charge, adds 1, stores it back",
        "Compares charge to 1",
        "Erases charge",
        "Flies 1 cell",
      ],
      correctIndex: 0,
      explanation: "An update reads the old value, works out a new one, and stores it.",
    },
    {
      kind: "predict-state",
      prompt:
        "Power starts at 2. Then the code runs power = power + 3, then log(power). What shows?",
      options: ["5", "2", "3", "23"],
      correctIndex: 0,
      explanation: "The update replaces 2 with 2 + 3, so the log shows 5.",
    },
  ],
  partB: {
    slug: "volta-gate-part-b",
    briefing:
      "Set launch power from the Ship's energy, fly east through the launch gate, and raise the shield.",
    objectives: [
      objective("Open the launch gate.", "gate-open"),
      objective("Fly through the launch gate.", "through-gate"),
      objective("Raise the shield.", "shield-up"),
    ],
    pythonStarter: pythonStarter(partBComments),
    javaStarter: javaFullScaffold(partBComments),
    layout: launchLane,
    seedPool: [601, 602, 603],
    checks: [
      check("gate-open", "Open the launch gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the launch gate", "ship.x", 6),
      check("shield-up", "Raise the shield", "ship.shield", true),
    ],
    hints: [
      "energy() tells how much energy the Ship holds. A variable can keep its answer.",
      "Store energy(), log it, fly 5 cells to the switch and 1 more through the gate.",
      "Store and log the energy reading, call move() six times, then call shield().",
    ],
  },
};

export const voltaPack: PlanetPack = {
  planet: voltaPlanet,
  missions: voltaMissions,
  boss: voltaBossGate,
};
