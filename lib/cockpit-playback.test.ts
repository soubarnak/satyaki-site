// Cockpit playback core (issue #69, spec §§3-4, issue #44 Variant A).
// Glossary: Mission, Ship, World State, Seed, Cadet. Pure core: no
// framework, DOM, or worker imports. Frame = one executed line; step-back
// is pure re-fold, no undo state.
import { describe, expect, it } from "vitest";
import type { ShipState } from "./ship-sim";
import {
  PLAYBACK_FRAME_MS,
  inspectSquare,
  isShipStep,
  playbackWorldAt,
  shipStepIndices,
  speedDelayMs,
  type PlaybackEvent,
  type PlaybackHeader,
} from "./cockpit-playback";

const HEADER: PlaybackHeader = {
  initial: {
    ship: { x: 0, y: 0, z: 2, heading: "east", energy: 20, shield: false, crystals: 0 },
    entities: {
      "crystal-1": { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 2, collected: false },
    },
  },
  bounds: { maxX: 6, maxY: 2, maxZ: 4 },
};

function shipState(x: number, energy: number, crystals: number): ShipState {
  return { x, y: 0, z: 2, heading: "east", energy, shield: false, crystals };
}

const TRACE: PlaybackEvent[] = [
  { step: 0, line: 1, kind: "line", locals: {}, shipDelta: null },
  { step: 0, line: 2, kind: "line", locals: { trips: 0 }, shipDelta: null },
  {
    step: 1,
    line: 3,
    kind: "line",
    locals: { trips: 0 },
    shipDelta: { action: "move", blocked: false, ship: shipState(1, 19, 0), changed: [] },
  },
  { step: 1, line: 2, kind: "line", locals: { trips: 1 }, shipDelta: null },
  {
    step: 2,
    line: 3,
    kind: "line",
    locals: { trips: 1 },
    shipDelta: { action: "move", blocked: false, ship: shipState(2, 18, 0), changed: [] },
  },
  { step: 2, line: 2, kind: "line", locals: { trips: 2 }, shipDelta: null },
];

describe("cockpit playback re-fold", () => {
  it("reset shows the initial World State before line 1", () => {
    const world = playbackWorldAt(HEADER, TRACE, -1);
    expect(world.ship.x).toBe(0);
    expect(world.ship.energy).toBe(20);
  });

  it("line highlight follows loop re-hits and step-back re-folds", () => {
    const atLoopRehit = TRACE[3];
    expect(atLoopRehit.line).toBe(2);
    const worldAtRehit = playbackWorldAt(HEADER, TRACE, 3);
    expect(worldAtRehit.ship.x).toBe(1);
    const back = playbackWorldAt(HEADER, TRACE, 2);
    expect(back.ship.x).toBe(1);
    const before = playbackWorldAt(HEADER, TRACE, 1);
    expect(before.ship.x).toBe(0);
  });

  it("marks Ship steps as gold ticks", () => {
    expect(shipStepIndices(TRACE)).toEqual([2, 4]);
    expect(isShipStep(TRACE[2])).toBe(true);
    expect(isShipStep(TRACE[1])).toBe(false);
  });

  it("paces 1x at 650ms per frame", () => {
    expect(PLAYBACK_FRAME_MS).toBe(650);
    expect(speedDelayMs(1)).toBe(650);
    expect(speedDelayMs(2)).toBe(325);
    expect(speedDelayMs(4)).toBe(162.5);
  });

  it("inspects a square with coordinates, occupant, and height", () => {
    const world = playbackWorldAt(HEADER, TRACE, 4);
    const label = inspectSquare(world, { x: 2, z: 2 });
    expect(label).toContain("(2, 2)");
    expect(label).toContain("crystal");
    expect(label).toContain("y=0");
  });
});
