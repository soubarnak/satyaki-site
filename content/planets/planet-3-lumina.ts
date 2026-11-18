// Planet 3 — Lumina. Transcribed from docs/planet-3-lumina-content-spec.md.
// One module per Planet: a content fix stays inside that Planet's data.
// Nothing here is wired into the app (ticket #84); reference solutions
// live in content/references/planet-3/ and are never imported.
//
// Bounds: the spec lists inclusive maximum coordinates; `Bounds` is a
// cell count, so maxX/maxZ add 1 and maxY is at least 1.
//
// Java Training Wheels are `partial`: the class wrapper is given and the
// Cadet writes main and its closing brace inside the editable region.

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

/** Java partial starter: class given, no main outside the markers. */
function javaPartial(comments: string[]): string {
  return [
    "public class Main {",
    ...comments.map((c) => `    // ${c}`),
    "    // YOUR CODE BELOW",
    "",
    "    // YOUR CODE ABOVE",
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

export const luminaPlanet: Planet = {
  id: "planet-3",
  slug: "lumina",
  name: "Lumina",
  themeId: "lumina-lightgrid",
  planetConceptId: "loop",
  missionSlugs: ["p3-m1", "p3-m2", "p3-m3", "p3-m4", "p3-m5"],
};

const eastLane1: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(6, 0, 2),
  entities: [
    { id: "switch-1", type: "switch", x: 4, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const eastLane2: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(7, 0, 2),
  entities: [
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 3, y: 0, z: 2 },
  ],
};

const darkTowerLane: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(7, 0, 2),
  entities: [
    { id: "asteroid-1", type: "asteroid_titanium", x: 6, y: 0, z: 0 },
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 5, y: 0, z: 2, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const ridge: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(4, 0, 4),
  entities: [
    { id: "switch-1", type: "switch", x: 2, y: 0, z: 2, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 2, y: 0, z: 3, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 4, y: 0, z: 4 },
  ],
};

const gridLane: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 30 },
  bounds: bounds(8, 0, 2),
  entities: [
    { id: "asteroid-1", type: "asteroid_titanium", x: 0, y: 0, z: 1 },
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
    { id: "asteroid-2", type: "asteroid_titanium", x: 7, y: 0, z: 0 },
    { id: "crystal-1", type: "crystal", x: 3, y: 0, z: 2 },
  ],
};

const partBLane: AuthoredLayout = {
  ...gridLane,
  entities: gridLane.entities.map((e) =>
    e.id === "crystal-1" ? { ...e, x: 2, z: 2 } : e,
  ),
};

const m1PythonComments = [
  "A for loop repeats its block a set number of times. range(4) counts 0, 1, 2, 3.",
  "Loop move() to fly east onto the beacon switch. move() flies one cell.",
];
const m1JavaComments = [
  "A for loop repeats its block a set number of times.",
  "Write main below. Inside it, loop move() east onto the switch.",
];
const m2PythonComments = [
  "The loop counter is the count the loop is on: range(5) gives 0, 1, 2, 3, 4.",
  "Loop move() east, and log the counter each time so the tower can count with you.",
];
const m2JavaComments = [
  "The loop counter is the count the loop is on: a loop of 5 gives 0, 1, 2, 3, 4.",
  "Write main below. Loop move() east, and log the counter each time so the tower can count with you.",
];
const m3PythonComments = [
  "A while loop repeats while its answer stays True. distance_ahead() counts clear cells.",
  "While clear cells remain ahead, move(). The grey tower ahead ends the count at 0.",
];
const m3JavaComments = [
  "A while loop repeats while its answer stays true. distanceAhead() counts clear cells.",
  "Write main below. While clear cells remain ahead, move(). The grey tower ahead ends the count at 0.",
];
const m4PythonComments = [
  "A loop inside a loop runs its whole inner count for each outer count.",
  "Each row here is 2 moves, then one turn left. Two rows climb to the switch.",
];
const m4JavaComments = [
  "A loop inside a loop runs its whole inner count for each outer count.",
  "Write main below. Each row here is 2 moves, then one turnLeft(). Two rows climb to the switch.",
];
const m5PythonComments = [
  "A loop can hold a decision. Each round, ask if the way ahead is blocked.",
  "First raise the shield if it is down. Then loop: turn east if blocked, else move.",
  "Fly east: switch, gate, stop.",
];
const m5JavaComments = [
  "A loop can hold a decision. Each round, ask if the way ahead is blocked.",
  "Write main below. First raise the shield if isShieldOn() is false and energy allows.",
  "Then loop: turnRight() if distanceAhead() is 0, else move().",
  "Fly east: switch, gate, stop.",
];
const partBLead = "Loop east through the beacon gate, turning off the blocked lane inside the loop.";
const partBPythonComments = [
  partBLead,
  "A loop can hold a decision. Each round, ask if the way ahead is blocked.",
  "Loop: turn east if blocked, else move. Fly east: switch, gate, stop.",
];
const partBJavaComments = [
  partBLead,
  "Write main below. Each round, ask if distanceAhead() is 0.",
  "Loop: turnRight() if blocked, else move(). Fly east: switch, gate, stop.",
];

export const luminaMissions: Mission[] = [
  {
    slug: "p3-m1",
    planet: "lumina",
    position: 1,
    conceptId: "for_loop",
    planetConceptId: "loop",
    tier: "intro",
    title: "Light the First Tower",
    story:
      "Dark beacon towers rise over Lumina's Trina sector, their cycles stilled by Static. The first tower waits down the east lane. Light it, Cadet.",
    briefing: "Use a for loop to fly east onto the first beacon switch.",
    objectives: [objective("Fly onto the beacon switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m1PythonComments),
    javaStarter: javaPartial(m1JavaComments),
    layout: eastLane1,
    seedPool: [3101, 3102],
    checks: [
      check("hit-switch", "Switch the beacon switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the beacon switch", "ship.x", 4),
    ],
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "loop",
    hints: [
      "A counted loop runs its block 4 times. Put one move() inside it.",
      "Write a counted loop of 4 and indent move() under it. The switch sits 4 cells east.",
      "Loop move() four times with a counted for loop of 4, then press Run.",
    ],
    rosetta: rosetta(
      ["for i in range(3):", "    move()"],
      ["for (int i = 0; i < 3; i++) {", "    move();", "}"],
      "A for loop runs its block once for each count, then stops on its own.",
    ),
  },
  {
    slug: "p3-m2",
    planet: "lumina",
    position: 2,
    conceptId: "loop_counter",
    planetConceptId: "loop",
    tier: "core",
    title: "Count the Beacon Steps",
    story:
      "The second beacon tower counts its own lighting steps, one glow for each cell crossed. Count each step aloud as you fly, Cadet.",
    briefing: "Fly east to the beacon switch with a for loop, logging the loop counter on every step.",
    objectives: [objective("Fly onto the beacon switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m2PythonComments),
    javaStarter: javaPartial(m2JavaComments),
    layout: eastLane2,
    seedPool: [3201, 3202, 3203],
    checks: [
      check("hit-switch", "Switch the beacon switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the beacon switch", "ship.x", 5),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "loop",
    hints: [
      "The counter changes each run through the loop: first 0, then 1, then 2.",
      "Name the counter step. Inside the loop, call move() then log(step).",
      "Loop a count of 5. In the block, call move() and log the counter, five steps in all.",
    ],
    rosetta: rosetta(
      ["for step in range(3):", "    log(step)", "    move()"],
      ["for (int step = 0; step < 3; step++) {", "    log(step);", "    move();", "}"],
      "The counter is a value the loop hands you each round: read it like any variable.",
    ),
  },
  {
    slug: "p3-m3",
    planet: "lumina",
    position: 3,
    conceptId: "while_loop",
    planetConceptId: "loop",
    tier: "core",
    title: "Fly Until the Dark Tower",
    story:
      "No count marks the way to the third tower, only the grey dead tower looming past its switch. Fly until the way runs out, Cadet.",
    briefing: "Use a while loop on what the Ship senses to fly east onto the beacon switch.",
    objectives: [objective("Fly onto the beacon switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m3PythonComments),
    javaStarter: javaPartial(m3JavaComments),
    layout: darkTowerLane,
    seedPool: [3301, 3302, 3303],
    checks: [
      check("hit-switch", "Switch the beacon switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the beacon switch", "ship.x", 5),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "loop",
    hints: [
      "while asks its question before every round. When the answer turns no, the loop stops.",
      "Test whether any clear cells are ahead. Call move() inside the loop, and let the grey tower end it.",
      "Write a while loop that moves while clear cells are ahead, then press Run.",
    ],
    rosetta: rosetta(
      ["while distance_ahead() > 0:", "    move()"],
      ["while (distanceAhead() > 0) {", "    move();", "}"],
      "A while loop has no set count: its sensor answer decides when to stop.",
    ),
  },
  {
    slug: "p3-m4",
    planet: "lumina",
    position: 4,
    conceptId: "nested_loop",
    planetConceptId: "loop",
    tier: "core",
    title: "Relight the Beacon Rows",
    story:
      "Two beacon rows climb the Trina ridge, two lights to a row, each row turning a corner. Trace both rows with one loop inside another, Cadet.",
    briefing: "Use a loop inside a loop to climb both beacon rows onto the ridge switch.",
    objectives: [
      objective("Fly onto the ridge switch.", "hit-switch", "reach-switch-x", "reach-switch-z"),
    ],
    pythonStarter: pythonStarter(m4PythonComments),
    javaStarter: javaPartial(m4JavaComments),
    layout: ridge,
    seedPool: [3401, 3402, 3403],
    checks: [
      check("hit-switch", "Switch the ridge switch on", "entities.switch-1.on", true),
      check("reach-switch-x", "Reach the ridge switch row", "ship.x", 2),
      check("reach-switch-z", "Reach the ridge switch", "ship.z", 2),
    ],
    par: { maxSteps: 11, maxEnergy: 11 },
    star3Concept: "loop",
    hints: [
      "The inner loop finishes all its rounds before the outer loop counts again.",
      "Inner loop: move() twice. After it, one turn left. Wrap both in an outer loop of 2.",
      "Loop row for a count of 2; inside it, loop cell for a count of 2 with move(), then turn left.",
    ],
    rosetta: rosetta(
      ["for row in range(2):", "    for cell in range(2):", "        move()", "    turn_left()"],
      [
        "for (int row = 0; row < 2; row++) {",
        "    for (int cell = 0; cell < 2; cell++) {",
        "        move();",
        "    }",
        "    turnLeft();",
        "}",
      ],
      "Loops nest like boxes in boxes: the inner loop empties before the outer loop moves on.",
    ),
  },
  {
    slug: "p3-m5",
    planet: "lumina",
    position: 5,
    conceptId: "loop_with_conditional",
    planetConceptId: "loop",
    tier: "stretch",
    title: "Relight the Beacon Grid",
    story:
      "The full Trina beacon grid waits past two grey dead towers, and beacon cycles flicker back to life beyond the gate. Skip the dead towers, Cadet.",
    briefing:
      "Loop along the beacon lane, turning off the blocked lane inside the loop, then fly through the beacon gate.",
    objectives: [
      objective("Raise the shield.", "shield-up"),
      objective("Open the beacon gate.", "gate-open"),
      objective("Fly through the beacon gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m5PythonComments),
    javaStarter: javaPartial(m5JavaComments),
    layout: gridLane,
    seedPool: [3501, 3502, 3503, 3504],
    checks: [
      check("shield-up", "Raise the shield", "ship.shield", true),
      check("gate-open", "Open the beacon gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the beacon gate", "ship.x", 6),
    ],
    par: { maxSteps: 14, maxEnergy: 14 },
    star3Concept: "loop",
    hints: [
      "The if lives inside the loop, so its question is asked again on every round.",
      "Shield first, while it is down and energy is high. In the loop, turn right when the count ahead is 0, else move.",
      "Raise the shield in its if. Loop 7 rounds: if blocked, turn right; else move(). Stop past the gate.",
    ],
    rosetta: rosetta(
      [
        "for cell in range(4):",
        "    if distance_ahead() == 0:",
        "        turn_right()",
        "    else:",
        "        move()",
      ],
      [
        "for (int cell = 0; cell < 4; cell++) {",
        "    if (distanceAhead() == 0) {",
        "        turnRight();",
        "    } else {",
        "        move();",
        "    }",
        "}",
      ],
      "A decision inside a loop is asked fresh each round, so one loop can steer, not just repeat.",
    ),
  },
];

export const luminaBossGate: BossGate = {
  slug: "lumina-gate",
  planet: "lumina",
  title: "Lumina Gate",
  partA: [
    {
      kind: "choice",
      prompt: "What does a for loop do?",
      options: [
        "Repeats its block a set number of times",
        "Asks one yes-no question once",
        "Stores a value under a name",
        "Flies the Ship once",
      ],
      correctIndex: 0,
      explanation: "A for loop runs its block once for each count, then stops.",
    },
    {
      kind: "spot-bug",
      prompt:
        "This code should fly east until the way runs out. Tap the bug.\n    while distance_ahead() > 0:\n        log(distance_ahead())",
      options: [
        "The block logs instead of moving, so the loop never ends",
        "Calling log() ends the loop",
        "The cells-ahead check needs a number passed into it",
      ],
      correctIndex: 0,
      explanation:
        "The guarded block must call move(); logging changes nothing, so the answer never turns no.",
    },
    {
      kind: "predict-state",
      prompt:
        "The Ship starts at x 0 facing east. Code: a counted for loop of 3 that calls move() each round. Where is the Ship?",
      options: ["x 3", "x 2", "x 0", "z 3"],
      correctIndex: 0,
      explanation: "The loop runs move() three times, so the Ship flies three cells east.",
    },
    {
      kind: "choice",
      prompt: "In a loop inside a loop over 2 rows and 3 cells, how many times does the inner block run?",
      options: ["6 times", "5 times", "3 times", "2 times"],
      correctIndex: 0,
      explanation: "The inner loop runs all 3 of its rounds for each of the 2 outer rounds: 2 × 3 = 6.",
    },
    {
      kind: "predict-state",
      prompt:
        "The Ship faces north with a grey tower one cell ahead, so the cells ahead are 0. Code: a counted for loop of 2. Each round, if the cells ahead are 0, turn right, and no other Ship call. Which way does the Ship end facing?",
      options: ["East", "North", "West", "South"],
      correctIndex: 0,
      explanation:
        "Round 1 turns the Ship east; facing east the tower is no longer ahead, so round 2 does not turn.",
    },
  ],
  partB: {
    slug: "lumina-gate-part-b",
    briefing: partBLead,
    objectives: [
      objective("Open the beacon gate.", "gate-open"),
      objective("Fly through the beacon gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(partBPythonComments),
    javaStarter: javaPartial(partBJavaComments),
    layout: partBLane,
    seedPool: [3601, 3602, 3603],
    checks: [
      check("gate-open", "Open the beacon gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the beacon gate", "ship.x", 6),
    ],
    hints: [
      "One loop does the whole row: it asks about the way ahead on every round.",
      "Inside a loop of 7, turn right when the count ahead is 0. Otherwise move east.",
      "Loop 7 rounds: if the cells ahead are 0, turn right; else move(). Stop past the gate.",
    ],
  },
};

export const luminaPack: PlanetPack = {
  planet: luminaPlanet,
  missions: luminaMissions,
  boss: luminaBossGate,
};
