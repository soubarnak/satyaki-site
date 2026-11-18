// Arena tick-battle suites (ADR-0014, spec §9).
// Seam: the pure tick engine in lib/arena.ts. Expected values come from
// the ADR (counts, speeds, costs, caps), never from the code.

import { describe, expect, it } from "vitest";
import {
  ARENA_ACTIONS,
  ARENA_ENERGY_PER_WAVE,
  ARENA_TICK_CAP,
  ARENA_WAVES,
  arenaHeader,
  arenaHudLabel,
  arenaStepTicks,
  arenaWorldAt,
  droneDirectionFor,
  normalizeArenaAction,
  radarSnapshotFor,
  radarSnapshotForJava,
  runArenaBattle,
  spawnWave,
  waveDroneCount,
  waveInterval,
  type ArenaTickFn,
} from "./arena";

/** Scripted ticks: play the list, then wait. */
function scripted(actions: string[]): ArenaTickFn {
  let i = 0;
  return () => (i < actions.length ? (actions[i++] as string) : "wait");
}

/** Go to row 9 facing east: the wave-1 drone row nearest the start. */
function toRow9(): string[] {
  return ["turn_left", "move", "move", "move", "turn_right"];
}

/** Hunter: laser at range 1 ahead, shield at contact, close in when
 *  ahead and far, turn toward other bearings with an anti-spin break so
 *  row changes happen. Deterministic; clears all five waves in 156 ticks. */
function hunter(): ArenaTickFn {
  let turns = 0;
  return (ship, radar) => {
    const dist = radar.drone_distance;
    const dir = radar.drone_direction;
    if (radar.drones_left === 0) return "wait";
    if (dist === 0 || dir === "here") return "shield";
    if (dir === "ahead") {
      turns = 0;
      if (dist === 1) return ship.energy >= 2 ? "laser" : ship.shield ? "wait" : "shield";
      return ship.energy >= 1 ? "move" : "wait";
    }
    if (dist <= 1) {
      turns = 0;
      if (!ship.shield) return ship.energy >= 1 ? "shield" : "wait";
      if (dir === "left") return "turn_left";
      if (dir === "right") return "turn_right";
      return "turn_left";
    }
    let want = "wait";
    if (dir === "left") want = "turn_left";
    else if (dir === "right") want = "turn_right";
    else if (dir === "behind") want = "turn_left";
    else if (dir === "above") want = "descend";
    else if (dir === "below") want = "ascend";
    if ((want === "turn_left" || want === "turn_right") && turns >= 2) {
      turns = 0;
      return ship.energy >= 1 ? "move" : "wait";
    }
    if (want === "turn_left" || want === "turn_right") turns += 1;
    else turns = 0;
    return want;
  };
}

describe("arena tuning constants (ADR-0014)", () => {
  it("names the wave rules in one place", () => {
    expect(ARENA_WAVES).toBe(5);
    expect(ARENA_TICK_CAP).toBe(200);
    expect(ARENA_ENERGY_PER_WAVE).toBe(50);
    expect(ARENA_ACTIONS).toEqual([
      "move",
      "turn_left",
      "turn_right",
      "ascend",
      "descend",
      "laser",
      "harvest",
      "shield",
      "wait",
    ]);
  });

  it("fields n+1 drones per wave", () => {
    expect([1, 2, 3, 4, 5].map(waveDroneCount)).toEqual([2, 3, 4, 5, 6]);
  });

  it("patrols 1 cell per max(1,4-n) ticks", () => {
    expect([1, 2, 3, 4, 5].map(waveInterval)).toEqual([3, 2, 1, 1, 1]);
  });

  it("spawns each wave at the east edge in spaced rows", () => {
    for (let wave = 1; wave <= 5; wave += 1) {
      const drones = spawnWave(wave);
      expect(drones).toHaveLength(wave + 1);
      const rows = new Set(drones.map((d) => d.z));
      expect(rows.size).toBe(drones.length);
      for (const drone of drones) {
        expect(drone.x).toBe(11);
        expect(drone.y).toBe(0);
      }
    }
  });
});

describe("normalizeArenaAction", () => {
  it("accepts all 9 actions and both Java spellings", () => {
    for (const action of ARENA_ACTIONS) {
      expect(normalizeArenaAction(action).valid).toBe(true);
    }
    expect(normalizeArenaAction("turnLeft").normalized).toBe("turn_left");
    expect(normalizeArenaAction("turnRight").normalized).toBe("turn_right");
  });

  it("wastes invalid returns without stopping", () => {
    for (const raw of ["dance", "", 42, null, undefined]) {
      const parsed = normalizeArenaAction(raw);
      expect(parsed.valid).toBe(false);
      expect(parsed.normalized).toBeNull();
    }
    const result = runArenaBattle(scripted(["dance", "jump", "move!!!"]));
    expect(result.reason).toBe("cap");
    expect(result.ticks).toBe(ARENA_TICK_CAP);
    expect(result.frames.slice(0, 3).every((frame) => frame.valid === false)).toBe(true);
  });
});

describe("radar snapshots (ADR-0014 fields)", () => {
  it("mirrors World State names in both languages", () => {
    const ship = { x: 1, y: 0, z: 6, heading: "east" as const, energy: 50, shield: false, crystals: 0 };
    const drones = [{ id: "w1-d0", x: 4, y: 0, z: 6 }];
    const radar = radarSnapshotFor(ship, drones, 2);
    expect(radar).toEqual({ drone_distance: 3, drone_direction: "ahead", wave: 2, drones_left: 1 });
    expect(radarSnapshotForJava(ship, drones, 2)).toEqual({
      droneDistance: 3,
      droneDirection: "ahead",
      wave: 2,
      dronesLeft: 1,
    });
  });

  it("reports none with no drones left", () => {
    const ship = { x: 1, y: 0, z: 6, heading: "east" as const, energy: 50, shield: false, crystals: 0 };
    const radar = radarSnapshotFor(ship, [], 5);
    expect(radar.drone_distance).toBe(0);
    expect(radar.drone_direction).toBe("none");
  });

  it("bears relative to the heading", () => {
    const ship = { x: 5, y: 0, z: 5, heading: "east" as const, energy: 50, shield: false, crystals: 0 };
    expect(droneDirectionFor(ship, { x: 8, y: 0, z: 5 })).toBe("ahead");
    expect(droneDirectionFor(ship, { x: 2, y: 0, z: 5 })).toBe("behind");
    expect(droneDirectionFor(ship, { x: 5, y: 0, z: 2 })).toBe("right");
    expect(droneDirectionFor(ship, { x: 5, y: 0, z: 8 })).toBe("left");
    expect(droneDirectionFor({ ...ship, heading: "north" }, { x: 5, y: 0, z: 8 })).toBe("ahead");
    expect(droneDirectionFor(ship, { x: 5, y: 1, z: 5 })).toBe("above");
    expect(droneDirectionFor(ship, { x: 5, y: 0, z: 5 })).toBe("here");
  });
});

describe("shield saves once", () => {
  it("a bare walk into the drone row loses", () => {
    const result = runArenaBattle(scripted([...toRow9(), ...Array(60).fill("move")]));
    expect(result.won).toBe(false);
    expect(result.reason).toBe("loss");
  });

  it("shield up before contact survives the first hit", () => {
    const bare = runArenaBattle(scripted([...toRow9(), ...Array(60).fill("move")]));
    const shielded = runArenaBattle(hunter());
    expect(bare.reason).toBe("loss");
    expect(shielded.won).toBe(true);
    expect(shielded.ticks).toBeGreaterThan(bare.ticks);
    const dropped = shielded.frames.find((frame, index) => {
      const prev = index === 0 ? null : shielded.frames[index - 1];
      return prev?.ship.shield === true && frame.ship.shield === false;
    });
    expect(dropped).toBeDefined();
  });
});

describe("energy refill per wave", () => {
  it("wave 2 starts back at 50 energy", () => {
    const result = runArenaBattle(hunter());
    expect(result.won).toBe(true);
    const lastWave1 = [...result.frames].reverse().find((frame) => frame.wave === 1);
    const firstWave2 = result.frames.find((frame) => frame.wave === 2);
    expect(lastWave1).toBeDefined();
    expect(firstWave2).toBeDefined();
    // Energy only drains inside a wave, so a rise across the boundary
    // proves the refill to 50 followed by the entry tick's own cost.
    expect(firstWave2?.ship.energy).toBeGreaterThan(lastWave1?.ship.energy ?? 50);
    expect(firstWave2?.ship.energy).toBeLessThanOrEqual(ARENA_ENERGY_PER_WAVE);
  });
});

describe("win, loss, and cap outcomes", () => {
  it("the hunter clears wave 5", () => {
    const result = runArenaBattle(hunter());
    expect(result.won).toBe(true);
    expect(result.reason).toBe("win");
    expect(result.wave).toBe(5);
    expect(result.ticks).toBeLessThanOrEqual(ARENA_TICK_CAP);
  });

  it("waiting out the clock caps at 200 ticks", () => {
    const result = runArenaBattle(scripted([]));
    expect(result.won).toBe(false);
    expect(result.reason).toBe("cap");
    expect(result.ticks).toBe(ARENA_TICK_CAP);
    expect(result.frames).toHaveLength(ARENA_TICK_CAP);
  });

  it("a throwing tick stops as an error, never a win", () => {
    const result = runArenaBattle(() => {
      throw { line: 3, excType: "NameError", message: "nope" };
    });
    expect(result.won).toBe(false);
    expect(result.reason).toBe("error");
    expect(result.error).toMatchObject({ line: 3, excType: "NameError" });
  });
});

describe("cockpit-model replay", () => {
  it("folds headers, steps, and HUD text without new machinery", () => {
    const header = arenaHeader();
    expect(header.bounds).toEqual({ maxX: 12, maxY: 5, maxZ: 12 });
    expect(header.initial.drones).toHaveLength(2);
    const battle = runArenaBattle(scripted(["shield", "wait", "wait"]));
    const at = arenaWorldAt(battle.frames, 0);
    expect(at.ship.shield).toBe(true);
    expect(at.wave).toBe(1);
    const back = arenaWorldAt(battle.frames, -1);
    expect(back.ship.shield).toBe(false);
    expect(arenaStepTicks(battle.frames)).toContain(0);
    const label = arenaHudLabel(arenaWorldAt(battle.frames, 2), 2, battle.frames.length);
    expect(label).toContain("wave 1/5");
    expect(label).toContain("tick 3/");
  });
});
