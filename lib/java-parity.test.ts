// Java/Python parity and starter-shape tests (issue #64 acceptance).
// Seam: interpreter + binding over the real ShipSim; fixture starters.
import { describe, expect, it } from "vitest";
import { runCadetJava, javaParses } from "./java-interpreter";
import { checkConcept } from "./grader";
import { sampleMissions, sampleSolutions } from "../tests/fixtures/sample-planet";
import { DEFAULT_BOUNDS, SHIP_NAME_TABLE, ShipSim, type AuthoredLayout } from "./ship-sim";

function layout(): AuthoredLayout {
  return {
    shipStart: { x: 0, y: 0, z: 0, heading: "east", energy: 30 },
    bounds: { ...DEFAULT_BOUNDS },
    entities: [{ id: "crystal-1", type: "crystal", x: 3, y: 0, z: 0 }],
  };
}

function mainOf(body: string): string {
  return `public class Main {\n    public static void main(String[] args) {\n${body}\n    }\n}\n`;
}

describe("java/python ship parity", () => {
  it("maps every ADR-0012 name to the same sim result", () => {
    for (const [python, java] of Object.entries(SHIP_NAME_TABLE)) {
      const args = python === "log" ? ["hi"] : [];
      const left = new ShipSim(layout());
      const right = new ShipSim(layout());
      const a = left.call(python, args, 1);
      const b = right.call(java, args, 1);
      expect({ name: java, result: b }).toEqual({ name: java, result: a });
    }
  });

  it("reaches the same World State as direct sim calls", () => {
    const program = mainOf("        move();\n        move();\n        move();\n        harvest();");
    const result = runCadetJava({ code: program, layout: layout() });
    expect(result.stopReason).toBe("none");
    const direct = new ShipSim(layout());
    direct.call("move", [], 1);
    direct.call("move", [], 1);
    direct.call("move", [], 1);
    direct.call("harvest", [], 1);
    const { stepsUsed: _dropped, ...directShip } = direct.snapshot().ship;
    void _dropped;
    expect(result.trace[result.trace.length - 1].shipDelta?.ship).toEqual(directShip);
    expect(direct.snapshot().entities["crystal-1"]["collected"]).toBe(true);
  });
});

describe("adr-0011 starter shapes", () => {
  it("parses full-scaffold and partial starters, rejects bare-minimal as unrunnable", () => {
    const full = sampleMissions[0].javaStarter;
    expect(javaParses(full)).toBe(true);
    const partial = `public class Main {\n    // p3-m1 loop mission\n${"    // YOUR CODE BELOW"}\n${"    public static void main(String[] args) {"}\n        for (int i = 0; i < 4; i++) { move(); }\n${"    }"}\n${"    // YOUR CODE ABOVE"}\n}\n`;
    expect(javaParses(partial)).toBe(true);
    const minimal = `// Write public class Main and public static void main(String[] args).\n// YOUR CODE BELOW\n\n// YOUR CODE ABOVE\n`;
    // Comments-only is a valid empty Java unit, so it parses; with no Main it
    // runs to a NoMain learner error instead of crashing.
    expect(javaParses(minimal)).toBe(true);
    const minimalRun = runCadetJava({ code: minimal, layout: layout() });
    expect(minimalRun.stopReason).toBe("error");
    expect(minimalRun.error?.excType).toBeDefined();
  });

  it("runs every sample reference solution without error frames", () => {
    for (const mission of sampleMissions) {
      const solution = sampleSolutions[mission.slug];
      expect(solution, mission.slug).toBeDefined();
      const result = runCadetJava({ code: solution.java, layout: mission.layout });
      expect({ slug: mission.slug, stop: result.stopReason, error: result.error }).toEqual({
        slug: mission.slug,
        stop: "none",
        error: undefined,
      });
    }
  });

  it("executes Planet-concept lines the Star 3 check reads", () => {
    const code = `public class Main {
    public static void main(String[] args) {
        // YOUR CODE BELOW
        for (int i = 0; i < 3; i++) {
            move();
        }
        // YOUR CODE ABOVE
    }
}
`;
    const result = runCadetJava({ code, layout: layout() });
    expect(result.stopReason).toBe("none");
    const lines = result.trace.map((event) => event.line);
    expect(checkConcept("loop", "java", code, lines)).toBe(true);
    expect(checkConcept("loop", "java", code, [])).toBe(false);
  });

  it("caps runaway loops with a named stop", () => {
    const result = runCadetJava({ code: mainOf("        while (true) {\n            move();\n        }"), layout: layout() });
    expect(["step-cap", "event-cap"]).toContain(result.stopReason);
    expect(result.error?.line).toBeGreaterThan(0);
  });
});
