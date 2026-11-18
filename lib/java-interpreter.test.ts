// Cadet Java interpreter tests (issue #64, spec §§3,5,9).
// Seam: runCadetJava / runJavaTick over the real ShipSim (no worker).
import { describe, expect, it } from "vitest";
import { runCadetJava, runJavaTick, javaParses } from "./java-interpreter";
import { DEFAULT_BOUNDS, type AuthoredLayout } from "./ship-sim";

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

describe("cadet java subset", () => {
  it("parses full-scaffold starters and rejects garbage", () => {
    expect(javaParses(mainOf("        move();"))).toBe(true);
    expect(javaParses("public class Main {")).toBe(false);
    expect(javaParses("move( ;;;")).toBe(false);
  });

  it("runs Ship steps with the Python trace shape", () => {
    const result = runCadetJava({ code: mainOf("        move();\n        move();\n        move();"), layout: layout() });
    expect(result.stopReason).toBe("none");
    expect(result.status).toBe("ok");
    expect(result.trace).toHaveLength(3);
    expect(result.trace[0].line).toBe(3);
    expect(result.trace[0].step).toBe(1);
    expect(result.trace[0].shipDelta).toMatchObject({ action: "move", blocked: false });
    expect(result.trace[0].kind).toBe("line");
    expect(result.trace[2].step).toBe(3);
    expect(result.initial.ship).toMatchObject({ x: 0, z: 0 });
  });

  it("runs variables, loops, and conditionals", () => {
    const code = mainOf(
      "        int total = 2 + 3;\n        log(total);\n        for (int i = 0; i < 3; i++) {\n            move();\n        }\n        if (distanceAhead() > 0) {\n            move();\n        }",
    );
    const result = runCadetJava({ code, layout: layout() });
    expect(result.stopReason).toBe("none");
    expect(result.trace.some((event) => event.log === "5")).toBe(true);
    const last = result.trace[result.trace.length - 1];
    expect(last.step).toBe(4);
  });

  it("stops kid errors with line-numbered frames", () => {
    const unknown = runCadetJava({ code: mainOf("        fly();"), layout: layout() });
    expect(unknown.stopReason).toBe("error");
    expect(unknown.error?.line).toBe(3);
    expect(unknown.error?.excType).toBe("UnknownName");

    const args = runCadetJava({ code: mainOf("        move(1);"), layout: layout() });
    expect(args.stopReason).toBe("error");
    expect(args.error?.excType).toBe("ArgCount");
    expect(args.error?.line).toBe(3);

    const mixup = runCadetJava({ code: mainOf("        int x = move();"), layout: layout() });
    expect(mixup.stopReason).toBe("error");
    expect(mixup.error?.excType).toBe("ActionInExpression");
  });

  it("reads ship snapshot fields and runs while loops", () => {
    const code = mainOf("        while (ship.x < 2) {\n            move();\n        }");
    const result = runCadetJava({ code, layout: layout() });
    expect(result.stopReason).toBe("none");
    expect(result.trace[result.trace.length - 1].step).toBe(2);
  });

  it("runs helper functions, switch, ternary, and enhanced for", () => {
    const code = `public class Main {
    void march(int steps) {
        for (int i = 0; i < steps; i++) {
            move();
        }
    }
    public static void main(String[] args) {
        march(2);
        String seen = scanAhead();
        // march(2) already flew to x=2, so the crystal at x=3 is ahead.
        String label = seen.equals("crystal") ? "blocked" : "clear";
        log(label);
        int[] route = {1, 1};
        for (int legs : route) {
            move();
        }
        int n = 1;
        switch (n) {
            case 1:
                log("one");
                break;
            default:
                log("other");
                break;
        }
    }
}
`;
    const result = runCadetJava({ code, layout: layout() });
    expect(result.stopReason).toBe("none");
    expect(result.trace[result.trace.length - 1].step).toBe(4);
    const logs = result.trace.filter((event) => event.log !== undefined).map((event) => event.log);
    expect(logs).toContain("blocked");
    expect(logs).toContain("one");
  });

  it("runs lists by index", () => {
    const code = mainOf(
      "        int[] route = {1, 2};\n        for (int i = 0; i < route.length; i++) {\n            log(route[i]);\n        }",
    );
    const result = runCadetJava({ code, layout: layout() });
    expect(result.stopReason).toBe("none");
    expect(result.trace.filter((event) => event.log !== undefined).map((event) => event.log)).toEqual(["1", "2"]);
  });
});

describe("cadet java arena tick", () => {
  const ship = { x: 0, y: 0, z: 0, heading: "north", energy: 50, shield: false, crystals: 0 };
  const radar = { droneDistance: 2, droneDirection: "north", wave: 1, dronesLeft: 2 };
  const tickCode = `public class Main {\n    public String onTick(Ship ship, Radar radar) {\n        if (radar.droneDistance == 0) {\n            return "shield";\n        }\n        return "move";\n    }\n}\n`;

  it("returns the tick action with normalized spelling", () => {
    const result = runJavaTick({ code: tickCode, ship, radar });
    expect(result.valid).toBe(true);
    expect(result.normalized).toBe("move");
    expect(result.error).toBeUndefined();
  });

  it("reads the radar branch", () => {
    const result = runJavaTick({ code: tickCode, ship, radar: { ...radar, droneDistance: 0 } });
    expect(result.normalized).toBe("shield");
  });
});
