// Planet 4 — Foundry. Transcribed from docs/planet-4-foundry-content-spec.md.
// One module per Planet: a content fix stays inside that Planet's data.
// Nothing here is wired into the app (ticket #85); reference solutions
// live in content/references/planet-4/ and are never imported.
//
// Bounds: the spec lists inclusive maximum coordinates; `Bounds` is a
// cell count, so maxX/maxZ add 1 and maxY is at least 1.
// Java Training Wheels are partial on every Mission and on Part B: the
// class wrapper is given, and the Cadet writes main and its closing brace
// inside the markers. No per-Mission override.

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

/** Java partial starter: class wrapper given, main sits inside the markers. */
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

export const foundryPlanet: Planet = {
  id: "planet-4",
  slug: "foundry",
  name: "Foundry",
  themeId: "foundry-forge",
  planetConceptId: "function",
  missionSlugs: ["p4-m1", "p4-m2", "p4-m3", "p4-m4", "p4-m5"],
};

const switchGate = (n: number, switchX: number, gateX: number): EntityInput[] => [
  { id: `switch-${n}`, type: "switch", x: switchX, y: 0, z: 0, linkId: `gate-${n}` },
  { id: `gate-${n}`, type: "gate", x: gateX, y: 0, z: 0, linkId: `gate-${n}` },
];

const shipStart = { x: 0, y: 0, z: 0, heading: "east", energy: 30 } as const;

const oneGateHall: AuthoredLayout = {
  shipStart: { ...shipStart },
  bounds: bounds(8, 0, 2),
  entities: [
    ...switchGate(1, 3, 4),
    { id: "asteroid-1", type: "asteroid_titanium", x: 6, y: 0, z: 0 },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const twoGateHall: AuthoredLayout = {
  shipStart: { ...shipStart },
  bounds: bounds(8, 0, 2),
  entities: [
    ...switchGate(1, 3, 4),
    ...switchGate(2, 6, 7),
    { id: "asteroid-1", type: "asteroid_titanium", x: 8, y: 0, z: 0 },
    { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2 },
  ],
};

const partBHall: AuthoredLayout = {
  shipStart: { ...shipStart },
  bounds: bounds(8, 0, 2),
  entities: [
    ...switchGate(1, 3, 4),
    ...switchGate(2, 6, 7),
    { id: "crystal-1", type: "crystal", x: 5, y: 0, z: 2 },
  ],
};

const switchThroughChecks = [
  check("switch-on", "Flip the forge switch", "entities.switch-1.on", true),
  check("through-gate", "Fly through the forge gate", "ship.x", 4),
];

const m1Comments = [
  "Define one helper routine that walks the forge lane, then call it.",
  "move() flies one cell the way the Ship faces.",
];
const m1JavaComments = [
  "Define one helper routine that walks the forge lane, then call it.",
  "Write main below. Inside it, define forge_help and call it to move east.",
];
const m2Comments = [
  "A helper takes a number and moves that many times.",
  "range(steps) counts 0 up to steps minus one.",
];
const m2JavaComments = [
  "A helper takes a number and moves that many times.",
  "Write main below. Inside it, define forge_help(steps) with a loop, then call forge_help(4).",
];
const m3Comments = [
  "A helper can hand back a number the rest of the code uses.",
  "return 4 gives the hall length to the loop that follows.",
];
const m3JavaComments = [
  "A helper can hand back a number the rest of the code uses.",
  "Write main below. Inside it, define hall_length returning 4, then loop move() that many times.",
];
const m4Comments = [
  "A name made inside a helper belongs only to that helper.",
  "Use it as the move count, then call the helper.",
];
const m4JavaComments = [
  "A name made inside a helper belongs only to that helper.",
  "Write main below. Inside it, define forge_help with a local count of 4, then call it.",
];
const m5Comments = [
  "Two helpers, one per gate, called in order to wake Melodia.",
  "move() flies one cell the way the Ship faces.",
];
const m5JavaComments = [
  "Two helpers, one per gate, called in order to wake Melodia.",
  "Write main below. Define and call two helpers to clear both gates.",
];

const gateTwoHints = [
  "One helper opens the first gate; another opens the second. Call them one after the other.",
  "Write first_leg() to reach the first gate and second_leg() to reach the second, then call both.",
  "Define two helpers, one per gate, call them in order, and press Run.",
];

export const foundryMissions: Mission[] = [
  {
    slug: "p4-m1",
    planet: "foundry",
    position: 1,
    conceptId: "function_definition",
    planetConceptId: "function",
    tier: "intro",
    title: "Define the Forge Helper",
    story:
      "The Foundry machine halls are silent. The Ship's forge helpers are offline. Define your first helper routine and call it to open the forge gate.",
    briefing:
      "Define forge_help() that moves east four times, then call it to flip the forge switch and open the gate.",
    objectives: [
      objective("Flip the forge switch.", "switch-on"),
      objective("Open the forge gate.", "gate-open"),
      objective("Fly through the forge gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m1Comments),
    javaStarter: javaPartial(m1JavaComments),
    layout: oneGateHall,
    seedPool: [4101, 4102],
    checks: [
      check("switch-on", "Flip the forge switch", "entities.switch-1.on", true),
      check("gate-open", "Open the forge gate", "entities.gate-1.open", true),
      check("through-gate", "Fly through the forge gate", "ship.x", 4),
    ],
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "function",
    hints: [
      "A helper routine does nothing until it is called. Define forge_help, then call it.",
      "Put four move() calls inside forge_help(), then write forge_help() on its own line.",
      "Define forge_help() with four move() calls, call it once, and press Run.",
    ],
    rosetta: rosetta(
      ["def forge_help():", "    move()"],
      ["void forge_help() {", "    move();", "}"],
      "A helper routine is defined once, then called whenever the Ship needs it.",
    ),
  },
  {
    slug: "p4-m2",
    planet: "foundry",
    position: 2,
    conceptId: "function_parameter",
    planetConceptId: "function",
    tier: "core",
    title: "Feed the Forge Helper",
    story:
      "The forge gate opens only for a counted run. Give your helper a number of steps, then call it to cross the hall and flip the switch.",
    briefing:
      "Define forge_help(steps) that moves east steps times, then call it with 4 to flip the forge switch and open the gate.",
    objectives: [
      objective("Flip the forge switch.", "switch-on"),
      objective("Fly through the forge gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m2Comments),
    javaStarter: javaPartial(m2JavaComments),
    layout: oneGateHall,
    seedPool: [4201, 4202, 4203],
    checks: switchThroughChecks,
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "function",
    hints: [
      "The helper takes a number; that number is how many times it moves.",
      "Loop steps times inside forge_help(steps), moving once each round, then call forge_help(4).",
      "Define forge_help(steps) with a counted for loop of steps calls to move(), then call forge_help(4).",
    ],
    rosetta: rosetta(
      ["def forge_help(steps):", "    for i in range(steps):", "        move()"],
      [
        "void forge_help(int steps) {",
        "    for (int i = 0; i < steps; i++) {",
        "        move();",
        "    }",
        "}",
      ],
      "A parameter lets one helper run different distances.",
    ),
  },
  {
    slug: "p4-m3",
    planet: "foundry",
    position: 3,
    conceptId: "function_return",
    planetConceptId: "function",
    tier: "core",
    title: "Return the Forge Reading",
    story:
      "The forge sensor measured the hall length. Have your helper report it back, then fly that many cells east to the forge gate.",
    briefing:
      "Define hall_length() that returns 4, then fly that many cells east to flip the forge switch and open the gate.",
    objectives: [
      objective("Flip the forge switch.", "switch-on"),
      objective("Fly through the forge gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m3Comments),
    javaStarter: javaPartial(m3JavaComments),
    layout: oneGateHall,
    seedPool: [4301, 4302, 4303],
    checks: switchThroughChecks,
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "function",
    hints: [
      "A helper can hand back a number. Let hall_length() return the hall length.",
      "Make hall_length() return 4, then loop move() that many times using the return value.",
      "Return 4 from hall_length(), then call move() inside a loop driven by hall_length().",
    ],
    rosetta: rosetta(
      ["def hall_length():", "    return 4"],
      ["int hall_length() {", "    return 4;", "}"],
      "A helper routine can hand back a result the rest of the code uses.",
    ),
  },
  {
    slug: "p4-m4",
    planet: "foundry",
    position: 4,
    conceptId: "local_variable",
    planetConceptId: "function",
    tier: "core",
    title: "Keep the Forge Count Local",
    story:
      "The forge count lives only inside the helper. Keep it local, then run the helper to cross the hall.",
    briefing:
      "Define forge_help() that keeps a local count of 4 and moves that many cells east, then call it.",
    objectives: [
      objective("Flip the forge switch.", "switch-on"),
      objective("Fly through the forge gate.", "through-gate"),
    ],
    pythonStarter: pythonStarter(m4Comments),
    javaStarter: javaPartial(m4JavaComments),
    layout: oneGateHall,
    seedPool: [4401, 4402, 4403],
    checks: switchThroughChecks,
    par: { maxSteps: 8, maxEnergy: 8 },
    star3Concept: "function",
    hints: [
      "A name made inside a helper belongs only to that helper. Use it as the move count.",
      "Inside forge_help(), set a local count to 4, then loop move() that many times.",
      "Give forge_help() a local count = 4, loop move() over it, then call the helper.",
    ],
    rosetta: rosetta(
      ["def forge_help():", "    count = 4", "    for i in range(count):", "        move()"],
      [
        "void forge_help() {",
        "    int count = 4;",
        "    for (int i = 0; i < count; i++) {",
        "        move();",
        "    }",
        "}",
      ],
      "A name kept inside a helper is its own local memory.",
    ),
  },
  {
    slug: "p4-m5",
    planet: "foundry",
    position: 5,
    conceptId: "function_composition",
    planetConceptId: "function",
    tier: "stretch",
    title: "Wake Melodia",
    story:
      "Static still muffles the Foundry. Combine the helper routines to clear the hall and wake Melodia, the Ship helper voice, silent before Foundry.",
    briefing:
      "Define first_leg() and second_leg(), then call them in order to open both forge gates and wake Melodia.",
    objectives: [
      objective("Open the first forge gate.", "gate-one-open"),
      objective("Open the second forge gate.", "gate-two-open"),
      objective("Wake Melodia at the far gate.", "melodia-wake"),
    ],
    pythonStarter: pythonStarter(m5Comments),
    javaStarter: javaPartial(m5JavaComments),
    layout: twoGateHall,
    seedPool: [4501, 4502, 4503, 4504],
    checks: [
      check("gate-one-open", "Open the first forge gate", "entities.gate-1.open", true),
      check("gate-two-open", "Open the second forge gate", "entities.gate-2.open", true),
      check("melodia-wake", "Wake Melodia at the far gate", "ship.x", 7),
    ],
    par: { maxSteps: 13, maxEnergy: 13 },
    star3Concept: "function",
    hints: gateTwoHints,
    rosetta: rosetta(
      [
        "def first_leg():",
        "    move()",
        "    move()",
        "",
        "def second_leg():",
        "    move()",
      ],
      [
        "void first_leg() {",
        "    move();",
        "    move();",
        "}",
        "",
        "void second_leg() {",
        "    move();",
        "}",
      ],
      "Two helpers side by side, each flying one part of the route.",
    ),
  },
];

export const foundryBossGate: BossGate = {
  slug: "foundry-gate",
  planet: "foundry",
  title: "Foundry Gate",
  partA: [
    {
      kind: "choice",
      prompt: "A Cadet-written helper routine runs only when it is:",
      options: ["defined", "called at least once", "saved", "seeded"],
      correctIndex: 1,
      explanation:
        "Defining a helper does not move the Ship; Star 3 requires a defined function that actually executes.",
    },
    {
      kind: "spot-bug",
      prompt:
        "This helper is defined but the Ship stays still: a helper named forge_help whose body calls move() once. What is missing?",
      options: ["a call to forge_help()", "more moves", "a crystal", "a seed"],
      correctIndex: 0,
      explanation:
        "A defined-but-never-called helper never executes, so it cannot pass Star 3 or open the gate.",
    },
    {
      kind: "predict-state",
      prompt:
        "Starting at x 0 facing east, a helper named patrol calls move() twice. The code calls patrol() twice. What is ship.x?",
      options: ["2", "4", "6", "8"],
      correctIndex: 1,
      explanation: "Two calls of two moves each move the Ship four cells east.",
    },
    {
      kind: "choice",
      prompt: "A for loop's body runs once per:",
      options: ["second", "each count", "Ship cell", "Seed"],
      correctIndex: 1,
      explanation: "A counted for loop runs its body once per count.",
    },
    {
      kind: "spot-bug",
      prompt:
        "A helper sets a variable named count to 4 inside itself, then code outside reads count. Why does that fail?",
      options: [
        "count is local to the helper",
        "count needs a seed",
        "count is too large",
        "count needs a gate",
      ],
      correctIndex: 0,
      explanation:
        "A local variable lives only inside its helper; code outside cannot read it.",
    },
  ],
  partB: {
    slug: "foundry-gate-part-b",
    briefing:
      "Define first_leg() and second_leg(), then call them in order to open both forge gates and wake Melodia.",
    objectives: [
      objective("Open the first forge gate.", "gate-one-open"),
      objective("Open the second forge gate.", "gate-two-open"),
      objective("Clear both forge gates.", "through-both"),
    ],
    pythonStarter: pythonStarter(m5Comments),
    javaStarter: javaPartial(m5JavaComments),
    layout: partBHall,
    seedPool: [4601, 4602, 4603],
    checks: [
      check("gate-one-open", "Open the first forge gate", "entities.gate-1.open", true),
      check("gate-two-open", "Open the second forge gate", "entities.gate-2.open", true),
      check("through-both", "Clear both forge gates", "ship.x", 7),
    ],
    hints: gateTwoHints,
  },
};

export const foundryPack: PlanetPack = {
  planet: foundryPlanet,
  missions: foundryMissions,
  boss: foundryBossGate,
};
