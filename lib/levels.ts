// Level content data and types (ADR-0007 pure core: no framework imports).
// Transcribed from the approved content pack, docs/javaquest-level-pack.md.
// Reference solutions stay in the pack only; they never ship to learners.

/** The one new Java concept each level presents, in FR-004 order. */
export const CONCEPT_ORDER = [
  "print",
  "variables",
  "branch",
  "loop",
  "method",
  "class",
  "array",
  "combined loops",
  "debug repair",
  "combined quest",
] as const;

export type Concept = (typeof CONCEPT_ORDER)[number];

/** Required code text proving the level concept was used (case-sensitive). */
export interface ConceptToken {
  text: string;
  /** How many times the text must appear (level 8 needs its token in both loops). */
  minCount: number;
}

export interface Level {
  id: number;
  planet: string;
  title: string;
  concept: Concept;
  story: string;
  objective: string;
  starterCode: string;
  /** Fixed expected program output, exact match after trim. */
  expectedOutput: string;
  conceptTokens: readonly ConceptToken[];
  hint: string;
  points: number;
  /** Badge awarded on first pass, where the pack names one. */
  badge?: string;
}

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    planet: "Volta",
    title: "Wake Bolt",
    concept: "print",
    story:
      "Bolt sleeps on the launch pad after a long silent night. Cadet, print the wake words so Bolt opens his eyes.",
    objective: "Use print to show the wake words on screen.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}`,
    expectedOutput: "Bolt is awake!",
    conceptTokens: [{ text: "System.out.println(", minCount: 1 }],
    hint: "Printing shows words held inside quotes and round brackets.",
    points: 100,
    badge: "First Print",
  },
  {
    id: 2,
    planet: "Zorba",
    title: "Chart Zorba",
    concept: "variables",
    story:
      "Planet Zorba waits beyond the dust belt with two bright moons. Store Zorba in planet and two in moons, Cadet.",
    objective: "Use variables to remember each Zorba fact.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
        System.out.println(moons);
    }
}`,
    expectedOutput: "Zorba\n2",
    conceptTokens: [{ text: "String planet", minCount: 1 }],
    hint: "Text values wear quotes, but counting numbers never do.",
    points: 100,
  },
  {
    id: 3,
    planet: "Cometa",
    title: "Comet Gate",
    concept: "branch",
    story:
      "A comet gate blocks the lane ahead of Bolt. Storm true means danger, so Bolt must warn Cadet.",
    objective: "Use a branch to warn Cadet only during storms.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        boolean storm = true;
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}`,
    expectedOutput: "Hold on, Cadet!",
    conceptTokens: [{ text: "if (", minCount: 1 }],
    hint: "A branch checks one question inside round brackets before acting.",
    points: 100,
  },
  {
    id: 4,
    planet: "Trina",
    title: "Signal Stars",
    concept: "loop",
    story:
      "Three signal stars blink above the quiet Zorba station. Cadet must greet each star once, in rising number order.",
    objective: "Use a loop to print numbers one to three.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}`,
    expectedOutput: "1\n2\n3",
    conceptTokens: [{ text: "for (", minCount: 1 }],
    hint: "A loop repeats its middle lines while its counter climbs.",
    points: 100,
  },
  {
    id: 5,
    planet: "Melodia",
    title: "Launch Song",
    concept: "method",
    story:
      "Bolt hums before every launch, but humming twice repeats code. Teach Bolt one reusable song for both launch calls.",
    objective: "Use a method to sing Bolt launch song twice.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // CALLS BELOW

        // CALLS ABOVE
    }

    // METHOD BELOW

    // METHOD ABOVE
}`,
    expectedOutput: "Zoom zoom, Bolt!\nZoom zoom, Bolt!",
    conceptTokens: [{ text: "static void sing(", minCount: 1 }],
    hint: "Write once inside the method, then call its name twice.",
    points: 100,
  },
  {
    id: 6,
    planet: "Foundry",
    title: "Helper Bot",
    concept: "class",
    story:
      "Mission control needs one helper bot beside brave Bolt. Helper bot Pip carries three spare power cells.",
    objective: "Use a class to build helper bot Pip.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
        System.out.println(pip.cells);
    }

    // CLASS BELOW

    // CLASS ABOVE
}`,
    expectedOutput: "Pip\n3",
    conceptTokens: [{ text: "class Robot", minCount: 1 }],
    hint: "A class draws the bot plan before main builds one.",
    points: 100,
  },
  {
    id: 7,
    planet: "Astral",
    title: "Star Basket",
    concept: "array",
    story:
      "Four loose stars drift near the station supply route. Names Vega, Lyra, Altair, and Deneb need one basket.",
    objective: "Use an array to hold four star names.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}`,
    expectedOutput: "Vega\nLyra\nAltair\nDeneb",
    conceptTokens: [{ text: "String[] stars", minCount: 1 }],
    hint: "Square brackets hold many values under one basket name.",
    points: 100,
  },
  {
    id: 8,
    planet: "Lumina",
    title: "Window Lights",
    concept: "combined loops",
    story:
      "Station windows form three rows with three lights each. Bolt wants every window light counted without nine commands.",
    objective: "Use combined loops to count nine window lights.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW

        // YOUR CODE ABOVE
    }
}`,
    expectedOutput: "9",
    conceptTokens: [{ text: "for (", minCount: 2 }],
    hint: "One loop walks rows while its inner loop walks columns.",
    points: 100,
    badge: "Loop Master",
  },
  {
    id: 9,
    planet: "Static",
    title: "Broken Signal",
    concept: "debug repair",
    story:
      "A broken signal hides the rescue word from Bolt. Three faults wait inside code Cadet already knows well.",
    objective: "Use debug repair to fix three signal faults.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        String word = "Rescue"
        int beeps = "three";
        System.out.println(wurd);
        System.out.println(beeps);
    }
}`,
    expectedOutput: "Rescue\n3",
    conceptTokens: [{ text: "System.out.println(word);", minCount: 1 }],
    hint: "Read each fault line slowly, then match types and names.",
    points: 100,
    badge: "Bug Hunter",
  },
  {
    id: 10,
    planet: "Haven Station",
    title: "Rescue Signal",
    concept: "combined quest",
    story:
      "The lost station drifts silent beyond the final planet. Bolt and Cadet must wake every system before rescue.",
    objective: "Combine earlier skills to send the station rescue signal.",
    starterCode: `public class Main {
    public static void main(String[] args) {
        // CALL BELOW

        // CALL ABOVE
    }

    // METHOD BELOW

    // METHOD ABOVE
}`,
    expectedOutput: "Rescue\nRescue\nRescue\nStation awake!",
    conceptTokens: [
      { text: "for (", minCount: 1 },
      { text: "static void report(", minCount: 1 },
    ],
    hint: "Call your method once, then let its loop repeat signal.",
    points: 200,
  },
];

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}

/**
 * Build-time validation of level content (FR-004, DR-002).
 * Returns one message per fault; an empty list means the content is valid.
 */
export function validateLevels(levels: readonly Level[]): string[] {
  const errors: string[] = [];

  if (levels.length !== CONCEPT_ORDER.length) {
    errors.push(
      `expected ${CONCEPT_ORDER.length} levels (one per concept), got ${levels.length}`,
    );
  }

  levels.forEach((level, index) => {
    const where = `level at index ${index}`;

    if (level.id !== index + 1) {
      errors.push(`${where}: id must be ${index + 1}, got ${level.id}`);
    }

    const expectedConcept = CONCEPT_ORDER[index];
    if (expectedConcept !== undefined && level.concept !== expectedConcept) {
      errors.push(
        `${where}: concept must be "${expectedConcept}" (FR-004 order, one new concept per level), got "${level.concept}"`,
      );
    }

    if (!Number.isInteger(level.points) || level.points < 10 || level.points > 500) {
      errors.push(
        `${where}: points must be an integer from 10 to 500 (DR-002), got ${level.points}`,
      );
    }

    if (level.conceptTokens.length === 0) {
      errors.push(`${where}: at least one concept token is required`);
    }
    for (const token of level.conceptTokens) {
      if (token.text.length === 0) {
        errors.push(`${where}: concept token text must not be empty`);
      }
      if (!Number.isInteger(token.minCount) || token.minCount < 1) {
        errors.push(`${where}: concept token minCount must be an integer >= 1`);
      }
    }

    for (const field of ["planet", "title", "story", "objective", "starterCode", "expectedOutput", "hint"] as const) {
      if (level[field].length === 0) {
        errors.push(`${where}: ${field} must not be empty`);
      }
    }
  });

  return errors;
}

// Build-time gate: invalid shipped content fails any import of this module.
const shippedErrors = validateLevels(LEVELS);
if (shippedErrors.length > 0) {
  throw new Error(`Invalid level content:\n${shippedErrors.join("\n")}`);
}
