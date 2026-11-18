import { describe, expect, test } from "vitest";
import {
  PLAYGROUND_TEMPLATES,
  PlaygroundBuilder,
  copyTemplateWorld,
  templateById,
  validateWorldShape,
} from "./playground";
import { translateKidError } from "./kid-errors";

// Builder seam (ADR-0014): code API with a setup phase. Every failure
// below must name the editor line through the shared kid-error translator.

function kid(err: { line: number; excType: string; message: string; call: string }): string {
  return translateKidError(err, "python");
}

test("defaults are ship start 0,0,0 east with 12x12x5 bounds and no entities", () => {
  const built = new PlaygroundBuilder().build();
  expect(built.world.shipStart).toEqual({ x: 0, y: 0, z: 0, heading: "east", energy: 50 });
  expect(built.world.bounds).toEqual({ maxX: 12, maxY: 5, maxZ: 12 });
  expect(built.world.entities).toEqual([]);
  expect(built.shipColour).toBe("blue");
});

test("builder call after the first Ship action names the line and call", () => {
  const builder = new PlaygroundBuilder();
  expect(builder.spawn_crystal(1, 0, 0, 2)).toBeNull();
  builder.noteShipAction();
  const err = builder.spawn_crystal(2, 0, 0, 3);
  expect(err?.excType).toBe("BuilderAfterStep");
  expect(kid(err!)).toContain("Line 3");
  expect(kid(err!)).toContain("spawn_crystal");
});

test("duplicate spawn cell names the line", () => {
  const builder = new PlaygroundBuilder();
  expect(builder.spawn_crystal(1, 0, 0, 2)).toBeNull();
  const err = builder.spawn_crystal(1, 0, 0, 3);
  expect(err?.excType).toBe("BuilderPlacement");
  expect(kid(err!)).toContain("Line 3");
});

test("spawn on the Ship start cell names the line", () => {
  const builder = new PlaygroundBuilder();
  const err = builder.spawn_crystal(0, 0, 0, 2);
  expect(err?.excType).toBe("BuilderPlacement");
  expect(kid(err!)).toContain("Line 2");
});

test("moving the Ship start onto an entity names the line", () => {
  const builder = new PlaygroundBuilder();
  expect(builder.spawn_crystal(1, 0, 0, 2)).toBeNull();
  const err = builder.set_ship_start(1, 0, 0, "east", 3);
  expect(err?.excType).toBe("BuilderPlacement");
  expect(kid(err!)).toContain("Line 3");
});

test("unknown colour names the line", () => {
  const builder = new PlaygroundBuilder();
  const err = builder.set_ship_colour("puce", 4);
  expect(err?.excType).toBe("UnknownColour");
  expect(kid(err!)).toContain("Line 4");
});

test("entity past the 40-cap names the line and keeps the world at 40", () => {
  const builder = new PlaygroundBuilder();
  for (let i = 0; i < 40; i += 1) {
    const x = 1 + (i % 11);
    const z = Math.floor(i / 11);
    expect(builder.spawn_crystal(x, 0, z, i + 2)).toBeNull();
  }
  const err = builder.spawn_crystal(1, 0, 4, 100);
  expect(err?.excType).toBe("BuilderLimit");
  expect(kid(err!)).toContain("Line 100");
  expect(builder.build().world.entities).toHaveLength(40);
});

test("bounds past 16x16x6 name the line", () => {
  const builder = new PlaygroundBuilder();
  const err = builder.set_bounds(17, 5, 12, 2);
  expect(err?.excType).toBe("BuilderLimit");
  expect(kid(err!)).toContain("Line 2");
});

test("portal sugar spawns two wormholes sharing one pair id", () => {
  const builder = new PlaygroundBuilder();
  expect(builder.spawn_portal(1, 0, 0, 5, 0, 5, 2)).toBeNull();
  const worms = builder.build().world.entities.filter((e) => e.type === "wormhole");
  expect(worms).toHaveLength(2);
  expect((worms[0] as unknown as Record<string, unknown>).pairId).toBe(
    (worms[1] as unknown as Record<string, unknown>).pairId,
  );
});

test("crystal ring sugar spawns eight crystals", () => {
  const builder = new PlaygroundBuilder();
  expect(builder.spawn_crystal_ring(6, 0, 6, 3, 2)).toBeNull();
  expect(builder.build().world.entities.filter((e) => e.type === "crystal")).toHaveLength(8);
});

test("bad drone axis names the line as wrong values", () => {
  const builder = new PlaygroundBuilder();
  const err = builder.spawn_drone(1, 0, 0, "sideways", 5);
  expect(err?.excType).toBe("BuilderArgs");
  expect(kid(err!)).toContain("Line 5");
});

test("camelCase aliases build the same world", () => {
  const builder = new PlaygroundBuilder();
  expect(builder.spawnCrystal(1, 0, 0, 2)).toBeNull();
  expect(builder.setShipColour("gold", 3)).toBeNull();
  expect(builder.setShipStart(0, 0, 0, "north", 4)).toBeNull();
  const built = builder.build();
  expect(built.world.entities).toHaveLength(1);
  expect(built.world.shipStart.heading).toBe("north");
  expect(built.shipColour).toBe("gold");
});

describe("starter templates", () => {
  test("six templates ship with both starters and valid worlds", () => {
    expect(PLAYGROUND_TEMPLATES).toHaveLength(6);
    const ids = new Set(PLAYGROUND_TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(6);
    for (const t of PLAYGROUND_TEMPLATES) {
      expect(t.pythonStarter.length).toBeGreaterThan(0);
      expect(t.javaStarter.length).toBeGreaterThan(0);
      expect(t.pythonStarter.length).toBeLessThanOrEqual(4000);
      expect(t.javaStarter.length).toBeLessThanOrEqual(4000);
      expect(t.pythonStarter).toContain("# YOUR CODE BELOW");
      expect(t.javaStarter).toContain("// YOUR CODE BELOW");
      expect(validateWorldShape(t.world)).toBeNull();
      expect(t.goals.length).toBeGreaterThanOrEqual(1);
    }
    expect(templateById("ring-course")?.title).toMatch(/Ring/);
    expect(templateById("nope")).toBeUndefined();
  });

  test("a template edits as a copy: mutating the copy leaves the original", () => {
    const original = templateById("empty-world")!;
    const copy = copyTemplateWorld(original);
    copy.entities.push({ id: "crystal-1", type: "crystal", x: 1, y: 0, z: 0 });
    expect(original.world.entities).toHaveLength(0);
  });
});
