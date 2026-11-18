// Sample Planet fixture for the content-schema build tests (issue #60).
// Planet 1 (Volta) shape follows docs/planet-1-volta-content-spec.md:
// p1-m1 transcribes the spec; p1-m2..m5 are compact valid samples with
// the spec's conceptIds, tiers, and seed pools. Reference solutions live
// in THIS fixture file only so they never ship with app content;
// the grader ticket executes them per Seed (ADR-0011).

import type { BossGate, Mission, Planet } from "@/lib/content";

export const samplePlanet: Planet = {
  id: "planet-1",
  slug: "volta",
  name: "Volta",
  themeId: "volta-launchpad",
  planetConceptId: "variable",
  missionSlugs: ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"],
};

const rosetta = {
  python: "power = 0\npower = 3\nlog(power)",
  java: "int power = 0;\npower = 3;\nlog(power);",
  note: "A variable is a named box: put a value in, and the name reads it back.",
};

function starters(
  story: string,
  action: string,
): { pythonStarter: string; javaStarter: string } {
  return {
    pythonStarter: `# ${story}. ${action} flies one cell the way the Ship faces.\n# YOUR CODE BELOW\n\n# YOUR CODE ABOVE\n`,
    javaStarter: `public class Main {\n    public static void main(String[] args) {\n        // ${story}. ${action} flies one cell the way the Ship faces.\n        // YOUR CODE BELOW\n\n        // YOUR CODE ABOVE\n    }\n}\n`,
  };
}

export const sampleMissions: Mission[] = [
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
    objectives: [{ text: "Reach the launch pad.", checkIds: ["reach-pad", "reach-pad-lane"] }],
    ...starters("Wake the Ship", "move()"),
    trainingWheels: "full-scaffold",
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 20 },
      bounds: { maxX: 5, maxY: 1, maxZ: 2 },
      entities: [{ id: "crystal-1", type: "crystal", x: 1, y: 0, z: 1 }],
    },
    seedPool: [101, 102],
    checks: [
      { id: "reach-pad", label: "Reach the launch pad", statePath: "ship.x", comparator: "eq", expected: 3, timing: "final" },
      { id: "reach-pad-lane", label: "Stay in the launch lane", statePath: "ship.z", comparator: "eq", expected: 0, timing: "final" },
    ],
    par: { maxSteps: 7, maxEnergy: 7 },
    star3Concept: "variable",
    hints: [
      "The Ship faces east. One `move()` flies one cell east.",
      "Count the pad cells east of the Ship. Call `move()` once for each cell.",
      "Call `move()` three times, one after another, then press Run.",
    ],
    rosetta,
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
      "The power core wakes hungry. Five power cells wait down the east lane, Cadet, and the core switch sleeps at the far end.",
    briefing: "Add the two cell stacks, log the total, then fly to the core switch.",
    objectives: [{ text: "Fly onto the core switch.", checkIds: ["hit-switch"] }],
    ...starters("Count the Power Cells", "move()"),
    trainingWheels: "full-scaffold",
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
      bounds: { maxX: 7, maxY: 1, maxZ: 2 },
      entities: [
        { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
        { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
        { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 1 },
      ],
    },
    seedPool: [201, 202, 203],
    checks: [
      { id: "hit-switch", label: "Switch the core on", statePath: "entities.switch-1.on", comparator: "eq", expected: true, timing: "final" },
    ],
    par: { maxSteps: 11, maxEnergy: 11 },
    star3Concept: "variable",
    hints: [
      "Add the stacks into a variable first, then fly east.",
      "The switch sits five cells east of the Ship.",
      "Store `2 + 3` in a variable, `log()` it, then call `move()` five times.",
    ],
    rosetta,
  },
  {
    slug: "p1-m3",
    planet: "volta",
    position: 3,
    conceptId: "variable_assignment",
    planetConceptId: "variable",
    tier: "core",
    title: "Name the Beacon",
    story:
      "A beacon blinks without a name above the Volta ridge. Give it a name in a variable, Cadet, then park beneath it.",
    briefing: "Store the beacon name, then fly east to the beacon cell.",
    objectives: [{ text: "Park under the beacon.", checkIds: ["reach-beacon"] }],
    ...starters("Name the Beacon", "move()"),
    trainingWheels: "full-scaffold",
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
      bounds: { maxX: 6, maxY: 1, maxZ: 2 },
      entities: [{ id: "crystal-1", type: "crystal", x: 3, y: 0, z: 1 }],
    },
    seedPool: [301, 302, 303],
    checks: [
      { id: "reach-beacon", label: "Reach the beacon cell", statePath: "ship.x", comparator: "eq", expected: 4, timing: "final" },
    ],
    par: { maxSteps: 9, maxEnergy: 9 },
    star3Concept: "variable",
    hints: [
      "A variable holds the beacon name while you fly.",
      "The beacon cell is four cells east.",
      "Assign the name, then call `move()` four times.",
    ],
    rosetta,
  },
  {
    slug: "p1-m4",
    planet: "volta",
    position: 4,
    conceptId: "variable_update",
    planetConceptId: "variable",
    tier: "core",
    title: "Feed the Core",
    story:
      "The core drinks one cell of charge at a time. Top up the charge variable as you climb the lane, Cadet.",
    briefing: "Raise the charge, then harvest the crystal at the lane end.",
    objectives: [{ text: "Harvest the lane crystal.", checkIds: ["took-crystal"] }],
    ...starters("Feed the Core", "harvest()"),
    trainingWheels: "full-scaffold",
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 24 },
      bounds: { maxX: 5, maxY: 1, maxZ: 2 },
      entities: [{ id: "crystal-1", type: "crystal", x: 3, y: 0, z: 0 }],
    },
    seedPool: [401, 402, 403],
    checks: [
      { id: "took-crystal", label: "Collect the lane crystal", statePath: "entities.crystal-1.collected", comparator: "eq", expected: true, timing: "final" },
    ],
    par: { maxSteps: 9, maxEnergy: 9 },
    star3Concept: "variable",
    hints: [
      "Update the charge variable before each flight leg.",
      "The crystal waits three cells east.",
      "Bump the charge, fly three cells, then `harvest()` the crystal.",
    ],
    rosetta,
  },
  {
    slug: "p1-m5",
    planet: "volta",
    position: 5,
    conceptId: "sensor_variable",
    planetConceptId: "variable",
    tier: "stretch",
    title: "Read the Dials",
    story:
      "Storm static scrambles the dials on the Volta rim. Save the sensor reading in a variable, Cadet, then dock east.",
    briefing: "Store the sensor reading, then dock at the rim station.",
    objectives: [{ text: "Dock at the rim station.", checkIds: ["docked", "saved-reading"] }],
    ...starters("Read the Dials", "move()"),
    trainingWheels: "full-scaffold",
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
      bounds: { maxX: 8, maxY: 1, maxZ: 2 },
      entities: [{ id: "crystal-1", type: "crystal", x: 6, y: 0, z: 1 }],
    },
    seedPool: [501, 502, 503, 504],
    checks: [
      { id: "docked", label: "Dock at the rim station", statePath: "ship.x", comparator: "eq", expected: 6, timing: "final" },
      { id: "saved-reading", label: "Hold the reading mid-flight", statePath: "ship.energy", comparator: "lte", expected: 29, timing: "intermediate" },
    ],
    par: { maxSteps: 12, maxEnergy: 12 },
    star3Concept: "variable",
    hints: [
      "Read the sensor into a variable on step one.",
      "The dock sits six cells east of the Ship.",
      "Save the reading, fly six cells, then press Run.",
    ],
    rosetta,
  },
];

export const sampleBoss: BossGate = {
  slug: "volta-gate",
  planet: "volta",
  title: "Volta Gate",
  partA: [
    { kind: "choice", prompt: "Which line stores 3 in a variable?", options: ["power = 3", "3 = power", "power + 3", "log 3"], correctIndex: 0, explanation: "Assignment puts the value on the right into the name on the left." },
    { kind: "choice", prompt: "What does log(power) do?", options: ["Shows the value", "Deletes it", "Moves the Ship", "Renames it"], correctIndex: 0, explanation: "Log shows a value; it never moves the Ship." },
    { kind: "spot-bug", prompt: "Find the bug: `powre = 3`.", options: ["Misspelled name", "Missing log", "Wrong value", "No bug"], correctIndex: 0, explanation: "Names must match exactly; powre is not power." },
    { kind: "predict-state", prompt: "power starts 0, then power = 3. What is power?", options: ["0", "3", "30", "Unknown"], correctIndex: 1, explanation: "Assignment replaces the old value." },
    { kind: "predict-state", prompt: "After move() faces east from x 0, what is ship.x?", options: ["0", "1", "2", "Lost"], correctIndex: 1, explanation: "One move east adds one to x." },
  ],
  partB: {
    slug: "volta-gate-part-b",
    briefing: "Fly the gate lane past the storm guards and open the Volta Gate.",
    objectives: [{ text: "Open the Volta Gate.", checkIds: ["gate-open"] }],
    ...starters("Open the Volta Gate", "move()"),
    trainingWheels: "full-scaffold",
    layout: {
      shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
      bounds: { maxX: 8, maxY: 1, maxZ: 2 },
      entities: [
        { id: "switch-1", type: "switch", x: 5, y: 0, z: 0, linkId: "gate-1" },
        { id: "gate-1", type: "gate", x: 6, y: 0, z: 0, linkId: "gate-1" },
        { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 1 },
      ],
    },
    seedPool: [591, 592, 593],
    checks: [
      { id: "gate-open", label: "Open the Volta Gate", statePath: "entities.gate-1.open", comparator: "eq", expected: true, timing: "final" },
    ],
    hints: [
      "The switch opens the gate with the same link.",
      "Fly five cells east onto the switch.",
      "Move five times onto the switch, then press Run.",
    ],
  },
};

/** Reference solutions. Test-only: never imported by app code, never shipped. */
export const sampleSolutions: Record<string, { python: string; java: string }> = {
  "p1-m1": {
    python: "# Wake the Ship.\n# YOUR CODE BELOW\nmove()\nmove()\nmove()\n# YOUR CODE ABOVE\n",
    java: "public class Main {\n    public static void main(String[] args) {\n        // YOUR CODE BELOW\n        move();\n        move();\n        move();\n        // YOUR CODE ABOVE\n    }\n}\n",
  },
  "p1-m2": {
    python: "# Count the Power Cells.\n# YOUR CODE BELOW\ntotal = 2 + 3\nlog(total)\nmove()\nmove()\nmove()\nmove()\nmove()\n# YOUR CODE ABOVE\n",
    java: "public class Main {\n    public static void main(String[] args) {\n        // YOUR CODE BELOW\n        int total = 2 + 3;\n        log(total);\n        move();\n        move();\n        move();\n        move();\n        move();\n        // YOUR CODE ABOVE\n    }\n}\n",
  },
  "p1-m3": {
    python: '# Name the Beacon.\n# YOUR CODE BELOW\nbeacon = "Haven"\nlog(beacon)\nmove()\nmove()\nmove()\nmove()\n# YOUR CODE ABOVE\n',
    java: "public class Main {\n    public static void main(String[] args) {\n        // YOUR CODE BELOW\n        String beacon = \"Haven\";\n        log(beacon);\n        move();\n        move();\n        move();\n        move();\n        // YOUR CODE ABOVE\n    }\n}\n",
  },
  "p1-m4": {
    python: "# Feed the Core.\n# YOUR CODE BELOW\ncharge = 0\ncharge = charge + 1\nmove()\nmove()\nmove()\nharvest()\n# YOUR CODE ABOVE\n",
    java: "public class Main {\n    public static void main(String[] args) {\n        // YOUR CODE BELOW\n        int charge = 0;\n        charge = charge + 1;\n        move();\n        move();\n        move();\n        harvest();\n        // YOUR CODE ABOVE\n    }\n}\n",
  },
  "p1-m5": {
    python: "# Read the Dials.\n# YOUR CODE BELOW\nreading = scan_ahead()\nlog(reading)\nmove()\nmove()\nmove()\nmove()\nmove()\nmove()\n# YOUR CODE ABOVE\n",
    java: "public class Main {\n    public static void main(String[] args) {\n        // YOUR CODE BELOW\n        String reading = scanAhead();\n        log(reading);\n        move();\n        move();\n        move();\n        move();\n        move();\n        move();\n        // YOUR CODE ABOVE\n    }\n}\n",
  },
  "volta-gate-part-b": {
    python: "# Open the Volta Gate.\n# YOUR CODE BELOW\nmove()\nmove()\nmove()\nmove()\nmove()\n# YOUR CODE ABOVE\n",
    java: "public class Main {\n    public static void main(String[] args) {\n        // YOUR CODE BELOW\n        move();\n        move();\n        move();\n        move();\n        move();\n        // YOUR CODE ABOVE\n    }\n}\n",
  },
};
