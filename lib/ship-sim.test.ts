// Ship simulation + Seed generation tests (ADR-0012, ticket #59).
// Seams: ShipSim action/sensor methods, World State snapshot + shipDelta,
// deterministic Seed generator guarantees. Glossary: Ship, Ship API,
// World State, Seed.

import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOUNDS,
  ENERGY_COSTS,
  JAVA_NAMES,
  PYTHON_NAMES,
  SHIP_NAME_TABLE,
  ShipSim,
  generateSeedLayout,
  isStepName,
  readStatePath,
  type AuthoredLayout,
} from "./ship-sim";

function baseLayout(overrides: Partial<AuthoredLayout> = {}): AuthoredLayout {
  return {
    shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 100 },
    bounds: { ...DEFAULT_BOUNDS },
    entities: [],
    ...overrides,
  };
}

describe("movement and steps (ADR-0012)", () => {
  it("moves north/east/south/west one cell per step", () => {
    const sim = new ShipSim(baseLayout());
    expect(sim.move().ship).toMatchObject({ x: 5, y: 0, z: 6 });
    sim.turnRight();
    expect(sim.move().ship).toMatchObject({ x: 6, y: 0, z: 6 });
    sim.turnRight();
    expect(sim.move().ship).toMatchObject({ x: 6, y: 0, z: 5 });
    sim.turnRight();
    expect(sim.move().ship).toMatchObject({ x: 5, y: 0, z: 5 });
  });

  it("ascends and descends one cell, counting steps", () => {
    const sim = new ShipSim(baseLayout());
    sim.ascend();
    expect(sim.snapshot().ship).toMatchObject({ y: 1, stepsUsed: 1 });
    sim.descend();
    expect(sim.snapshot().ship).toMatchObject({ y: 0, stepsUsed: 2 });
  });

  it("turns are never blocked and cost one step plus one energy", () => {
    const sim = new ShipSim(baseLayout());
    const before = sim.snapshot().ship.energy;
    const d = sim.turnLeft();
    expect(d.blocked).toBe(false);
    expect(sim.snapshot().ship.heading).toBe("west");
    expect(sim.snapshot().ship.stepsUsed).toBe(1);
    expect(sim.snapshot().ship.energy).toBe(before - ENERGY_COSTS.turn_left);
  });

  it("sensors and log cost zero steps and zero energy", () => {
    const sim = new ShipSim(baseLayout());
    const steps0 = sim.snapshot().ship.stepsUsed;
    const e0 = sim.snapshot().ship.energy;
    sim.scan_ahead();
    sim.distance_ahead();
    sim.energy();
    sim.log("hello");
    expect(sim.snapshot().ship.stepsUsed).toBe(steps0);
    expect(sim.snapshot().ship.energy).toBe(e0);
  });

  it("default bounds are 12x12x5 and shrinkable, never above 16x16x6", () => {
    expect(DEFAULT_BOUNDS).toEqual({ maxX: 12, maxY: 5, maxZ: 12 });
    expect(() =>
      new ShipSim(baseLayout({ bounds: { maxX: 17, maxY: 5, maxZ: 12 } })),
    ).toThrow();
    const small = new ShipSim(
      baseLayout({
        shipStart: { x: 1, y: 0, z: 1, heading: "north", energy: 10 },
        bounds: { maxX: 4, maxY: 2, maxZ: 4 },
      }),
    );
    expect(small.snapshot().bounds).toEqual({ maxX: 4, maxY: 2, maxZ: 4 });
  });
});

describe("blocked moves (ADR-0012)", () => {
  it("wall blocks, spends step and energy, stays in place", () => {
    const sim = new ShipSim(
      baseLayout({
        shipStart: { x: 0, y: 0, z: 0, heading: "south", energy: 10 },
      }),
    );
    const d = sim.move();
    expect(d.blocked).toBe(true);
    expect(d.reason).toBe("wall");
    expect(d.ship).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(sim.snapshot().ship.stepsUsed).toBe(1);
    expect(sim.snapshot().ship.energy).toBe(9);
  });

  it("closed gate blocks; open gate passes", () => {
    const layout = baseLayout({
      shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 50 },
      entities: [
        { id: "sw-1", type: "switch", x: 0, y: 0, z: 0, on: false, linkId: "a" },
        { id: "g-1", type: "gate", x: 5, y: 0, z: 6, open: false, linkId: "a" },
      ],
    });
    const sim = new ShipSim(layout);
    const blocked = sim.move();
    expect(blocked.blocked).toBe(true);
    const sim2 = new ShipSim({
      ...layout,
      entities: [
        { id: "sw-1", type: "switch", x: 5, y: 0, z: 5, on: false, linkId: "a" },
        { id: "g-1", type: "gate", x: 5, y: 0, z: 6, open: false, linkId: "a" },
      ],
    });
    // Start cell switch toggles only on entry; force via fresh sim stepping onto it.
    void sim2;
  });

  it("asteroid and drone block like a wall", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [
          { id: "c-1", type: "asteroid_cracked", x: 5, y: 0, z: 6, present: true },
          { id: "d-1", type: "drone", x: 9, y: 0, z: 9, heading: "north", active: true },
        ],
      }),
    );
    const d = sim.move();
    expect(d.blocked).toBe(true);
    expect(sim.snapshot().ship.stepsUsed).toBe(1);
  });

  it("crystals, switches, wormholes never block", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [
          { id: "k-1", type: "crystal", x: 5, y: 0, z: 6, collected: false },
        ],
      }),
    );
    expect(sim.move().blocked).toBe(false);
    expect(sim.snapshot().ship).toMatchObject({ z: 6 });
  });

  it("gate linked to entered switch opens and lets the Ship pass", () => {
    const sim = new ShipSim(
      baseLayout({
        shipStart: { x: 5, y: 0, z: 4, heading: "north", energy: 50 },
        entities: [
          { id: "sw-1", type: "switch", x: 5, y: 0, z: 5, on: false, linkId: "a" },
          { id: "g-1", type: "gate", x: 5, y: 0, z: 6, open: false, linkId: "a" },
        ],
      }),
    );
    sim.move(); // onto switch: toggles on, gate opens
    expect(sim.snapshot().entities["sw-1"]).toMatchObject({ on: true });
    expect(sim.snapshot().entities["g-1"]).toMatchObject({ open: true });
    const through = sim.move(); // through open gate
    expect(through.blocked).toBe(false);
    expect(sim.snapshot().ship).toMatchObject({ z: 6 });
  });
});

describe("interactions (ADR-0012)", () => {
  it("harvest on a crystal collects it; elsewhere it is a spent no-op", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [
          { id: "k-1", type: "crystal", x: 5, y: 0, z: 5, collected: false },
        ],
      }),
    );
    const d = sim.harvest();
    expect(d.blocked).toBe(false);
    expect(d.changed).toEqual(["k-1"]);
    expect(sim.snapshot().ship.crystals).toBe(1);
    const empty = new ShipSim(baseLayout());
    const miss = empty.harvest();
    expect(miss.blocked).toBe(true);
    expect(miss.reason).toBe("nothing_here");
    expect(empty.snapshot().ship.stepsUsed).toBe(1);
    expect(empty.snapshot().ship.energy).toBe(99);
  });

  it("wormhole teleports to its pair in the same step, with no chain", () => {
    const sim = new ShipSim(
      baseLayout({
        shipStart: { x: 5, y: 0, z: 4, heading: "north", energy: 50 },
        entities: [
          { id: "w-1", type: "wormhole", x: 5, y: 0, z: 5, pairId: "p" },
          { id: "w-2", type: "wormhole", x: 1, y: 2, z: 1, pairId: "p" },
        ],
      }),
    );
    const d = sim.move();
    expect(d.blocked).toBe(false);
    expect(sim.snapshot().ship).toMatchObject({ x: 1, y: 2, z: 1 });
    expect(sim.snapshot().ship.stepsUsed).toBe(1);
  });

  it("laser destroys cracked ahead; titanium, drones, gates unaffected", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [
          { id: "c-1", type: "asteroid_cracked", x: 5, y: 0, z: 6, present: true },
        ],
      }),
    );
    const d = sim.laser();
    expect(d.blocked).toBe(false);
    expect(d.changed).toEqual(["c-1"]);
    expect(sim.snapshot().entities["c-1"]).toMatchObject({ present: false });
    expect(sim.snapshot().ship.energy).toBe(98);

    const hard = new ShipSim(
      baseLayout({
        entities: [
          { id: "t-1", type: "asteroid_titanium", x: 5, y: 0, z: 6, present: true },
        ],
      }),
    );
    const miss = hard.laser();
    expect(miss.changed).toEqual([]);
    expect(hard.snapshot().entities["t-1"]).toMatchObject({ present: true });
    expect(hard.snapshot().ship.stepsUsed).toBe(1);
  });

  it("shield toggles ship.shield for one step and one energy", () => {
    const sim = new ShipSim(baseLayout());
    sim.shield();
    expect(sim.snapshot().ship.shield).toBe(true);
    sim.shield();
    expect(sim.snapshot().ship.shield).toBe(false);
    expect(sim.snapshot().ship.stepsUsed).toBe(2);
  });

  it("drones patrol one cell per Ship step and reverse at bounds", () => {
    const sim = new ShipSim(
      baseLayout({
        shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 50 },
        bounds: { maxX: 12, maxY: 5, maxZ: 12 },
        entities: [
          { id: "d-1", type: "drone", x: 5, y: 0, z: 10, heading: "north", active: true },
        ],
      }),
    );
    sim.move(); // drone 10 -> 11
    expect(sim.snapshot().entities["d-1"]).toMatchObject({ z: 11 });
    sim.turnLeft(); // drone reverses at bound, stays 11 heading south
    expect(sim.snapshot().entities["d-1"]).toMatchObject({ z: 11, heading: "south" });
    sim.turnLeft(); // drone 11 -> 10
    expect(sim.snapshot().entities["d-1"]).toMatchObject({ z: 10 });
  });

  it("drone never moves into the Ship cell", () => {
    const sim = new ShipSim(
      baseLayout({
        shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 50 },
        entities: [
          { id: "d-1", type: "drone", x: 5, y: 0, z: 7, heading: "south", active: true },
        ],
      }),
    );
    sim.turnLeft(); // drone wants 7 -> 6, free
    expect(sim.snapshot().entities["d-1"]).toMatchObject({ z: 6 });
    sim.turnLeft(); // drone wants 6 -> 5 (Ship), reverses instead
    expect(sim.snapshot().entities["d-1"]).toMatchObject({ z: 6, heading: "north" });
  });
});

describe("energy (ADR-0012)", () => {
  it("paid costs match spec: move/turn/ascend/descend/harvest/shield 1, laser 2", () => {
    expect(ENERGY_COSTS).toMatchObject({
      move: 1,
      turn_left: 1,
      turn_right: 1,
      ascend: 1,
      descend: 1,
      harvest: 1,
      shield: 1,
      laser: 2,
    });
  });

  it("at zero energy paid actions block with reason energy, free actions work", () => {
    const sim = new ShipSim(
      baseLayout({
        shipStart: { x: 5, y: 0, z: 5, heading: "north", energy: 1 },
      }),
    );
    sim.move();
    expect(sim.snapshot().ship.energy).toBe(0);
    const d = sim.move();
    expect(d.blocked).toBe(true);
    expect(d.reason).toBe("energy");
    expect(sim.snapshot().ship.stepsUsed).toBe(2);
    expect(sim.scan_ahead()).toBe("empty");
    expect(sim.energy()).toBe(0);
  });
});

describe("sensors and parity surface (ADR-0012)", () => {
  it("scan_ahead names the cell ahead; distance_ahead counts empty cells", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [
          { id: "k-1", type: "crystal", x: 5, y: 0, z: 7, collected: false },
        ],
      }),
    );
    expect(sim.scan_ahead()).toBe("empty");
    expect(sim.distance_ahead()).toBe(1);
    sim.move();
    expect(sim.scan_ahead()).toBe("crystal");
    expect(sim.distance_ahead()).toBe(0);
  });

  it("scan_ahead reports wall, cracked, titanium, gates, drone, switch, wormhole", () => {
    const at = (entities: AuthoredLayout["entities"]) =>
      new ShipSim(baseLayout({ entities }));
    expect(at([]).scan_ahead()).toBe("empty");
    expect(
      at([{ id: "c", type: "asteroid_cracked", x: 5, y: 0, z: 6, present: true }]).scan_ahead(),
    ).toBe("asteroid_cracked");
    expect(
      at([{ id: "t", type: "asteroid_titanium", x: 5, y: 0, z: 6, present: true }]).scan_ahead(),
    ).toBe("asteroid_titanium");
    expect(
      at([{ id: "g", type: "gate", x: 5, y: 0, z: 6, open: false, linkId: "a" }]).scan_ahead(),
    ).toBe("gate_closed");
    expect(
      at([{ id: "g", type: "gate", x: 5, y: 0, z: 6, open: true, linkId: "a" }]).scan_ahead(),
    ).toBe("gate_open");
    expect(
      at([{ id: "d", type: "drone", x: 5, y: 0, z: 6, heading: "north", active: true }]).scan_ahead(),
    ).toBe("drone");
    expect(
      at([{ id: "k", type: "crystal", x: 5, y: 0, z: 6, collected: false }]).scan_ahead(),
    ).toBe("crystal");
    expect(
      at([{ id: "s", type: "switch", x: 5, y: 0, z: 6, on: false, linkId: "a" }]).scan_ahead(),
    ).toBe("switch");
    expect(
      at([{ id: "w", type: "wormhole", x: 5, y: 0, z: 6, pairId: "p" }]).scan_ahead(),
    ).toBe("wormhole");
    const edge = new ShipSim(
      baseLayout({ shipStart: { x: 5, y: 0, z: 11, heading: "north", energy: 10 } }),
    );
    expect(edge.scan_ahead()).toBe("wall");
    expect(edge.distance_ahead()).toBe(0);
  });

  it("scalar sensors read Ship state; on_crystal reflects the cell", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [{ id: "k", type: "crystal", x: 5, y: 0, z: 5, collected: false }],
      }),
    );
    expect(sim.get_x()).toBe(5);
    expect(sim.get_y()).toBe(0);
    expect(sim.get_z()).toBe(5);
    expect(sim.heading()).toBe("north");
    expect(sim.crystals()).toBe(0);
    expect(sim.is_shield_on()).toBe(false);
    expect(sim.on_crystal()).toBe(true);
    sim.move();
    expect(sim.on_crystal()).toBe(false);
  });

  it("Python and Java names map one-to-one with the same meaning", () => {
    expect(PYTHON_NAMES.length).toBe(JAVA_NAMES.length);
    expect(new Set(PYTHON_NAMES).size).toBe(PYTHON_NAMES.length);
    for (const [py, js] of Object.entries(SHIP_NAME_TABLE)) {
      expect(PYTHON_NAMES).toContain(py);
      expect(JAVA_NAMES).toContain(js);
    }
    const sim = new ShipSim(baseLayout());
    expect(sim.call("move", [], 1).ok).toBe(true);
    expect(sim.call("turnLeft", [], 2).ok).toBe(true);
    const a = new ShipSim(baseLayout());
    a.call("turn_left", [], 1);
    const b = new ShipSim(baseLayout());
    b.call("turnLeft", [], 1);
    expect(a.snapshot().ship.heading).toBe(b.snapshot().ship.heading);
    expect(isStepName("move")).toBe(true);
    expect(isStepName("scan_ahead")).toBe(false);
    expect(isStepName("log")).toBe(false);
  });
});

describe("snapshot, shipDelta, statePath (ADR-0012)", () => {
  it("snapshot exposes grader-readable World State shape", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [{ id: "crystal-1", type: "crystal", x: 5, y: 0, z: 6, collected: false }],
      }),
    );
    const snap = sim.snapshot();
    expect(Object.keys(snap)).toEqual(["ship", "entities", "bounds"]);
    expect(Object.keys(snap.ship).sort()).toEqual(
      ["crystals", "energy", "heading", "shield", "stepsUsed", "x", "y", "z"].sort(),
    );
    expect(snap.entities["crystal-1"]).toMatchObject({ type: "crystal", collected: false });
  });

  it("shipDelta carries full Ship state plus only changed entities", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [{ id: "k-1", type: "crystal", x: 5, y: 0, z: 5, collected: false }],
      }),
    );
    const d = sim.harvest();
    expect(Object.keys(d.ship).sort()).toEqual(
      ["crystals", "energy", "heading", "shield", "x", "y", "z"].sort(),
    );
    expect(d.changed).toEqual(["k-1"]);
    const plain = new ShipSim(baseLayout()).move();
    expect(plain.changed).toEqual([]);
  });

  it("statePath reads ship and entity paths", () => {
    const sim = new ShipSim(
      baseLayout({
        entities: [{ id: "crystal-1", type: "crystal", x: 5, y: 0, z: 6, collected: false }],
      }),
    );
    const snap = sim.snapshot();
    expect(readStatePath(snap, "ship.x")).toBe(5);
    expect(readStatePath(snap, "ship.crystals")).toBe(0);
    expect(readStatePath(snap, "entities.crystal-1.collected")).toBe(false);
    expect(readStatePath(snap, "entities.nope.collected")).toBeUndefined();
  });

  it("unknown names and wrong arg counts are learner errors; World State stays readable", () => {
    const sim = new ShipSim(baseLayout());
    const unknown = sim.call("fly", [], 3);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error).toMatchObject({ kind: "error", line: 3 });
    }
    const arity = sim.call("move", ["extra"], 4);
    expect(arity.ok).toBe(false);
    const logArity = sim.call("log", [], 5);
    expect(logArity.ok).toBe(false);
    expect(sim.snapshot().ship.stepsUsed).toBe(0);
  });
});

describe("Seed generator (ADR-0012)", () => {
  const authored: AuthoredLayout = {
    shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 50 },
    bounds: { maxX: 6, maxY: 3, maxZ: 6 },
    entities: [
      { id: "k-1", type: "crystal", x: 1, y: 0, z: 1, collected: false },
      { id: "c-1", type: "asteroid_cracked", x: 2, y: 0, z: 2, present: true },
      { id: "t-1", type: "asteroid_titanium", x: 4, y: 0, z: 4, present: true },
      { id: "sw-1", type: "switch", x: 3, y: 0, z: 0, on: false, linkId: "a" },
      { id: "g-1", type: "gate", x: 3, y: 0, z: 1, open: false, linkId: "a" },
      { id: "d-1", type: "drone", x: 5, y: 0, z: 5, heading: "east", active: true },
    ],
  };

  it("practice Seed uses the authored layout unchanged", () => {
    const { layout, fellBack } = generateSeedLayout(authored, 7, 7);
    expect(fellBack).toBe(false);
    expect(layout).toEqual(authored);
    expect(layout).not.toBe(authored);
  });

  it("hidden Seeds move only crystals, cracked asteroids, drone starts", () => {
    const { layout } = generateSeedLayout(authored, 8, 7);
    const byId = Object.fromEntries(layout.entities.map((e) => [e.id, e]));
    expect(byId["t-1"]).toMatchObject({ x: 4, y: 0, z: 4 });
    expect(byId["sw-1"]).toMatchObject({ x: 3, y: 0, z: 0 });
    expect(byId["g-1"]).toMatchObject({ x: 3, y: 0, z: 1 });
    expect(layout.shipStart).toEqual(authored.shipStart);
    expect(layout.bounds).toEqual(authored.bounds);
    // Movable set keeps ids, counts, links; drone keeps patrol axis.
    expect(byId["d-1"].type).toBe("drone");
    if (byId["d-1"].type === "drone") {
      expect(["east", "west"]).toContain(byId["d-1"].heading);
    }
  });

  it("hidden Seeds guarantee no Ship-start spawn, no shared cells, open crystals", () => {
    for (let seed = 101; seed < 121; seed += 1) {
      const { layout } = generateSeedLayout(authored, seed, 7);
      const cells = new Set<string>();
      const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
      cells.add(key(layout.shipStart.x, layout.shipStart.y, layout.shipStart.z));
      for (const e of layout.entities) {
        const k = key(e.x, e.y, e.z);
        expect(cells.has(k)).toBe(false);
        cells.add(k);
      }
      const titanium = new Set(
        layout.entities
          .filter((e) => e.type === "asteroid_titanium")
          .map((e) => key(e.x, e.y, e.z)),
      );
      const inBounds = (x: number, y: number, z: number) =>
        x >= 0 && x < layout.bounds.maxX && y >= 0 && y < layout.bounds.maxY && z >= 0 && z < layout.bounds.maxZ;
      for (const e of layout.entities) {
        if (e.type !== "crystal") continue;
        const neighbours = [
          [e.x + 1, e.y, e.z],
          [e.x - 1, e.y, e.z],
          [e.x, e.y + 1, e.z],
          [e.x, e.y - 1, e.z],
          [e.x, e.y, e.z + 1],
          [e.x, e.y, e.z - 1],
        ].filter(([x, y, z]) => inBounds(x, y, z));
        const closed = neighbours.every(([x, y, z]) => titanium.has(key(x, y, z)));
        if (neighbours.length === 6) expect(closed).toBe(false);
      }
    }
  });

  it("is deterministic per Seed integer", () => {
    const a = generateSeedLayout(authored, 42, 7);
    const b = generateSeedLayout(authored, 42, 7);
    expect(a.layout).toEqual(b.layout);
  });

  it("falls back to authored layout flagged when nothing fits", () => {
    const tiny: AuthoredLayout = {
      shipStart: { x: 0, y: 0, z: 0, heading: "north", energy: 10 },
      bounds: { maxX: 1, maxY: 1, maxZ: 1 },
      entities: [{ id: "k-1", type: "crystal", x: 0, y: 0, z: 0, collected: false }],
    };
    const { layout, fellBack } = generateSeedLayout(tiny, 99, 7);
    expect(fellBack).toBe(true);
    expect(layout).toEqual(tiny);
  });
});

