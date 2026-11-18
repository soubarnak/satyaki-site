// Playground feedback core (ADR-0007 pure core: no framework imports).
// Turns one /api/run outcome into the child-first lines the playground
// view shows (WF-003, FR-009). The playground never judges and never
// scores: an `ok` run only echoes output, every other class maps to the
// same child-readable FR-007 lines the lesson player uses.

import type { RunOutcome } from "./lesson-player";
import type { AuthoredLayout, EntityInput, Heading, WorldSnapshot } from "./ship-sim";
import { MAX_BOUNDS } from "./ship-sim";
import type { PassCheck } from "./content";
import { checkOnSnapshot } from "./grader";
import {
  CREATION_MAX_COUNT,
  CREATION_TITLE_MAX,
  DRAFT_MAX_CHARS,
  saveCreationV2,
  sanitizeProgressV2,
  type CreationV2,
  type ProgressV2,
} from "./progress";
import { SHIP_COLOURS } from "./kid-errors";
import { deflateSync, inflateSync } from "fflate";

/** Example program the playground editor starts with (WF-003 step 1). */
export const PLAYGROUND_EXAMPLE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Bolt!");
    }
}`;

export type PlaygroundFeedbackKind = "output" | "code-error" | "runner-problem";

export interface PlaygroundFeedback {
  kind: PlaygroundFeedbackKind;
  /** Child-readable line, always shown first (FR-007, ADR-0008). */
  boltLine: string;
  /** Raw runner text shown after the child line, never before it. */
  rawError: string;
}

// Same FR-007 lines as the lesson player, so runner trouble and code
// mistakes read identically in both views. Duplicated, not imported:
// the lesson player keeps its table private to its judged flow.
const CLASS_LINES: Record<string, string> = {
  compile: "Bolt cannot read this code yet, Cadet. Check the line the message names.",
  runtime: "Your program started, then hit a problem and stopped, Cadet.",
  "memory-cap": "Your program used too much memory, so Bolt stopped it, Cadet.",
  "time-cap": "Your program ran too long, so Bolt stopped it, Cadet.",
  "runner-unavailable":
    "The code runner is not answering, Cadet, and that is not your code's fault. Try Run again soon.",
  busy: "Too many runs at once, Cadet. Wait a moment, then try Run again.",
};

const GENERIC_LINE = "Something stopped your program, Cadet. Try Run again.";

/**
 * Child-first feedback for one finished playground run. Never passes or
 * fails the program: `ok` only echoes output, everything else maps to a
 * display line with the raw text kept after it.
 */
export function playgroundFeedback(run: RunOutcome, rawError = ""): PlaygroundFeedback {
  if (run.resultClass === "ok") {
    return {
      kind: "output",
      boltLine: "Nice run, Cadet. Your output shows below.",
      rawError: "",
    };
  }
  if (run.resultClass === "runner-unavailable" || run.resultClass === "busy") {
    return { kind: "runner-problem", boltLine: CLASS_LINES[run.resultClass], rawError };
  }
  return {
    kind: "code-error",
    boltLine: CLASS_LINES[run.resultClass] ?? GENERIC_LINE,
    rawError,
  };
}

// ---------------------------------------------------------------------------
// Playground builder: code API with a setup phase (ADR-0014, spec §9).
// Glossary: Playground, Creation, Challenge, Ship, Ship API, World State.
// Pure core: no framework, DOM, or worker imports.
//
// Cadet code calls builder calls once at the top of the program, then the
// run plays in that world. Builder calls run in a setup phase before step
// 1: 0 steps, 0 energy, no trace events. The language workers own that
// enforcement at runtime; this module is the contract they enforce: every
// method returns null on success or a line-named BuilderError the shared
// kid-error translator renders. A worker flips the phase with
// noteShipAction() on the first Ship API step; every later builder call is
// a BuilderAfterStep error naming the line.
// ---------------------------------------------------------------------------

/** Closed Ship colour palette (ADR-0014); cosmetic only, never graded. */
export type PlaygroundShipColour = (typeof SHIP_COLOURS)[number];

/** Max spawned entities per world (ADR-0014 safety limits). */
export const PLAYGROUND_MAX_ENTITIES = 40;

/** Line-named builder failure; the kid-error translator renders it. */
export interface BuilderError {
  kind: "error";
  /** 1-based editor line of the offending builder call. */
  line: number;
  /** Classified by lib/kid-errors: BuilderAfterStep, UnknownColour, ... */
  excType: string;
  /** Internal detail; never shown. The translator classifies, never echoes. */
  message: string;
  /** Builder call name, allowlisted in lib/kid-errors for echo. */
  call: string;
}

const HEADINGS: readonly Heading[] = ["north", "east", "south", "west"];
const DRONE_AXES = ["x", "y", "z"] as const;

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function builderCellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/**
 * One deterministic builder: collects setup-phase calls into an
 * AuthoredLayout. Both languages share it: snake_case methods are
 * canonical, camelCase aliases carry the same meaning and argument order.
 */
export class PlaygroundBuilder {
  private start = { x: 0, y: 0, z: 0, heading: "east" as Heading, energy: 50 };
  private colour: PlaygroundShipColour = "blue";
  private bounds = { maxX: 12, maxY: 5, maxZ: 12 };
  private entities: EntityInput[] = [];
  private counters = new Map<string, number>();
  private portalCount = 0;
  private moved = false;

  /** True once the first Ship action ran; later builder calls error. */
  get shipMoved(): boolean {
    return this.moved;
  }

  /** Workers call this on the first Ship API step to close the setup phase. */
  noteShipAction(): void {
    this.moved = true;
  }

  private fail(line: number, excType: string, call: string, message: string): BuilderError {
    return { kind: "error", line, excType, message, call };
  }

  private afterStep(line: number, call: string): BuilderError | null {
    if (!this.moved) return null;
    return this.fail(line, "BuilderAfterStep", call, `${call} after a Ship action`);
  }

  private inBounds(x: number, y: number, z: number): boolean {
    return (
      x >= 0 &&
      x < this.bounds.maxX &&
      y >= 0 &&
      y < this.bounds.maxY &&
      z >= 0 &&
      z < this.bounds.maxZ
    );
  }

  private taken(x: number, y: number, z: number): boolean {
    if (this.start.x === x && this.start.y === y && this.start.z === z) return true;
    return this.entities.some((e) => e.x === x && e.y === y && e.z === z);
  }

  private claim(line: number, call: string, x: number, y: number, z: number): BuilderError | null {
    if (!this.inBounds(x, y, z)) {
      return this.fail(line, "BuilderPlacement", call, `${call} outside bounds ${x},${y},${z}`);
    }
    if (this.taken(x, y, z)) {
      return this.fail(line, "BuilderPlacement", call, `${call} on a blocked square ${x},${y},${z}`);
    }
    return null;
  }

  private capacity(line: number, call: string, add: number): BuilderError | null {
    if (this.entities.length + add > PLAYGROUND_MAX_ENTITIES) {
      return this.fail(line, "BuilderLimit", call, `${call} past 40 entities`);
    }
    return null;
  }

  private nextId(base: string): string {
    const n = (this.counters.get(base) ?? 0) + 1;
    this.counters.set(base, n);
    return `${base}-${n}`;
  }

  set_ship_start(
    x: number,
    y: number,
    z: number,
    heading: string,
    line: number,
  ): BuilderError | null {
    const late = this.afterStep(line, "set_ship_start");
    if (late) return late;
    if (!isInt(x) || !isInt(y) || !isInt(z) || !(HEADINGS as readonly string[]).includes(heading)) {
      return this.fail(line, "BuilderArgs", "set_ship_start", "bad ship start values");
    }
    if (
      x < 0 ||
      x >= this.bounds.maxX ||
      y < 0 ||
      y >= this.bounds.maxY ||
      z < 0 ||
      z >= this.bounds.maxZ
    ) {
      return this.fail(line, "BuilderArgs", "set_ship_start", "ship start outside bounds");
    }
    if (this.entities.some((e) => e.x === x && e.y === y && e.z === z)) {
      return this.fail(line, "BuilderPlacement", "set_ship_start", "ship start on a taken square");
    }
    this.start = { x, y, z, heading: heading as Heading, energy: 50 };
    return null;
  }

  setShipStart(
    x: number,
    y: number,
    z: number,
    heading: string,
    line: number,
  ): BuilderError | null {
    return this.set_ship_start(x, y, z, heading, line);
  }

  set_ship_colour(colour: string, line: number): BuilderError | null {
    const late = this.afterStep(line, "set_ship_colour");
    if (late) return late;
    if (typeof colour !== "string" || colour === "") {
      return this.fail(line, "BuilderArgs", "set_ship_colour", "bad colour value");
    }
    if (!(SHIP_COLOURS as readonly string[]).includes(colour)) {
      return this.fail(line, "UnknownColour", "set_ship_colour", `unknown colour ${colour}`);
    }
    this.colour = colour as PlaygroundShipColour;
    return null;
  }

  setShipColour(colour: string, line: number): BuilderError | null {
    return this.set_ship_colour(colour, line);
  }

  set_bounds(maxX: number, maxY: number, maxZ: number, line: number): BuilderError | null {
    const late = this.afterStep(line, "set_bounds");
    if (late) return late;
    if (!isInt(maxX) || !isInt(maxY) || !isInt(maxZ) || maxX < 1 || maxY < 1 || maxZ < 1) {
      return this.fail(line, "BuilderArgs", "set_bounds", "bad bounds values");
    }
    if (maxX > MAX_BOUNDS.maxX || maxY > MAX_BOUNDS.maxY || maxZ > MAX_BOUNDS.maxZ) {
      return this.fail(
        line,
        "BuilderLimit",
        "set_bounds",
        `bounds ${maxX}x${maxZ}x${maxY} past 16x16x6`,
      );
    }
    const fits = (x: number, y: number, z: number): boolean =>
      x >= 0 && x < maxX && y >= 0 && y < maxY && z >= 0 && z < maxZ;
    if (
      !fits(this.start.x, this.start.y, this.start.z) ||
      this.entities.some((e) => !fits(e.x, e.y, e.z))
    ) {
      return this.fail(line, "BuilderLimit", "set_bounds", "bounds shrink past built content");
    }
    this.bounds = { maxX, maxY, maxZ };
    return null;
  }

  setBounds(maxX: number, maxY: number, maxZ: number, line: number): BuilderError | null {
    return this.set_bounds(maxX, maxY, maxZ, line);
  }

  private spawnSimple(
    type: "crystal" | "asteroid_cracked" | "asteroid_titanium",
    idBase: string,
    call: string,
    x: number,
    y: number,
    z: number,
    line: number,
  ): BuilderError | null {
    const late = this.afterStep(line, call);
    if (late) return late;
    if (!isInt(x) || !isInt(y) || !isInt(z)) {
      return this.fail(line, "BuilderArgs", call, `${call} needs integer cells`);
    }
    const blocked = this.claim(line, call, x, y, z);
    if (blocked) return blocked;
    const full = this.capacity(line, call, 1);
    if (full) return full;
    const id = this.nextId(idBase);
    if (type === "crystal") this.entities.push({ id, type, x, y, z });
    else this.entities.push({ id, type, x, y, z, present: true });
    return null;
  }

  spawn_crystal(x: number, y: number, z: number, line: number): BuilderError | null {
    return this.spawnSimple("crystal", "crystal", "spawn_crystal", x, y, z, line);
  }

  spawnCrystal(x: number, y: number, z: number, line: number): BuilderError | null {
    return this.spawn_crystal(x, y, z, line);
  }

  spawn_asteroid_cracked(x: number, y: number, z: number, line: number): BuilderError | null {
    return this.spawnSimple(
      "asteroid_cracked",
      "asteroid_cracked",
      "spawn_asteroid_cracked",
      x,
      y,
      z,
      line,
    );
  }

  spawnAsteroidCracked(x: number, y: number, z: number, line: number): BuilderError | null {
    return this.spawn_asteroid_cracked(x, y, z, line);
  }

  spawn_asteroid_titanium(x: number, y: number, z: number, line: number): BuilderError | null {
    return this.spawnSimple(
      "asteroid_titanium",
      "asteroid_titanium",
      "spawn_asteroid_titanium",
      x,
      y,
      z,
      line,
    );
  }

  spawnAsteroidTitanium(x: number, y: number, z: number, line: number): BuilderError | null {
    return this.spawn_asteroid_titanium(x, y, z, line);
  }

  private spawnLinked(
    type: "switch" | "gate",
    call: string,
    x: number,
    y: number,
    z: number,
    link: string,
    line: number,
  ): BuilderError | null {
    const late = this.afterStep(line, call);
    if (late) return late;
    if (!isInt(x) || !isInt(y) || !isInt(z) || typeof link !== "string" || link === "") {
      return this.fail(line, "BuilderArgs", call, `${call} needs a cell and a link name`);
    }
    const blocked = this.claim(line, call, x, y, z);
    if (blocked) return blocked;
    const full = this.capacity(line, call, 1);
    if (full) return full;
    const id = this.nextId(type);
    if (type === "switch") this.entities.push({ id, type, x, y, z, linkId: link });
    else this.entities.push({ id, type, x, y, z, linkId: link, open: false });
    return null;
  }

  spawn_switch(x: number, y: number, z: number, link: string, line: number): BuilderError | null {
    return this.spawnLinked("switch", "spawn_switch", x, y, z, link, line);
  }

  spawnSwitch(x: number, y: number, z: number, link: string, line: number): BuilderError | null {
    return this.spawn_switch(x, y, z, link, line);
  }

  spawn_gate(x: number, y: number, z: number, link: string, line: number): BuilderError | null {
    return this.spawnLinked("gate", "spawn_gate", x, y, z, link, line);
  }

  spawnGate(x: number, y: number, z: number, link: string, line: number): BuilderError | null {
    return this.spawn_gate(x, y, z, link, line);
  }

  spawn_portal(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    line: number,
  ): BuilderError | null {
    const call = "spawn_portal";
    const late = this.afterStep(line, call);
    if (late) return late;
    if (![x1, y1, z1, x2, y2, z2].every(isInt)) {
      return this.fail(line, "BuilderArgs", call, `${call} needs two integer cells`);
    }
    const full = this.capacity(line, call, 2);
    if (full) return full;
    for (const [x, y, z] of [
      [x1, y1, z1],
      [x2, y2, z2],
    ] as const) {
      const blocked = this.claim(line, call, x, y, z);
      if (blocked) return blocked;
    }
    this.portalCount += 1;
    const pairId = `portal-${this.portalCount}`;
    this.entities.push({ id: this.nextId("wormhole"), type: "wormhole", x: x1, y: y1, z: z1, pairId });
    this.entities.push({ id: this.nextId("wormhole"), type: "wormhole", x: x2, y: y2, z: z2, pairId });
    return null;
  }

  spawnPortal(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    line: number,
  ): BuilderError | null {
    return this.spawn_portal(x1, y1, z1, x2, y2, z2, line);
  }

  spawn_drone(x: number, y: number, z: number, axis: string, line: number): BuilderError | null {
    const call = "spawn_drone";
    const late = this.afterStep(line, call);
    if (late) return late;
    if (!isInt(x) || !isInt(y) || !isInt(z)) {
      return this.fail(line, "BuilderArgs", call, `${call} needs an integer cell`);
    }
    if (!(DRONE_AXES as readonly string[]).includes(axis)) {
      return this.fail(line, "BuilderArgs", call, `${call} needs an axis of x, y, or z`);
    }
    const blocked = this.claim(line, call, x, y, z);
    if (blocked) return blocked;
    const full = this.capacity(line, call, 1);
    if (full) return full;
    // The sim patrols the x/z plane only, so a y-axis drone degrades to an
    // east-lane patrol; the axis choice stays accepted per ADR-0014.
    const heading: Heading = axis === "z" ? "north" : "east";
    this.entities.push({ id: this.nextId("drone"), type: "drone", x, y, z, heading });
    return null;
  }

  spawnDrone(x: number, y: number, z: number, axis: string, line: number): BuilderError | null {
    return this.spawn_drone(x, y, z, axis, line);
  }

  spawn_crystal_ring(
    x: number,
    y: number,
    z: number,
    radius: number,
    line: number,
  ): BuilderError | null {
    const call = "spawn_crystal_ring";
    const late = this.afterStep(line, call);
    if (late) return late;
    if (!isInt(x) || !isInt(y) || !isInt(z) || !isInt(radius) || radius < 1) {
      return this.fail(line, "BuilderArgs", call, `${call} needs a cell and a radius of at least 1`);
    }
    const cells = [
      [x + radius, y, z],
      [x - radius, y, z],
      [x, y, z + radius],
      [x, y, z - radius],
      [x + radius, y, z + radius],
      [x + radius, y, z - radius],
      [x - radius, y, z + radius],
      [x - radius, y, z - radius],
    ] as const;
    const full = this.capacity(line, call, cells.length);
    if (full) return full;
    for (const [cx, cy, cz] of cells) {
      const blocked = this.claim(line, call, cx, cy, cz);
      if (blocked) return blocked;
    }
    for (const [cx, cy, cz] of cells) {
      this.entities.push({ id: this.nextId("crystal"), type: "crystal", x: cx, y: cy, z: cz });
    }
    return null;
  }

  spawnCrystalRing(
    x: number,
    y: number,
    z: number,
    radius: number,
    line: number,
  ): BuilderError | null {
    return this.spawn_crystal_ring(x, y, z, radius, line);
  }

  /** Assembled world plus cosmetic colour. All errors surface eagerly per call. */
  build(): { world: AuthoredLayout; shipColour: PlaygroundShipColour } {
    return {
      world: {
        shipStart: { ...this.start },
        bounds: { ...this.bounds },
        entities: this.entities.map((e) => ({ ...e }) as EntityInput),
      },
      shipColour: this.colour,
    };
  }
}

// ---------------------------------------------------------------------------
// World shape validation: one world-level check for builder output and
// Share Link import (ADR-0014 rejection set). Returns null when the world
// is playable, else the first issue code.
// ---------------------------------------------------------------------------

export type WorldShapeIssue =
  | "not-object"
  | "bad-bounds"
  | "bounds-too-large"
  | "bad-ship-start"
  | "ship-start-out-of-bounds"
  | "bad-entities"
  | "over-cap"
  | "unknown-entity"
  | "bad-coords"
  | "out-of-bounds"
  | "duplicate-cell"
  | "bad-link"
  | "bad-pair"
  | "bad-heading";

const ENTITY_TYPES = [
  "asteroid_cracked",
  "asteroid_titanium",
  "crystal",
  "switch",
  "gate",
  "wormhole",
  "drone",
] as const;

/** Null when the world is playable, else the first shape issue. */
export function validateWorldShape(world: unknown): WorldShapeIssue | null {
  if (typeof world !== "object" || world === null || Array.isArray(world)) return "not-object";
  const w = world as Record<string, unknown>;
  const bounds = w.bounds as Record<string, unknown> | null;
  const shipStart = w.shipStart as Record<string, unknown> | null;
  if (
    typeof bounds !== "object" ||
    bounds === null ||
    !isInt(bounds.maxX) ||
    !isInt(bounds.maxY) ||
    !isInt(bounds.maxZ)
  ) {
    return "bad-bounds";
  }
  if (
    (bounds.maxX as number) < 1 ||
    (bounds.maxY as number) < 1 ||
    (bounds.maxZ as number) < 1
  ) {
    return "bad-bounds";
  }
  if (
    (bounds.maxX as number) > MAX_BOUNDS.maxX ||
    (bounds.maxY as number) > MAX_BOUNDS.maxY ||
    (bounds.maxZ as number) > MAX_BOUNDS.maxZ
  ) {
    return "bounds-too-large";
  }
  const maxX = bounds.maxX as number;
  const maxY = bounds.maxY as number;
  const maxZ = bounds.maxZ as number;
  if (
    typeof shipStart !== "object" ||
    shipStart === null ||
    !isInt(shipStart.x) ||
    !isInt(shipStart.y) ||
    !isInt(shipStart.z) ||
    !(HEADINGS as readonly string[]).includes(shipStart.heading as string)
  ) {
    return "bad-ship-start";
  }
  const sx = shipStart.x as number;
  const sy = shipStart.y as number;
  const sz = shipStart.z as number;
  if (sx < 0 || sx >= maxX || sy < 0 || sy >= maxY || sz < 0 || sz >= maxZ) {
    return "ship-start-out-of-bounds";
  }
  if (!Array.isArray(w.entities)) return "bad-entities";
  if (w.entities.length > PLAYGROUND_MAX_ENTITIES) return "over-cap";
  const seen = new Set<string>([builderCellKey(sx, sy, sz)]);
  for (const entry of w.entities) {
    if (typeof entry !== "object" || entry === null) return "unknown-entity";
    const e = entry as Record<string, unknown>;
    if (!(ENTITY_TYPES as readonly string[]).includes(e.type as string)) return "unknown-entity";
    if (!isInt(e.x) || !isInt(e.y) || !isInt(e.z)) return "bad-coords";
    const x = e.x as number;
    const y = e.y as number;
    const z = e.z as number;
    if (x < 0 || x >= maxX || y < 0 || y >= maxY || z < 0 || z >= maxZ) return "out-of-bounds";
    const key = builderCellKey(x, y, z);
    if (seen.has(key)) return "duplicate-cell";
    seen.add(key);
    if ((e.type === "switch" || e.type === "gate") && (typeof e.linkId !== "string" || e.linkId === "")) {
      return "bad-link";
    }
    if (e.type === "wormhole" && (typeof e.pairId !== "string" || e.pairId === "")) {
      return "bad-pair";
    }
    if (
      e.type === "drone" &&
      !(HEADINGS as readonly string[]).includes(e.heading as string)
    ) {
      return "bad-heading";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Challenge designer: 1-3 goals from the fixed menu (ADR-0014).
// Glossary: Challenge. Each goal is one or more Pass checks in the
// ADR-0013 shape; all must hold (AND only). A reach-cell goal expands to
// one check per axis, mirroring Mission content where a reach objective
// pairs a `ship.x` check with a lane check. Only the survive goal judges
// `intermediate`; the rest judge `final`.
// ---------------------------------------------------------------------------

export const CHALLENGE_GOAL_KINDS = [
  "reach-cell",
  "collect-crystals",
  "open-gate",
  "flip-switch",
  "survive-steps",
] as const;

export type ChallengeGoalKind = (typeof CHALLENGE_GOAL_KINDS)[number];

const CHECK_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STATE_PATH =
  /^(ship\.[A-Za-z0-9_]+|entities\.[A-Za-z0-9_-]+\.[A-Za-z0-9_]+|bounds\.[A-Za-z0-9_]+)$/;

/** Reach a cell: one `final` check per axis, labels free of coordinates. */
export function createReachGoal(
  x: number,
  y: number,
  z: number,
  opts?: { idBase?: string; label?: string },
): PassCheck[] {
  const base = opts?.idBase ?? `reach-${x}-${y}-${z}`;
  const label = opts?.label ?? "Reach the marker";
  return [
    { id: base, label, statePath: "ship.x", comparator: "eq", expected: x, timing: "final" },
    { id: `${base}-lane`, label: `${label} lane`, statePath: "ship.z", comparator: "eq", expected: z, timing: "final" },
    { id: `${base}-level`, label: `${label} level`, statePath: "ship.y", comparator: "eq", expected: y, timing: "final" },
  ];
}

/** Collect N crystals: `ship.crystals gte N`, judged `final`. */
export function createCollectGoal(
  count: number,
  opts?: { id?: string; label?: string },
): PassCheck {
  return {
    id: opts?.id ?? `collect-${count}`,
    label: opts?.label ?? (count === 1 ? "Collect 1 crystal" : `Collect ${count} crystals`),
    statePath: "ship.crystals",
    comparator: "gte",
    expected: count,
    timing: "final",
  };
}

/** Open a gate: `entities.<gate>.open`, judged `final`. */
export function createOpenGateGoal(
  gateId: string,
  opts?: { id?: string; label?: string },
): PassCheck {
  return {
    id: opts?.id ?? `open-${gateId}`,
    label: opts?.label ?? "Open the gate",
    statePath: `entities.${gateId}.open`,
    comparator: "eq",
    expected: true,
    timing: "final",
  };
}

/** Flip a switch: `entities.<switch>.on`, judged `final`. */
export function createFlipSwitchGoal(
  switchId: string,
  opts?: { id?: string; label?: string },
): PassCheck {
  return {
    id: opts?.id ?? `flip-${switchId}`,
    label: opts?.label ?? "Flip the switch",
    statePath: `entities.${switchId}.on`,
    comparator: "eq",
    expected: true,
    timing: "final",
  };
}

/** Survive N steps: `ship.stepsUsed gte N`, judged `intermediate`. */
export function createSurviveGoal(
  steps: number,
  opts?: { id?: string; label?: string },
): PassCheck {
  return {
    id: opts?.id ?? `survive-${steps}`,
    label: opts?.label ?? `Survive ${steps} steps`,
    statePath: "ship.stepsUsed",
    comparator: "gte",
    expected: steps,
    timing: "intermediate",
  };
}

/** Max flattened checks stored per Challenge: 3 goals of up to 3 axis checks. */
export const CHALLENGE_MAX_CHECKS = 9;

/** Error lines for an invalid goal set; empty means 1+ valid goals. */
export function validateChallengeGoals(goals: unknown): string[] {
  if (!Array.isArray(goals)) return ["goals: needs a goal list"];
  if (goals.length === 0) return ["goals: needs at least one goal"];
  if (goals.length > CHALLENGE_MAX_CHECKS) {
    return [`goals: needs at most ${CHALLENGE_MAX_CHECKS} checks`];
  }
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const goal of goals) {
    if (typeof goal !== "object" || goal === null || Array.isArray(goal)) {
      errors.push("goals: goal is not an object");
      continue;
    }
    const g = goal as Record<string, unknown>;
    if (typeof g.id !== "string" || !CHECK_ID.test(g.id)) {
      errors.push(`goals: goal id ${String(g.id)} is invalid`);
      continue;
    }
    if (ids.has(g.id as string)) errors.push(`goals: duplicate goal id ${g.id}`);
    ids.add(g.id as string);
    if (typeof g.label !== "string" || g.label === "") {
      errors.push(`goals: goal ${g.id} needs a label`);
    }
    if (typeof g.statePath !== "string" || !STATE_PATH.test(g.statePath)) {
      errors.push(`goals: goal ${g.id} has a bad statePath`);
    }
    if (g.comparator !== "eq" && g.comparator !== "ne" && g.comparator !== "gte" && g.comparator !== "lte") {
      errors.push(`goals: goal ${g.id} has a bad comparator`);
    }
    if (typeof g.expected !== "string" && typeof g.expected !== "number" && typeof g.expected !== "boolean") {
      errors.push(`goals: goal ${g.id} needs a JSON scalar`);
    }
    if (g.timing !== "final" && g.timing !== "intermediate") {
      errors.push(`goals: goal ${g.id} has a bad timing`);
    }
  }
  return errors;
}

export interface ChallengeGoalRow {
  id: string;
  label: string;
  passed: boolean;
}

export interface ChallengeGrade {
  /** True only when every goal holds. */
  met: boolean;
  goals: ChallengeGoalRow[];
}

/**
 * Grade one Challenge layout: each goal against the closing World State.
 * Intermediate (survive) goals read the same closing state because the
 * step counter only grows, so reaching N steps and holding N steps agree.
 * Playground Challenges stay Pass-free: no Stars, no Par, no hidden Seeds.
 */
export function gradeChallengeGoals(
  states: WorldSnapshot[],
  goals: PassCheck[],
): ChallengeGrade {
  if (states.length === 0 || goals.length === 0) {
    return { met: false, goals: goals.map((g) => ({ id: g.id, label: g.label, passed: false })) };
  }
  const last = states[states.length - 1];
  const rows = goals.map((goal) => {
    let passed: boolean;
    try {
      const actual = checkOnSnapshot(goal, last);
      passed = actual;
    } catch {
      passed = false;
    }
    return { id: goal.id, label: goal.label, passed };
  });
  return { met: rows.every((r) => r.passed), goals: rows };
}

// ---------------------------------------------------------------------------
// Starter templates (ADR-0014): six worlds with matching starters in both
// languages. A Cadet edits a copy; the template itself never mutates.
// Each starter shows its builder calls in editable code above
// YOUR CODE BELOW, then a short Ship program.
// ---------------------------------------------------------------------------

export interface PlaygroundTemplate {
  id: string;
  title: string;
  /** The one builder idea this template teaches. */
  builderIdea: string;
  /** The one Ship idea this template teaches. */
  shipIdea: string;
  shipColour: PlaygroundShipColour;
  world: AuthoredLayout;
  goals: PassCheck[];
  pythonStarter: string;
  javaStarter: string;
}

const DEFAULT_SHIP_START = { x: 0, y: 0, z: 0, heading: "east" as const, energy: 50 };
const DEFAULT_BOUNDS = { maxX: 12, maxY: 5, maxZ: 12 };

function templateWorld(entities: AuthoredLayout["entities"]): AuthoredLayout {
  return {
    shipStart: { ...DEFAULT_SHIP_START },
    bounds: { ...DEFAULT_BOUNDS },
    entities: entities.map((e) => ({ ...e })) as AuthoredLayout["entities"],
  };
}

export const PLAYGROUND_TEMPLATES: readonly PlaygroundTemplate[] = [
  {
    id: "empty-world",
    title: "Empty World",
    builderIdea: "Builder calls run before step 1: set the Ship start and colour first.",
    shipIdea: "Log a greeting, then move one cell.",
    shipColour: "blue",
    world: templateWorld([]),
    goals: [createSurviveGoal(3)],
    pythonStarter: [
      "# Empty World: no entities. Builder calls run before step 1.",
      'set_ship_start(0, 0, 0, "east")',
      'set_ship_colour("blue")',
      "# YOUR CODE BELOW",
      'log("Hello, Space Coder!")',
      "move()",
      "",
    ].join("\n"),
    javaStarter: [
      "setShipStart(0, 0, 0, \"east\");",
      "setShipColour(\"blue\");",
      "// YOUR CODE BELOW",
      "log(\"Hello, Space Coder!\");",
      "move();",
      "",
    ].join("\n"),
  },
  {
    id: "ring-course",
    title: "Ring Course",
    builderIdea: "One sugar call spawns a ring of eight crystals.",
    shipIdea: "Turn toward the ring, then fly and harvest.",
    shipColour: "gold",
    world: templateWorld([
      { id: "crystal-1", type: "crystal", x: 9, y: 0, z: 6 },
      { id: "crystal-2", type: "crystal", x: 3, y: 0, z: 6 },
      { id: "crystal-3", type: "crystal", x: 6, y: 0, z: 9 },
      { id: "crystal-4", type: "crystal", x: 6, y: 0, z: 3 },
      { id: "crystal-5", type: "crystal", x: 9, y: 0, z: 9 },
      { id: "crystal-6", type: "crystal", x: 9, y: 0, z: 3 },
      { id: "crystal-7", type: "crystal", x: 3, y: 0, z: 9 },
      { id: "crystal-8", type: "crystal", x: 3, y: 0, z: 3 },
    ]),
    goals: [createCollectGoal(3)],
    pythonStarter: [
      "# Ring Course: one sugar call spawns eight crystals.",
      "spawn_crystal_ring(6, 0, 6, 3)",
      'set_ship_start(0, 0, 0, "east")',
      'set_ship_colour("gold")',
      "# YOUR CODE BELOW",
      "move()",
      "move()",
      "move()",
      "turn_left()",
      "move()",
      "move()",
      "move()",
      "harvest()",
      "",
    ].join("\n"),
    javaStarter: [
      "spawnCrystalRing(6, 0, 6, 3);",
      "setShipStart(0, 0, 0, \"east\");",
      "setShipColour(\"gold\");",
      "// YOUR CODE BELOW",
      "move();",
      "move();",
      "move();",
      "turnLeft();",
      "move();",
      "move();",
      "move();",
      "harvest();",
      "",
    ].join("\n"),
  },
  {
    id: "crystal-harvest",
    title: "Crystal Harvest",
    builderIdea: "Spawn crystals and cracked rock; the laser clears cracked rock.",
    shipIdea: "Harvest the lane, laser the cracked rock ahead.",
    shipColour: "red",
    world: templateWorld([
      { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 0 },
      { id: "crystal-2", type: "crystal", x: 4, y: 0, z: 0 },
      { id: "crystal-3", type: "crystal", x: 6, y: 0, z: 0 },
      { id: "crystal-4", type: "crystal", x: 3, y: 0, z: 2 },
      { id: "crystal-5", type: "crystal", x: 5, y: 0, z: 2 },
      { id: "asteroid_cracked-1", type: "asteroid_cracked", x: 5, y: 0, z: 0, present: true },
      { id: "asteroid_cracked-2", type: "asteroid_cracked", x: 7, y: 0, z: 1, present: true },
    ]),
    goals: [createCollectGoal(3)],
    pythonStarter: [
      "# Crystal Harvest: five crystals, two cracked rocks.",
      "spawn_crystal(2, 0, 0)",
      "spawn_crystal(4, 0, 0)",
      "spawn_crystal(6, 0, 0)",
      "spawn_crystal(3, 0, 2)",
      "spawn_crystal(5, 0, 2)",
      "spawn_asteroid_cracked(5, 0, 0)",
      "spawn_asteroid_cracked(7, 0, 1)",
      'set_ship_start(0, 0, 0, "east")',
      'set_ship_colour("red")',
      "# YOUR CODE BELOW",
      "move()",
      "move()",
      "harvest()",
      "move()",
      "move()",
      "harvest()",
      "laser()",
      "move()",
      "move()",
      "harvest()",
      "",
    ].join("\n"),
    javaStarter: [
      "spawnCrystal(2, 0, 0);",
      "spawnCrystal(4, 0, 0);",
      "spawnCrystal(6, 0, 0);",
      "spawnCrystal(3, 0, 2);",
      "spawnCrystal(5, 0, 2);",
      "spawnAsteroidCracked(5, 0, 0);",
      "spawnAsteroidCracked(7, 0, 1);",
      "setShipStart(0, 0, 0, \"east\");",
      "setShipColour(\"red\");",
      "// YOUR CODE BELOW",
      "move();",
      "move();",
      "harvest();",
      "move();",
      "move();",
      "harvest();",
      "laser();",
      "move();",
      "move();",
      "harvest();",
      "",
    ].join("\n"),
  },
  {
    id: "switch-and-gate",
    title: "Switch and Gate",
    builderIdea: "A switch and its gate share one link name.",
    shipIdea: "Land on the switch to open the gate, then harvest behind it.",
    shipColour: "green",
    world: templateWorld([
      { id: "switch-1", type: "switch", x: 4, y: 0, z: 0, linkId: "gate-a" },
      { id: "gate-1", type: "gate", x: 5, y: 0, z: 0, linkId: "gate-a", open: false },
      { id: "crystal-1", type: "crystal", x: 7, y: 0, z: 0 },
    ]),
    goals: [createOpenGateGoal("gate-1")],
    pythonStarter: [
      "# Switch and Gate: one link name pairs the switch with its gate.",
      'spawn_switch(4, 0, 0, "gate-a")',
      'spawn_gate(5, 0, 0, "gate-a")',
      "spawn_crystal(7, 0, 0)",
      'set_ship_start(0, 0, 0, "east")',
      'set_ship_colour("green")',
      "# YOUR CODE BELOW",
      "move()",
      "move()",
      "move()",
      "move()",
      "move()",
      "move()",
      "move()",
      "harvest()",
      "",
    ].join("\n"),
    javaStarter: [
      "spawnSwitch(4, 0, 0, \"gate-a\");",
      "spawnGate(5, 0, 0, \"gate-a\");",
      "spawnCrystal(7, 0, 0);",
      "setShipStart(0, 0, 0, \"east\");",
      "setShipColour(\"green\");",
      "// YOUR CODE BELOW",
      "move();",
      "move();",
      "move();",
      "move();",
      "move();",
      "move();",
      "move();",
      "harvest();",
      "",
    ].join("\n"),
  },
  {
    id: "wormhole-maze",
    title: "Wormhole Maze",
    builderIdea: "One portal call spawns a wormhole pair; walls are titanium.",
    shipIdea: "Fly through the portal, then harvest on the exit side.",
    shipColour: "violet",
    world: templateWorld([
      { id: "asteroid_titanium-1", type: "asteroid_titanium", x: 4, y: 0, z: 0, present: true },
      { id: "asteroid_titanium-2", type: "asteroid_titanium", x: 4, y: 0, z: 1, present: true },
      { id: "asteroid_titanium-3", type: "asteroid_titanium", x: 4, y: 0, z: 3, present: true },
      { id: "asteroid_titanium-4", type: "asteroid_titanium", x: 4, y: 0, z: 4, present: true },
      { id: "wormhole-1", type: "wormhole", x: 3, y: 0, z: 2, pairId: "portal-1" },
      { id: "wormhole-2", type: "wormhole", x: 5, y: 0, z: 2, pairId: "portal-1" },
      { id: "crystal-1", type: "crystal", x: 6, y: 0, z: 2 },
    ]),
    goals: createReachGoal(6, 0, 2),
    pythonStarter: [
      "# Wormhole Maze: titanium walls, one portal pair, crystal past the exit.",
      "spawn_asteroid_titanium(4, 0, 0)",
      "spawn_asteroid_titanium(4, 0, 1)",
      "spawn_asteroid_titanium(4, 0, 3)",
      "spawn_asteroid_titanium(4, 0, 4)",
      "spawn_portal(3, 0, 2, 5, 0, 2)",
      "spawn_crystal(6, 0, 2)",
      'set_ship_start(0, 0, 0, "east")',
      'set_ship_colour("violet")',
      "# YOUR CODE BELOW",
      "turn_left()",
      "move()",
      "move()",
      "turn_right()",
      "move()",
      "move()",
      "move()",
      "move()",
      "harvest()",
      "",
    ].join("\n"),
    javaStarter: [
      "spawnAsteroidTitanium(4, 0, 0);",
      "spawnAsteroidTitanium(4, 0, 1);",
      "spawnAsteroidTitanium(4, 0, 3);",
      "spawnAsteroidTitanium(4, 0, 4);",
      "spawnPortal(3, 0, 2, 5, 0, 2);",
      "spawnCrystal(6, 0, 2);",
      "setShipStart(0, 0, 0, \"east\");",
      "setShipColour(\"violet\");",
      "// YOUR CODE BELOW",
      "turnLeft();",
      "move();",
      "move();",
      "turnRight();",
      "move();",
      "move();",
      "move();",
      "move();",
      "harvest();",
      "",
    ].join("\n"),
  },
  {
    id: "drone-patrol",
    title: "Drone Patrol",
    builderIdea: "Spawn a drone with a patrol axis and crystals around it.",
    shipIdea: "Harvest near a patrolling drone without touching it.",
    shipColour: "white",
    world: templateWorld([
      { id: "drone-1", type: "drone", x: 6, y: 0, z: 3, heading: "east" },
      { id: "crystal-1", type: "crystal", x: 2, y: 0, z: 1 },
      { id: "crystal-2", type: "crystal", x: 4, y: 0, z: 3 },
      { id: "crystal-3", type: "crystal", x: 7, y: 0, z: 1 },
    ]),
    goals: [createCollectGoal(2)],
    pythonStarter: [
      "# Drone Patrol: one drone on an east patrol, three crystals.",
      'spawn_drone(6, 0, 3, "x")',
      "spawn_crystal(2, 0, 1)",
      "spawn_crystal(4, 0, 3)",
      "spawn_crystal(7, 0, 1)",
      'set_ship_start(0, 0, 0, "east")',
      'set_ship_colour("white")',
      "# YOUR CODE BELOW",
      "move()",
      "move()",
      "turn_left()",
      "move()",
      "harvest()",
      "# Two more crystals wait east, Cadet.",
      "",
    ].join("\n"),
    javaStarter: [
      "spawnDrone(6, 0, 3, \"x\");",
      "spawnCrystal(2, 0, 1);",
      "spawnCrystal(4, 0, 3);",
      "spawnCrystal(7, 0, 1);",
      "setShipStart(0, 0, 0, \"east\");",
      "setShipColour(\"white\");",
      "// YOUR CODE BELOW",
      "move();",
      "move();",
      "turnLeft();",
      "move();",
      "harvest();",
      "// Two more crystals wait east, Cadet.",
      "",
    ].join("\n"),
  },
];

/** Find a template by id. */
export function templateById(id: string): PlaygroundTemplate | undefined {
  return PLAYGROUND_TEMPLATES.find((t) => t.id === id);
}

/** Deep copy of a template world: the Cadet edits the copy, never the template. */
export function copyTemplateWorld(template: PlaygroundTemplate): AuthoredLayout {
  return JSON.parse(JSON.stringify(template.world)) as AuthoredLayout;
}

/** Starter code for one language. */
export function templateStarter(
  template: PlaygroundTemplate,
  language: "python" | "java",
): string {
  return language === "python" ? template.pythonStarter : template.javaStarter;
}

// ---------------------------------------------------------------------------
// Share Links: `/playground#c=` plus base64url(deflate(JSON)) (ADR-0014).
// Glossary: Share Link, Creation, Challenge. No server storage, no Account
// needed, no checksum in v1. The total link caps at 2,000 characters.
// Import is all-or-nothing: any rejection fails the whole import with one
// banner line (lib/kid-errors shareLinkBrokenLine), nothing half-loads.
// ---------------------------------------------------------------------------

/** Share Link fragment prefix: `/playground#c=...`. */
export const SHARE_FRAGMENT_PREFIX = "#c=";

/** Total link cap in characters (ADR-0014). */
export const SHARE_LINK_MAX_CHARS = 2000;

/** Share payload version. Unknown versions reject whole. */
export const SHARE_PAYLOAD_VERSION = 1;

/** Starter code cap per language, in characters (ADR-0014). */
export const SHARE_STARTER_MAX = 4000;

export interface ShareStarters {
  python: string;
  java: string;
}

export interface ShareData {
  title: string;
  world: AuthoredLayout;
  goals: PassCheck[];
  starters: ShareStarters;
}

export type ShareEncodeReason = "bad-title" | "bad-starters" | "bad-world" | "bad-goals" | "too-long";

export type ShareEncodeResult =
  | { ok: true; fragment: string }
  | { ok: false; reason: ShareEncodeReason };

export type ShareDecodeReason =
  | "bad-format"
  | "bad-version"
  | "bad-title"
  | "bad-starters"
  | "bad-world"
  | "bad-goals";

export type ShareDecodeResult =
  | { ok: true; data: ShareData }
  | { ok: false; reason: ShareDecodeReason };

function bytesToShareB64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 =
    typeof Buffer !== "undefined" ? Buffer.from(binary, "binary").toString("base64") : btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function shareB64ToBytes(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length === 0) return null;
  let base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) base64 += "=";
  try {
    const binary =
      typeof Buffer !== "undefined" ? Buffer.from(base64, "base64").toString("binary") : atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function isShareStarters(value: unknown): value is ShareStarters {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.python === "string" &&
    typeof s.java === "string" &&
    s.python.length <= SHARE_STARTER_MAX &&
    s.java.length <= SHARE_STARTER_MAX &&
    (s.python.length > 0 || s.java.length > 0)
  );
}

/** Encode a Challenge as a `#c=` fragment. Never emits a truncated link. */
export function encodeShareLink(data: ShareData): ShareEncodeResult {
  if (typeof data.title !== "string" || data.title.length === 0 || data.title.length > CREATION_TITLE_MAX) {
    return { ok: false, reason: "bad-title" };
  }
  if (!isShareStarters(data.starters)) return { ok: false, reason: "bad-starters" };
  if (validateWorldShape(data.world) !== null) return { ok: false, reason: "bad-world" };
  if (validateChallengeGoals(data.goals).length > 0) return { ok: false, reason: "bad-goals" };
  const payload = JSON.stringify({
    v: SHARE_PAYLOAD_VERSION,
    title: data.title,
    world: data.world,
    goals: data.goals,
    starters: data.starters,
  });
  const fragment = `${SHARE_FRAGMENT_PREFIX}${bytesToShareB64(deflateSync(new TextEncoder().encode(payload)))}`;
  if (fragment.length > SHARE_LINK_MAX_CHARS) return { ok: false, reason: "too-long" };
  return { ok: true, fragment };
}

/** Decode a `#c=` fragment back to a Challenge. Any failure rejects whole. */
export function decodeShareLink(input: string): ShareDecodeResult {
  if (typeof input !== "string" || input === "") return { ok: false, reason: "bad-format" };
  const at = input.lastIndexOf(SHARE_FRAGMENT_PREFIX);
  if (at < 0) return { ok: false, reason: "bad-format" };
  const payload = input.slice(at + SHARE_FRAGMENT_PREFIX.length).trim();
  const compressed = shareB64ToBytes(payload);
  if (compressed === null) return { ok: false, reason: "bad-format" };
  let raw: Uint8Array;
  try {
    raw = inflateSync(compressed);
  } catch {
    return { ok: false, reason: "bad-format" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return { ok: false, reason: "bad-format" };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "bad-format" };
  }
  const p = parsed as Record<string, unknown>;
  if (p.v !== SHARE_PAYLOAD_VERSION) return { ok: false, reason: "bad-version" };
  if (typeof p.title !== "string" || p.title.length === 0 || p.title.length > CREATION_TITLE_MAX) {
    return { ok: false, reason: "bad-title" };
  }
  if (!isShareStarters(p.starters)) return { ok: false, reason: "bad-starters" };
  if (validateWorldShape(p.world) !== null) return { ok: false, reason: "bad-world" };
  if (validateChallengeGoals(p.goals).length > 0) return { ok: false, reason: "bad-goals" };
  return {
    ok: true,
    data: {
      title: p.title,
      world: p.world as AuthoredLayout,
      goals: p.goals as PassCheck[],
      starters: p.starters as ShareStarters,
    },
  };
}

export interface SharePreview {
  title: string;
  goalLabels: string[];
  entityCount: number;
  bounds: { maxX: number; maxY: number; maxZ: number };
  languages: Array<"python" | "java">;
}

/**
 * Preview-first landing data: title, goal list, world size, and starter
 * languages. Nothing auto-runs; Start loads the starter and saves a copy.
 */
export function previewShareImport(data: ShareData): SharePreview {
  const languages: Array<"python" | "java"> = [];
  if (data.starters.python !== "") languages.push("python");
  if (data.starters.java !== "") languages.push("java");
  return {
    title: data.title,
    goalLabels: data.goals.map((g) => g.label),
    entityCount: data.world.entities.length,
    bounds: { ...data.world.bounds },
    languages,
  };
}

// ---------------------------------------------------------------------------
// Creations shelf (ADR-0014 extension of the v2 record): max 20 per Cadet.
// Start saves a copy under the shared title; a name clash appends ` copy`.
// At the cap Start blocks with a delete-first message instead of dropping
// the oldest Creation.
// ---------------------------------------------------------------------------

/** True when the shelf holds 20 Creations and Start must block. */
export function isCreationCapFull(progress: ProgressV2): boolean {
  return progress.creations.length >= CREATION_MAX_COUNT;
}

/** One kid sentence for the blocked Start at the 20-Creation cap. */
export function creationCapLine(): string {
  return `The Creation shelf is full at ${CREATION_MAX_COUNT}, Cadet. Delete one first, then start this Challenge.`;
}

/** Copy title with a ` copy` suffix on clash, kept within 40 characters. */
export function resolveCreationTitle(existing: readonly string[], title: string): string {
  if (!existing.includes(title)) return title;
  for (let n = 1; n <= existing.length + 1; n += 1) {
    const candidate = `${title} copy${n > 1 ? ` ${n}` : ""}`.slice(0, CREATION_TITLE_MAX);
    if (!existing.includes(candidate)) return candidate;
  }
  return `${title}`.slice(0, CREATION_TITLE_MAX);
}

export type ShareStartResult =
  | { ok: true; progress: ProgressV2; creation: CreationV2 }
  | { ok: false; reason: "cap-full"; message: string };

/**
 * Start a shared Challenge: save a Creation copy and hand back the
 * updated record with the new Creation. Blocked at the 20-Creation cap.
 */
export function startSharedChallenge(
  progress: ProgressV2,
  data: ShareData,
  at?: string,
): ShareStartResult {
  const clean = sanitizeProgressV2(progress);
  if (isCreationCapFull(clean)) {
    return { ok: false, reason: "cap-full", message: creationCapLine() };
  }
  const before = new Set(clean.creations.map((c) => c.id));
  const next = saveCreationV2(clean, {
    title: resolveCreationTitle(
      clean.creations.map((c) => c.title),
      data.title,
    ),
    world: JSON.parse(JSON.stringify(data.world)) as AuthoredLayout,
    goals: [...data.goals],
    drafts: { python: data.starters.python, java: data.starters.java },
    updatedAt: at,
  });
  const created = next.creations.find((c) => !before.has(c.id));
  // saveCreationV2 only skips on an empty title or bad world, both ruled
  // out by decodeShareLink before Start; treat that corner as blocked.
  if (!created) return { ok: false, reason: "cap-full", message: creationCapLine() };
  return { ok: true, progress: next, creation: created };
}

/** Rename a Creation; the id never changes. Unknown ids pass through. */
export function renameCreationV2(
  progress: ProgressV2,
  id: string,
  title: string,
  at?: string,
): ProgressV2 {
  if (typeof title !== "string" || title.length === 0 || title.length > CREATION_TITLE_MAX) {
    return sanitizeProgressV2(progress);
  }
  const stamp = typeof at === "string" && at !== "" ? at : new Date().toISOString();
  return sanitizeProgressV2({
    ...progress,
    creations: progress.creations.map((c) => (c.id === id ? { ...c, title, updatedAt: stamp } : c)),
  });
}

/** Delete a Creation. Unknown ids pass through. */
export function deleteCreationV2(progress: ProgressV2, id: string): ProgressV2 {
  if (!progress.creations.some((c) => c.id === id)) return sanitizeProgressV2(progress);
  return sanitizeProgressV2({
    ...progress,
    creations: progress.creations.filter((c) => c.id !== id),
  });
}

/** Replace both draft languages of one Creation; unknown ids pass through. */
export function updateCreationDraftsV2(
  progress: ProgressV2,
  id: string,
  drafts: { python?: string; java?: string },
  at?: string,
): ProgressV2 {
  const clean = (value: unknown): string =>
    typeof value === "string" ? value.slice(0, DRAFT_MAX_CHARS) : "";
  const stamp = typeof at === "string" && at !== "" ? at : new Date().toISOString();
  return sanitizeProgressV2({
    ...progress,
    creations: progress.creations.map((c) =>
      c.id === id
        ? {
            ...c,
            drafts: { python: clean(drafts.python), java: clean(drafts.java) },
            updatedAt: stamp,
          }
        : c,
    ),
  });
}
