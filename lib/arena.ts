// Arena tick battle engine (ADR-0014, spec §9).
// Glossary: Arena, Ship, World State, Account, Cadet.
// Pure core: no framework, DOM, or worker imports.
//
// Tick function contract: Python `def on_tick(ship, radar):`, Java
// `onTick(ship, radar)`, one call per tick, returns exactly one action
// string. Invalid returns waste the tick; they never stop the run.
// `ship`/`radar` snapshots are read-only; writes fail upstream before
// this engine runs (Cadet Java host guard, Python harness frozen view).
//
// Battle contract: 5 waves, wave n fields n+1 drones at 1 cell per
// max(1,4-n) ticks, shield destroys one drone then drops, laser
// destroys a drone 1 cell ahead at Mission cost, energy refills to 50
// per wave, 200-tick total cap, win is clearing wave 5. Drones spawn at
// the east edge in spaced rows, heading west. The record writes once at
// battle end; an abandoned battle writes nothing (caller owns that).

/** Every action string an `on_tick` tick may return. */
export type ArenaAction =
  | "move"
  | "turn_left"
  | "turn_right"
  | "ascend"
  | "descend"
  | "laser"
  | "harvest"
  | "shield"
  | "wait";

/** All 9 tick actions, in help order. */
export const ARENA_ACTIONS: readonly ArenaAction[] = [
  "move",
  "turn_left",
  "turn_right",
  "ascend",
  "descend",
  "laser",
  "harvest",
  "shield",
  "wait",
];

/** Total tick cap for one battle (ADR-0014). */
export const ARENA_TICK_CAP = 200;
/** Wave count (ADR-0014). */
export const ARENA_WAVES = 5;
/** Energy at battle start and at every wave start (ADR-0014). */
export const ARENA_ENERGY_PER_WAVE = 50;
/** Laser cost mirrors the Mission cost (ADR-0012). */
export const ARENA_LASER_COST = 2;
/** Cost of every 1-energy tick action (ADR-0012). */
export const ARENA_STEP_COST = 1;

/** Arena bounds: the default 12x12x5 world (ADR-0014 builder defaults). */
export const ARENA_BOUNDS = { maxX: 12, maxY: 5, maxZ: 12 } as const;

/** Ship start: west side, middle row, facing the incoming drones. */
export const ARENA_SHIP_START = {
  x: 1,
  y: 0,
  z: 6,
  heading: "east",
  energy: ARENA_ENERGY_PER_WAVE,
} as const;

export type ArenaHeading = "north" | "east" | "south" | "west";

/** Read-only Ship snapshot handed to one tick (ADR-0014). */
export interface ArenaShipSnapshot {
  x: number;
  y: number;
  z: number;
  heading: ArenaHeading;
  energy: number;
  shield: boolean;
  crystals: number;
}

/** Radar snapshot, Python spelling (ADR-0014). */
export interface ArenaRadarSnapshot {
  drone_distance: number;
  drone_direction: string;
  wave: number;
  drones_left: number;
}

/** Radar snapshot, Java camelCase spelling (ADR-0014). */
export interface ArenaRadarSnapshotJava {
  droneDistance: number;
  droneDirection: string;
  wave: number;
  dronesLeft: number;
}

/** One drone in a battle. */
export interface ArenaDrone {
  id: string;
  x: number;
  y: number;
  z: number;
}

/** One battle frame: the tick plus the world after it. */
export interface ArenaFrame {
  /** 1-based tick index. */
  tick: number;
  wave: number;
  /** Raw tick return (before normalisation). */
  action: string | null;
  /** Normalised snake_case action, or null for an invalid return. */
  normalized: ArenaAction | null;
  /** False for invalid returns and code errors (wasted ticks). */
  valid: boolean;
  ship: ArenaShipSnapshot;
  drones: readonly ArenaDrone[];
  dronesLeft: number;
}

export type ArenaStopReason = "win" | "loss" | "cap" | "error";

/** One finished battle. */
export interface ArenaBattleResult {
  won: boolean;
  reason: ArenaStopReason;
  /** Highest wave reached (1-5); 5 on a win. */
  wave: number;
  /** Ticks played (1-200). */
  ticks: number;
  frames: readonly ArenaFrame[];
  /** Code failure that stopped the battle, when reason is error. */
  error?: { line: number; excType: string; message: string };
}

/** Tick function seam: raw action string, or a throw for a code error. */
export type ArenaTickFn = (
  ship: ArenaShipSnapshot,
  radar: ArenaRadarSnapshot,
) => string;

/** Drone count for a wave: wave n fields n+1 drones. */
export function waveDroneCount(wave: number): number {
  return wave + 1;
}

/** Patrol speed: 1 cell per max(1,4-n) ticks. */
export function waveInterval(wave: number): number {
  return Math.max(1, 4 - wave);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/** Spawn wave n at the east edge in spaced rows, heading west. */
export function spawnWave(
  wave: number,
  bounds: { maxX: number; maxY: number; maxZ: number } = ARENA_BOUNDS,
): ArenaDrone[] {
  const count = waveDroneCount(wave);
  const drones: ArenaDrone[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    let z = Math.floor(((i + 0.5) * bounds.maxZ) / count);
    z = clampInt(z, 0, bounds.maxZ - 1);
    while (used.has(z) && used.size < bounds.maxZ) z = (z + 1) % bounds.maxZ;
    used.add(z);
    drones.push({ id: `w${wave}-d${i}`, x: bounds.maxX - 1, y: 0, z });
  }
  return drones;
}

/** Normalise a raw tick return (both Java spellings accepted). */
export function normalizeArenaAction(raw: unknown): {
  action: string | null;
  normalized: ArenaAction | null;
  valid: boolean;
} {
  if (typeof raw !== "string") return { action: null, normalized: null, valid: false };
  const camel = raw === "turnLeft" ? "turn_left" : raw === "turnRight" ? "turn_right" : raw;
  if ((ARENA_ACTIONS as readonly string[]).includes(camel)) {
    return { action: raw, normalized: camel as ArenaAction, valid: true };
  }
  return { action: raw, normalized: null, valid: false };
}

function leftOf(heading: ArenaHeading): ArenaHeading {
  if (heading === "north") return "west";
  if (heading === "west") return "south";
  if (heading === "south") return "east";
  return "north";
}

function rightOf(heading: ArenaHeading): ArenaHeading {
  if (heading === "north") return "east";
  if (heading === "east") return "south";
  if (heading === "south") return "west";
  return "north";
}

function stepOf(heading: ArenaHeading): { dx: number; dz: number } {
  if (heading === "north") return { dx: 0, dz: 1 };
  if (heading === "south") return { dx: 0, dz: -1 };
  if (heading === "east") return { dx: 1, dz: 0 };
  return { dx: -1, dz: 0 };
}

/**
 * Relative bearing of the nearest drone: ahead/left/right/behind on the
 * ship's plane, above/below when the height differs, here on contact,
 * none when no drones remain.
 */
export function droneDirectionFor(
  ship: Pick<ArenaShipSnapshot, "x" | "y" | "z" | "heading">,
  target: Pick<ArenaDrone, "x" | "y" | "z"> | null,
): string {
  if (!target) return "none";
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const dz = target.z - ship.z;
  if (dx === 0 && dy === 0 && dz === 0) return "here";
  if (dy !== 0) return dy > 0 ? "above" : "below";
  const { dx: fx, dz: fz } = stepOf(ship.heading);
  const forward = dx * fx + dz * fz;
  const rightward = dx * fz - dz * fx;
  if (rightward === 0) return forward >= 0 ? "ahead" : "behind";
  if (forward === 0) return rightward > 0 ? "right" : "left";
  return Math.abs(rightward) > Math.abs(forward)
    ? rightward > 0
      ? "right"
      : "left"
    : forward > 0
      ? "ahead"
      : "behind";
}

function nearestDrone(
  ship: ArenaShipSnapshot,
  drones: readonly ArenaDrone[],
): ArenaDrone | null {
  let best: ArenaDrone | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const drone of drones) {
    const dist =
      Math.abs(drone.x - ship.x) + Math.abs(drone.y - ship.y) + Math.abs(drone.z - ship.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = drone;
    }
  }
  return best;
}

/** Ship snapshot handed to one tick (a copy; ticks never mutate it). */
export function shipSnapshotFor(ship: ArenaShipSnapshot): ArenaShipSnapshot {
  return { ...ship };
}

/** Radar snapshot, Python snake_case spelling. */
export function radarSnapshotFor(
  ship: ArenaShipSnapshot,
  drones: readonly ArenaDrone[],
  wave: number,
): ArenaRadarSnapshot {
  const near = nearestDrone(ship, drones);
  const distance =
    near === null
      ? 0
      : Math.abs(near.x - ship.x) + Math.abs(near.y - ship.y) + Math.abs(near.z - ship.z);
  return {
    drone_distance: distance,
    drone_direction: droneDirectionFor(ship, near),
    wave,
    drones_left: drones.length,
  };
}

/** Radar snapshot, Java camelCase spelling. */
export function radarSnapshotForJava(
  ship: ArenaShipSnapshot,
  drones: readonly ArenaDrone[],
  wave: number,
): ArenaRadarSnapshotJava {
  const radar = radarSnapshotFor(ship, drones, wave);
  return {
    droneDistance: radar.drone_distance,
    droneDirection: radar.drone_direction,
    wave: radar.wave,
    dronesLeft: radar.drones_left,
  };
}

interface BattleState {
  ship: ArenaShipSnapshot;
  drones: ArenaDrone[];
  wave: number;
  ticksInWave: number;
}

/** Ship cell ahead in the facing direction (laser target). */
function cellAhead(ship: ArenaShipSnapshot): { x: number; y: number; z: number } {
  const { dx, dz } = stepOf(ship.heading);
  return { x: ship.x + dx, y: ship.y, z: ship.z + dz };
}

function droneAt(
  drones: ArenaDrone[],
  x: number,
  y: number,
  z: number,
): number {
  return drones.findIndex((d) => d.x === x && d.y === y && d.z === z);
}

/**
 * Run one battle to win, loss, cap, or code error. The tick function
 * receives a fresh snapshot copy per tick; a throw stops the battle as
 * an error (loss, never a win). Abandoned battles are the caller's duty:
 * only a finished result should reach the progress record.
 */
export function runArenaBattle(tickFn: ArenaTickFn): ArenaBattleResult {
  const bounds = ARENA_BOUNDS;
  const state: BattleState = {
    ship: {
      x: ARENA_SHIP_START.x,
      y: ARENA_SHIP_START.y,
      z: ARENA_SHIP_START.z,
      heading: ARENA_SHIP_START.heading,
      energy: ARENA_ENERGY_PER_WAVE,
      shield: false,
      crystals: 0,
    },
    drones: spawnWave(1, bounds),
    wave: 1,
    ticksInWave: 0,
  };
  const frames: ArenaFrame[] = [];

  for (let tick = 1; tick <= ARENA_TICK_CAP; tick += 1) {
    state.ticksInWave += 1;
    const shipSnap = shipSnapshotFor(state.ship);
    const radar = radarSnapshotFor(state.ship, state.drones, state.wave);

    let raw: string | null = null;
    let normalized: ArenaAction | null = null;
    let valid = false;
    try {
      raw = tickFn(shipSnap, radar);
      const parsed = normalizeArenaAction(raw);
      raw = parsed.action;
      normalized = parsed.normalized;
      valid = parsed.valid;
    } catch (error) {
      const frame: ArenaFrame = {
        tick,
        wave: state.wave,
        action: null,
        normalized: null,
        valid: false,
        ship: { ...state.ship },
        drones: state.drones.map((d) => ({ ...d })),
        dronesLeft: state.drones.length,
      };
      frames.push(frame);
      const detail =
        error !== null && typeof error === "object"
          ? (error as { line?: unknown; excType?: unknown; message?: unknown })
          : {};
      const line = typeof detail.line === "number" && Number.isInteger(detail.line) ? detail.line : 0;
      return {
        won: false,
        reason: "error",
        wave: state.wave,
        ticks: tick,
        frames,
        error: {
          line,
          excType: typeof detail.excType === "string" ? detail.excType : "RuntimeError",
          message: typeof detail.message === "string" ? detail.message.slice(0, 300) : String(error).slice(0, 300),
        },
      };
    }

    if (valid && normalized !== null) {
      applyAction(state, normalized, bounds);
      if (shipDestroyed(state)) {
        frames.push(pushFrame(tick, state, raw, normalized, true));
        return { won: false, reason: "loss", wave: state.wave, ticks: tick, frames };
      }
      if (state.drones.length === 0) {
        frames.push(pushFrame(tick, state, raw, normalized, true));
        if (state.wave >= ARENA_WAVES) {
          return { won: true, reason: "win", wave: ARENA_WAVES, ticks: tick, frames };
        }
        state.wave += 1;
        state.ship.energy = ARENA_ENERGY_PER_WAVE;
        state.drones = spawnWave(state.wave, bounds);
        state.ticksInWave = 0;
        continue;
      }
    } else {
      frames.push(pushFrame(tick, state, raw, normalized, false));
    }

    if (state.ticksInWave % waveInterval(state.wave) === 0) {
      patrolDrones(state);
      if (shipDestroyed(state)) {
        const last = frames[frames.length - 1];
        if (last !== undefined && last.tick === tick) {
          last.ship = { ...state.ship };
          last.drones = state.drones.map((d) => ({ ...d }));
          last.dronesLeft = state.drones.length;
        } else {
          frames.push(pushFrame(tick, state, raw, normalized, valid));
        }
        return { won: false, reason: "loss", wave: state.wave, ticks: tick, frames };
      }
      const last = frames[frames.length - 1];
      if (state.drones.length === 0) {
        if (last !== undefined && last.tick === tick) {
          last.ship = { ...state.ship };
          last.drones = [];
          last.dronesLeft = 0;
        } else {
          frames.push(pushFrame(tick, state, raw, normalized, valid));
        }
        if (state.wave >= ARENA_WAVES) {
          return { won: true, reason: "win", wave: ARENA_WAVES, ticks: tick, frames };
        }
        state.wave += 1;
        state.ship.energy = ARENA_ENERGY_PER_WAVE;
        state.drones = spawnWave(state.wave, bounds);
        state.ticksInWave = 0;
        continue;
      }
      if (last === undefined || last.tick !== tick) {
        frames.push(pushFrame(tick, state, raw, normalized, valid));
      } else {
        last.ship = { ...state.ship };
        last.drones = state.drones.map((d) => ({ ...d }));
        last.dronesLeft = state.drones.length;
      }
    } else if (frames.length === 0 || frames[frames.length - 1]?.tick !== tick) {
      frames.push(pushFrame(tick, state, raw, normalized, valid));
    }
  }

  return { won: false, reason: "cap", wave: state.wave, ticks: ARENA_TICK_CAP, frames };
}

function pushFrame(
  tick: number,
  state: BattleState,
  action: string | null,
  normalized: ArenaAction | null,
  valid: boolean,
): ArenaFrame {
  return {
    tick,
    wave: state.wave,
    action,
    normalized,
    valid,
    ship: { ...state.ship },
    drones: state.drones.map((d) => ({ ...d })),
    dronesLeft: state.drones.length,
  };
}

/** True when a drone shares the Ship cell and no shield absorbed it. */
function shipDestroyed(state: BattleState): boolean {
  const hit = droneAt(state.drones, state.ship.x, state.ship.y, state.ship.z);
  if (hit === -1) return false;
  if (state.ship.shield) {
    state.drones.splice(hit, 1);
    state.ship.shield = false;
    return false;
  }
  return true;
}

function patrolDrones(state: BattleState): void {
  for (const drone of state.drones) {
    drone.x = Math.max(0, drone.x - 1);
  }
  const hit = droneAt(state.drones, state.ship.x, state.ship.y, state.ship.z);
  if (hit !== -1 && state.ship.shield) {
    state.drones.splice(hit, 1);
    state.ship.shield = false;
  }
}

/** Apply one valid tick action; blocked or unaffordable actions waste the tick. */
function applyAction(
  state: BattleState,
  action: ArenaAction,
  bounds: { maxX: number; maxY: number; maxZ: number },
): void {
  const ship = state.ship;
  switch (action) {
    case "wait":
      return;
    case "shield":
      if (ship.energy < ARENA_STEP_COST) return;
      ship.energy -= ARENA_STEP_COST;
      ship.shield = true;
      return;
    case "laser":
      if (ship.energy < ARENA_LASER_COST) return;
      ship.energy -= ARENA_LASER_COST;
      {
        const target = cellAhead(ship);
        const hit = droneAt(state.drones, target.x, target.y, target.z);
        if (hit !== -1) state.drones.splice(hit, 1);
      }
      return;
    case "turn_left":
      if (ship.energy < ARENA_STEP_COST) return;
      ship.energy -= ARENA_STEP_COST;
      ship.heading = leftOf(ship.heading);
      return;
    case "turn_right":
      if (ship.energy < ARENA_STEP_COST) return;
      ship.energy -= ARENA_STEP_COST;
      ship.heading = rightOf(ship.heading);
      return;
    case "move":
    case "ascend":
    case "descend":
    case "harvest": {
      if (ship.energy < ARENA_STEP_COST) return;
      ship.energy -= ARENA_STEP_COST;
      if (action === "harvest") return;
      let next = { x: ship.x, y: ship.y, z: ship.z };
      if (action === "move") {
        const { dx, dz } = stepOf(ship.heading);
        next = { x: ship.x + dx, y: ship.y, z: ship.z + dz };
      } else if (action === "ascend") {
        next = { x: ship.x, y: ship.y + 1, z: ship.z };
      } else {
        next = { x: ship.x, y: ship.y - 1, z: ship.z };
      }
      if (
        next.x < 0 ||
        next.x >= bounds.maxX ||
        next.y < 0 ||
        next.y >= bounds.maxY ||
        next.z < 0 ||
        next.z >= bounds.maxZ
      ) {
        return;
      }
      ship.x = next.x;
      ship.y = next.y;
      ship.z = next.z;
      const hit = droneAt(state.drones, ship.x, ship.y, ship.z);
      if (hit !== -1 && ship.shield) {
        state.drones.splice(hit, 1);
        ship.shield = false;
      }
      return;
    }
  }
}

/** Async tick seam for worker-backed battles (Python/Java runners). */
export type ArenaAsyncTickFn = (
  ship: ArenaShipSnapshot,
  radar: ArenaRadarSnapshot,
) => Promise<string>;

/**
 * Worker-backed battle: same rules as runArenaBattle, one awaited tick
 * at a time. A throw stops the battle as an error. When `cancelled`
 * flips mid-battle the run stops at once with no result (abandoned
 * battles write nothing; the caller records nothing for null).
 */
export async function runArenaBattleAsync(
  tickFn: ArenaAsyncTickFn,
  cancelled?: { cancelled: boolean },
): Promise<ArenaBattleResult | null> {
  const bounds = ARENA_BOUNDS;
  const state: BattleState = {
    ship: {
      x: ARENA_SHIP_START.x,
      y: ARENA_SHIP_START.y,
      z: ARENA_SHIP_START.z,
      heading: ARENA_SHIP_START.heading,
      energy: ARENA_ENERGY_PER_WAVE,
      shield: false,
      crystals: 0,
    },
    drones: spawnWave(1, bounds),
    wave: 1,
    ticksInWave: 0,
  };
  const frames: ArenaFrame[] = [];

  for (let tick = 1; tick <= ARENA_TICK_CAP; tick += 1) {
    if (cancelled?.cancelled === true) return null;
    state.ticksInWave += 1;
    const shipSnap = shipSnapshotFor(state.ship);
    const radar = radarSnapshotFor(state.ship, state.drones, state.wave);

    let raw: string | null = null;
    let normalized: ArenaAction | null = null;
    let valid = false;
    try {
      raw = await tickFn(shipSnap, radar);
      const parsed = normalizeArenaAction(raw);
      raw = parsed.action;
      normalized = parsed.normalized;
      valid = parsed.valid;
    } catch (error) {
      frames.push({
        tick,
        wave: state.wave,
        action: null,
        normalized: null,
        valid: false,
        ship: { ...state.ship },
        drones: state.drones.map((d) => ({ ...d })),
        dronesLeft: state.drones.length,
      });
      const detail =
        error !== null && typeof error === "object"
          ? (error as { line?: unknown; excType?: unknown; message?: unknown })
          : {};
      const line = typeof detail.line === "number" && Number.isInteger(detail.line) ? detail.line : 0;
      return {
        won: false,
        reason: "error",
        wave: state.wave,
        ticks: tick,
        frames,
        error: {
          line,
          excType: typeof detail.excType === "string" ? detail.excType : "RuntimeError",
          message: typeof detail.message === "string" ? detail.message.slice(0, 300) : String(error).slice(0, 300),
        },
      };
    }

    if (valid && normalized !== null) {
      applyAction(state, normalized, bounds);
      if (shipDestroyed(state)) {
        frames.push(pushFrame(tick, state, raw, normalized, true));
        return { won: false, reason: "loss", wave: state.wave, ticks: tick, frames };
      }
      if (state.drones.length === 0) {
        frames.push(pushFrame(tick, state, raw, normalized, true));
        if (state.wave >= ARENA_WAVES) {
          return { won: true, reason: "win", wave: ARENA_WAVES, ticks: tick, frames };
        }
        state.wave += 1;
        state.ship.energy = ARENA_ENERGY_PER_WAVE;
        state.drones = spawnWave(state.wave, bounds);
        state.ticksInWave = 0;
        continue;
      }
    } else {
      frames.push(pushFrame(tick, state, raw, normalized, false));
    }

    if (state.ticksInWave % waveInterval(state.wave) === 0) {
      patrolDrones(state);
      if (shipDestroyed(state)) {
        const last = frames[frames.length - 1];
        if (last !== undefined && last.tick === tick) {
          last.ship = { ...state.ship };
          last.drones = state.drones.map((d) => ({ ...d }));
          last.dronesLeft = state.drones.length;
        } else {
          frames.push(pushFrame(tick, state, raw, normalized, valid));
        }
        return { won: false, reason: "loss", wave: state.wave, ticks: tick, frames };
      }
      const last = frames[frames.length - 1];
      if (state.drones.length === 0) {
        if (last !== undefined && last.tick === tick) {
          last.ship = { ...state.ship };
          last.drones = [];
          last.dronesLeft = 0;
        } else {
          frames.push(pushFrame(tick, state, raw, normalized, valid));
        }
        if (state.wave >= ARENA_WAVES) {
          return { won: true, reason: "win", wave: ARENA_WAVES, ticks: tick, frames };
        }
        state.wave += 1;
        state.ship.energy = ARENA_ENERGY_PER_WAVE;
        state.drones = spawnWave(state.wave, bounds);
        state.ticksInWave = 0;
        continue;
      }
      if (last === undefined || last.tick !== tick) {
        frames.push(pushFrame(tick, state, raw, normalized, valid));
      } else {
        last.ship = { ...state.ship };
        last.drones = state.drones.map((d) => ({ ...d }));
        last.dronesLeft = state.drones.length;
      }
    } else if (frames.length === 0 || frames[frames.length - 1]?.tick !== tick) {
      frames.push(pushFrame(tick, state, raw, normalized, valid));
    }
  }

  return { won: false, reason: "cap", wave: state.wave, ticks: ARENA_TICK_CAP, frames };
}

// --- Cockpit-model replay over battle frames ---

/** Battle header for the replay: initial world plus bounds. */
export function arenaHeader(): {
  initial: { ship: ArenaShipSnapshot; drones: readonly ArenaDrone[] };
  bounds: { maxX: number; maxY: number; maxZ: number };
} {
  return {
    initial: {
      ship: {
        x: ARENA_SHIP_START.x,
        y: ARENA_SHIP_START.y,
        z: ARENA_SHIP_START.z,
        heading: ARENA_SHIP_START.heading,
        energy: ARENA_ENERGY_PER_WAVE,
        shield: false,
        crystals: 0,
      },
      drones: spawnWave(1, ARENA_BOUNDS),
    },
    bounds: { ...ARENA_BOUNDS },
  };
}

/** World at a cursor: the frame snapshot, or the header before tick 1. */
export function arenaWorldAt(
  frames: readonly ArenaFrame[],
  cursor: number,
): { ship: ArenaShipSnapshot; drones: readonly ArenaDrone[]; wave: number } {
  if (frames.length === 0 || cursor < 0) {
    const header = arenaHeader();
    return { ship: { ...header.initial.ship }, drones: header.initial.drones, wave: 1 };
  }
  const frame = frames[Math.min(cursor, frames.length - 1)];
  return { ship: { ...frame.ship }, drones: frame.drones.map((d) => ({ ...d })), wave: frame.wave };
}

/** Ticks that ran a real Ship action (gold ticks on the scrubber). */
export function arenaStepTicks(frames: readonly ArenaFrame[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (frame.valid && frame.normalized !== null && frame.normalized !== "wait") out.push(i);
  }
  return out;
}

/** HUD line: tick/wave pose, never colour alone. */
export function arenaHudLabel(
  world: { ship: ArenaShipSnapshot; drones: readonly ArenaDrone[]; wave: number },
  cursor: number,
  total: number,
): string {
  const ship = world.ship;
  const tickText = total === 0 ? "tick —" : `tick ${Math.max(cursor, 0) + 1}/${total}`;
  return (
    `Ship x=${ship.x} y=${ship.y} z=${ship.z} facing ${ship.heading} ` +
    `energy ${ship.energy} shield ${ship.shield ? "on" : "off"} ` +
    `wave ${world.wave}/5 drones ${world.drones.length} ${tickText}`
  );
}
