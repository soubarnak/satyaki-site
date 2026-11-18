// Mission cockpit playback core (issue #69, spec §§3-4, issue #44 Variant A).
// Glossary: Mission, Ship, World State, Seed, Pass. Pure core: no
// framework, DOM, or worker imports. Frame = one executed line, exactly the
// worker trace event shape both runtimes emit. World State at any frame is
// a pure re-fold of Ship deltas from the run header; step-back stores no
// undo state. Cameras are manual only: Top-down (default), Chase, Free
// orbit, no auto-switching.

import { ShipSim, type AuthoredLayout, type Bounds, type WorldSnapshot } from "./ship-sim";

export const PLAYBACK_FRAME_MS = 650;

export type PlaybackSpeed = 1 | 2 | 4;

export type PlaybackCamera = "top" | "chase" | "orbit";

export interface PlaybackShip {
  x: number;
  y: number;
  z: number;
  heading: string;
  energy: number;
  shield: boolean;
  crystals: number;
}

export interface PlaybackDelta {
  action: string;
  blocked: boolean;
  reason?: string;
  ship: PlaybackShip;
  changed: string[];
}

export interface PlaybackEvent {
  step: number;
  line: number;
  kind: "line";
  locals: Record<string, unknown>;
  shipDelta: PlaybackDelta | null;
  log?: string;
}

export interface PlaybackHeader {
  initial: {
    ship: PlaybackShip;
    entities: Record<string, Record<string, unknown>>;
  };
  bounds: Bounds;
}

export interface PlaybackWorld {
  ship: PlaybackShip;
  entities: Record<string, Record<string, unknown>>;
  bounds: Bounds;
}

/** Delay per frame at a playback speed. 1x is 650 ms per frame. */
export function speedDelayMs(speed: PlaybackSpeed): number {
  return PLAYBACK_FRAME_MS / speed;
}

/** True for a Ship-step frame (gold tick on the scrubber). */
export function isShipStep(event: PlaybackEvent): boolean {
  return event.shipDelta !== null;
}

/** Indices of Ship-step frames, in trace order, for gold ticks. */
export function shipStepIndices(trace: readonly PlaybackEvent[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < trace.length; i += 1) {
    if (trace[i].shipDelta !== null) out.push(i);
  }
  return out;
}

/**
 * World State at a cursor. Cursor -1 is reset (before line 1): the run
 * header unchanged. Otherwise fold every Ship delta up to the cursor, so
 * stepping back re-folds from the start with no stored undo.
 */
export function playbackWorldAt(
  header: PlaybackHeader,
  trace: readonly PlaybackEvent[],
  cursor: number,
): PlaybackWorld {
  const entities: Record<string, Record<string, unknown>> = {};
  for (const [id, entity] of Object.entries(header.initial.entities)) {
    entities[id] = { ...entity };
  }
  let ship: PlaybackShip = { ...header.initial.ship };
  const last = Math.min(cursor, trace.length - 1);
  for (let i = 0; i <= last; i += 1) {
    const delta = trace[i].shipDelta;
    if (delta === null) continue;
    ship = { ...delta.ship };
  }
  return { ship, entities, bounds: { ...header.bounds } };
}

/** Lines executed up to a cursor, for editor highlight including re-hits. */
export function executedLines(trace: readonly PlaybackEvent[], cursor: number): Set<number> {
  const out = new Set<number>();
  const last = Math.min(cursor, trace.length - 1);
  for (let i = 0; i <= last; i += 1) out.add(trace[i].line);
  return out;
}

/** HUD line: Ship pose, meters, event/step/line position. Text, never colour alone. */
export function hudLabel(
  world: PlaybackWorld,
  cursor: number,
  total: number,
  event: PlaybackEvent | null,
): string {
  const ship = world.ship;
  const eventText = total === 0 ? "event —" : `event ${Math.max(cursor, 0) + 1}/${total}`;
  const stepText = `step ${event?.step ?? 0}`;
  const lineText = `line ${event?.line ?? "—"}`;
  return (
    `Ship x=${ship.x} y=${ship.y} z=${ship.z} facing ${ship.heading} ` +
    `energy ${ship.energy} crystals ${ship.crystals} ${eventText} ${stepText} ${lineText}`
  );
}

function entitySummary(entity: Record<string, unknown>): string {
  const type = typeof entity["type"] === "string" ? (entity["type"] as string) : "entity";
  if (type === "crystal") {
    return entity["collected"] === true ? "crystal (collected)" : "crystal";
  }
  if (type === "asteroid_cracked") {
    return entity["present"] === false ? "broken asteroid" : "cracked asteroid (laser can break)";
  }
  if (type === "asteroid_titanium") return "titanium asteroid (laser-proof)";
  if (type === "switch") return `switch (${entity["on"] === true ? "on" : "off"})`;
  if (type === "gate") return `gate (${entity["open"] === true ? "open" : "closed"})`;
  if (type === "wormhole") return "wormhole";
  if (type === "drone") return "drone";
  return type;
}

/** Hover text for one square: coordinates, occupant, height. */
export function inspectSquare(
  world: PlaybackWorld,
  square: { x: number; z: number },
): string {
  const occupant = Object.values(world.entities).find(
    (entity) => entity["x"] === square.x && entity["z"] === square.z && entity["present"] !== false,
  );
  const shipHere = world.ship.x === square.x && world.ship.z === square.z;
  const parts: string[] = [`Square (${square.x}, ${square.z}):`];
  if (shipHere) parts.push(`Ship here, facing ${world.ship.heading}.`);
  parts.push(occupant ? entitySummary(occupant) : "empty space");
  parts.push("height y=0");
  return parts.join(" ");
}

/**
 * Full World State at a cursor by replaying Ship actions from the Seed
 * layout through the deterministic sim. Entity changes (harvest, laser,
 * switches) land exactly; blocked moves spend but never move. Used by the
 * simulator so hover inspection sees collected/open states.
 */
export function replayWorldFromLayout(
  layout: AuthoredLayout,
  trace: readonly PlaybackEvent[],
  cursor: number,
): WorldSnapshot {
  const sim = new ShipSim(layout);
  const last = Math.min(cursor, trace.length - 1);
  for (let i = 0; i <= last; i += 1) {
    const delta = trace[i].shipDelta;
    if (delta === null) continue;
    const replayed = sim.call(delta.action, [], trace[i].line);
    if (!replayed.ok) break;
  }
  return sim.snapshot();
}

/** Clamp a cursor to the reset-to-last range. */
export function clampCursor(cursor: number, total: number): number {
  if (total <= 0) return -1;
  if (cursor < -1) return -1;
  if (cursor > total - 1) return total - 1;
  return cursor;
}
