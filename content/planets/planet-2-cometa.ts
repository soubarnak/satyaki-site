// Planet 2 — Cometa. Transcribed from docs/planet-2-cometa-content-spec.md.
// One module per Planet: a content fix stays inside that Planet's data.
// Nothing here is wired into the app (ticket #83); reference solutions
// live in content/references/planet-2/ and are never imported.
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

export const cometaPlanet: Planet = {
  id: "planet-2",
  slug: "cometa",
  name: "Cometa",
  themeId: "cometa-stormgate",
  planetConceptId: "conditional",
  missionSlugs: ["p2-m1", "p2-m2", "p2-m3", "p2-m4", "p2-m5"],
};

const stormSwitch: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(7, 0, 2),
  entities: [
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const shieldLane: AuthoredLayout = {
  shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
  bounds: bounds(7, 0, 2),
  entities: [
    { id: "switch-1", type: "switch", x: 4, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const spireLane: AuthoredLayout = {
  shipStart: { x: 1, y: 0, z: 0, heading: "north", energy: 24 },
  bounds: bounds(6, 0, 2),
  entities: [
    { id: "asteroid-1", type: "asteroid_titanium", x: 1, y: 0, z: 1 },
    { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
    { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
    { id: "crystal-1", type: "crystal", x: 3, y: 0, z: 2 },
  ],
};

function stormLane(crystalX: number): AuthoredLayout {
  return {
    shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 30 },
    bounds: bounds(8, 0, 2),
    entities: [
      { id: "asteroid-1", type: "asteroid_titanium", x: 0, y: 0, z: 1 },
      { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
      { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
      { id: "asteroid-2", type: "asteroid_titanium", x: 7, y: 0, z: 0 },
      { id: "crystal-1", type: "crystal", x: crystalX, y: 0, z: 2 },
    ],
  };
}

const m1Python = [
  "A comparison asks a yes-no question, like distance_ahead() > 3.",
  "Store its True or False answer, log it, then fly east. move() flies one cell.",
];
const m1Java = [
  "A comparison asks a yes-no question, like distanceAhead() > 3.",
  "Store its true or false answer, log it, then fly east. move() flies one cell.",
];
const m2Python = [
  "if runs its block only when the answer is True. is_shield_on() asks about the shield.",
  "If the shield is down, call shield(). Then fly east onto the switch.",
];
const m2Java = [
  "if runs its block only when the answer is true. isShieldOn() asks about the shield.",
  "If the shield is down, call shield(). Then fly east onto the switch.",
];
const m3Python = [
  "distance_ahead() counts clear cells ahead: 0 means blocked. else runs when the if answer is False.",
  "If the way north is blocked, turn right to face east. Else fly north.",
  "Then fly east onto the switch.",
];
const m3Java = [
  "distanceAhead() counts clear cells ahead: 0 means blocked. else runs when the if answer is false.",
  "If the way north is blocked, turn right to face east. Else fly north.",
  "Then fly east onto the switch.",
];
const m4Python = [
  "elif means else-if: the chain tests each answer in order and runs the first True block.",
  "The count ahead could be far, blocked, or short. Turn right when it is blocked.",
  "Then fly east onto the switch.",
];
const m4Java = [
  "else if means else-if: the chain tests each answer in order and runs the first true block.",
  "The count ahead could be far, blocked, or short. Turn right when it is blocked.",
  "Then fly east onto the switch.",
];
const m5Python = [
  "and needs both answers True. or needs at least one True. not flips an answer.",
  "If the shield is down and energy is high, raise it. If the lane ahead is blocked, turn east.",
  "Then fly east: switch, gate, stop.",
];
const m5Java = [
  "&& needs both answers true. || needs at least one true. ! flips an answer.",
  "If the shield is down and energy is high, raise it. If the lane ahead is blocked, turn east.",
  "Then fly east: switch, gate, stop.",
];
const partBLead = "Raise the shield if it is down, turn onto the safe lane, then fly east through the storm gate.";
const partBPython = [partBLead, m5Python[1], m5Python[2]];
const partBJava = [partBLead, m5Java[1], m5Java[2]];

export const cometaMissions: Mission[] = [
  {
    slug: "p2-m1",
    planet: "cometa",
    position: 1,
    conceptId: "comparison",
    planetConceptId: "conditional",
    tier: "intro",
    title: "Reach the Storm Gate",
    story:
      "Ice storms lash Cometa, and the shield gate ahead hangs dark and still. The Ship rolls in with shields down. Reach the storm gate, Cadet.",
    briefing: "Compare what the Ship senses, log the answer, then fly east to the storm switch.",
    objectives: [objective("Fly onto the storm switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m1Python),
    javaStarter: javaFullScaffold(m1Java),
    layout: stormSwitch,
    seedPool: [2101, 2102],
    checks: [
      check("hit-switch", "Switch the storm switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the storm switch", "ship.x", 5),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "conditional",
    hints: [
      "> asks if the left side is bigger. The answer is yes or no.",
      "Store a check that the cells ahead are more than 3, log it, then count move() calls east to the switch.",
      "Set clear to that check, log clear, then call move() five times.",
    ],
    rosetta: rosetta(
      ["if distance_ahead() > 3:", '    log("clear")'],
      ["if (distanceAhead() > 3) {", '    log("clear");', "}"],
      "A comparison answers yes or no, and if runs its block only when the answer is yes.",
    ),
  },
  {
    slug: "p2-m2",
    planet: "cometa",
    position: 2,
    conceptId: "if_statement",
    planetConceptId: "conditional",
    tier: "core",
    title: "Shields Up at the Gate",
    story:
      "Storm ice rattles the hull at the Cometa storm gate, and the shield routing still sleeps. Raise the shield before the gate lane, Cadet.",
    briefing: "If the shield is down, raise it, then fly east through the storm gate lane to the switch.",
    objectives: [
      objective("Raise the shield.", "shield-up"),
      objective("Fly onto the storm switch.", "hit-switch", "reach-switch"),
    ],
    pythonStarter: pythonStarter(m2Python),
    javaStarter: javaFullScaffold(m2Java),
    layout: shieldLane,
    seedPool: [2201, 2202, 2203],
    checks: [
      check("shield-up", "Raise the shield", "ship.shield", true),
      check("hit-switch", "Switch the storm switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the storm switch", "ship.x", 4),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "conditional",
    hints: [
      "if runs the block under it only when its check says yes. Use it while the shield is down.",
      "Inside the if block, call shield() once. Then fly 4 cells east onto the switch.",
      "Write the if check, call shield() inside it, then call move() four times.",
    ],
    rosetta: rosetta(
      ["if is_shield_on() == False:", "    shield()"],
      ["if (isShieldOn() == false) {", "    shield();", "}"],
      "An if block runs only when its check says yes.",
    ),
  },
  {
    slug: "p2-m3",
    planet: "cometa",
    position: 3,
    conceptId: "if_else",
    planetConceptId: "conditional",
    tier: "core",
    title: "Pick the Clear Lane",
    story:
      "A grey ice spire blocks the north lane over Cometa, but the east lane runs clear toward the beacon switch. Pick the clear lane, Cadet.",
    briefing: "If the way north is blocked, turn east instead, then fly to the beacon switch.",
    objectives: [objective("Fly onto the beacon switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m3Python),
    javaStarter: javaFullScaffold(m3Java),
    layout: spireLane,
    seedPool: [2301, 2302, 2303],
    checks: [
      check("hit-switch", "Switch the beacon switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the beacon switch", "ship.x", 5),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "conditional",
    hints: [
      "if picks the first block, else picks the other. One of them always runs.",
      "Test whether the cells ahead are 0. Turn right in the if block, then fly east.",
      "If the cells ahead are 0, turn right; else call move(). Then call move() four times.",
    ],
    rosetta: rosetta(
      ["if distance_ahead() == 0:", "    turn_right()", "else:", "    move()"],
      ["if (distanceAhead() == 0) {", "    turnRight();", "} else {", "    move();", "}"],
      "if / else picks one path. The answer chooses which.",
    ),
  },
  {
    slug: "p2-m4",
    planet: "cometa",
    position: 4,
    conceptId: "else_if_chain",
    planetConceptId: "conditional",
    tier: "core",
    title: "Three Ways Through the Storm",
    story:
      "Three lanes cross the Cometa storm front: one for crystals, one past grey ice, one clear. The grey ice lane is yours today. Read the lane, Cadet.",
    briefing:
      "Read the cell ahead and let an if / else-if / else chain pick the Ship's first action, then fly to the relay switch.",
    objectives: [objective("Fly onto the relay switch.", "hit-switch", "reach-switch")],
    pythonStarter: pythonStarter(m4Python),
    javaStarter: javaFullScaffold(m4Java),
    layout: spireLane,
    seedPool: [2401, 2402, 2403],
    checks: [
      check("hit-switch", "Switch the relay switch on", "entities.switch-1.on", true),
      check("reach-switch", "Reach the relay switch", "ship.x", 5),
    ],
    par: { maxSteps: 10, maxEnergy: 10 },
    star3Concept: "conditional",
    hints: [
      "A chain tests in order: first if, then each else-if, and else only if none matched.",
      "Put the far test first, the blocked test second with else-if, and move() in else. Then fly east.",
      "If the count is over 3, call move(); else if it is 0, turn right; else call move(). Then call move() four times.",
    ],
    rosetta: rosetta(
      [
        "if distance_ahead() > 3:",
        "    move()",
        "elif distance_ahead() == 0:",
        "    turn_right()",
        "else:",
        "    move()",
      ],
      [
        "if (distanceAhead() > 3) {",
        "    move();",
        "} else if (distanceAhead() == 0) {",
        "    turnRight();",
        "} else {",
        "    move();",
        "}",
      ],
      "An else-if chain tries each check in order. The first yes runs, and the rest are skipped.",
    ),
  },
  {
    slug: "p2-m5",
    planet: "cometa",
    position: 5,
    conceptId: "boolean_decision",
    planetConceptId: "conditional",
    tier: "stretch",
    title: "The Final Safe Lane",
    story:
      "The last storm lane twists past grey ice, and shield routing flickers back to life beyond the gate. Pick the safe lane and restore it, Cadet.",
    briefing: "Combine two checks to raise the shield, turn onto the safe lane, then fly through the storm gate.",
    objectives: [
      objective("Raise the shield.", "shield-up"),
      objective("Open the storm gate.", "gate-open"),
      objective("Fly through the storm gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m5Python),
    javaStarter: javaFullScaffold(m5Java),
    layout: stormLane(3),
    seedPool: [2501, 2502, 2503, 2504],
    checks: [
      check("shield-up", "Raise the shield", "ship.shield", true),
      check("gate-open", "Open the storm gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the storm gate", "ship.x", 6),
    ],
    par: { maxSteps: 14, maxEnergy: 14 },
    star3Concept: "conditional",
    hints: [
      "You can join two checks so both must be yes. The block runs only then.",
      "Raise the shield only when it is down and energy is over 10. Turn east when the count ahead is 0.",
      "Join the shield checks so both must be yes. Join the lane checks so either one is enough. Then call move() six times.",
    ],
    rosetta: rosetta(
      [
        "if is_shield_on() == False and energy() > 10:",
        "    shield()",
        "if distance_ahead() == 0:",
        "    turn_right()",
      ],
      [
        "if (isShieldOn() == false && energy() > 10) {",
        "    shield();",
        "}",
        "if (distanceAhead() == 0) {",
        "    turnRight();",
        "}",
      ],
      "Python and, or, and not match Java &&, ||, and !: stricter, looser, and flip.",
    ),
  },
];

export const cometaBossGate: BossGate = {
  slug: "cometa-gate",
  planet: "cometa",
  title: "Cometa Gate",
  partA: [
    {
      kind: "choice",
      prompt: "What does a comparison like energy() > 10 give?",
      options: ["Yes or no", "A number of cells", "A Ship action", "A crystal"],
      correctIndex: 0,
      explanation: "A comparison answers a yes-no question.",
    },
    {
      kind: "spot-bug",
      prompt:
        "This code should raise the shield only when it is down. Tap the bug.\n    if the shield is down:\n        move()",
      options: [
        "The block flies instead of raising the shield",
        "if needs a number here",
        "The shield check needs quotes",
      ],
      correctIndex: 0,
      explanation: "The guarded block must call shield(); this one calls move().",
    },
    {
      kind: "predict-state",
      prompt:
        "The Ship faces north with a grey asteroid one cell ahead, so the cells ahead are 0. Code: if the cells ahead are 0, turn right, then move(). Which way does the Ship end facing?",
      options: ["East", "North", "West", "South"],
      correctIndex: 0,
      explanation: "The count is 0, so the block runs and turns the Ship east before it moves.",
    },
    {
      kind: "choice",
      prompt: "In an if / else-if / else chain, how many blocks run?",
      options: ["Exactly one: the first yes, or else", "Every True one", "Only the else", "None"],
      correctIndex: 0,
      explanation: "The chain stops at the first yes; later blocks are skipped.",
    },
    {
      kind: "predict-state",
      prompt:
        "Shield is down and energy() is 20. Code: if the shield is down and energy() is over 10, call shield(). Is the shield up at the end?",
      options: ["Yes", "No", "Only on hidden layouts"],
      correctIndex: 0,
      explanation: "Both checks are yes, so the block raises the shield.",
    },
  ],
  partB: {
    slug: "cometa-gate-part-b",
    briefing: partBLead,
    objectives: [
      objective("Raise the shield.", "shield-up"),
      objective("Open the storm gate.", "gate-open"),
      objective("Fly through the storm gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(partBPython),
    javaStarter: javaFullScaffold(partBJava),
    layout: stormLane(2),
    seedPool: [2601, 2602, 2603],
    checks: [
      check("shield-up", "Raise the shield", "ship.shield", true),
      check("gate-open", "Open the storm gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the storm gate", "ship.x", 6),
    ],
    hints: [
      "Two decisions guard this route: one for the shield, one for the blocked lane.",
      "Raise the shield while it is down, turn east when the count ahead is 0, then count 6 moves.",
      "Shield inside its if, turn inside its if, then call move() six times and stop.",
    ],
  },
};

export const cometaPack: PlanetPack = {
  planet: cometaPlanet,
  missions: cometaMissions,
  boss: cometaBossGate,
};
