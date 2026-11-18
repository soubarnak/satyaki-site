// Ship simulation and Seed generation (ADR-0012, pure TS core).
// Glossary: Ship, Ship API, World State, Seed. No framework, DOM, or
// worker imports: instantiable inside either language worker.

/** Compass heading. `north` is +z, `east` is +x. */
export type Heading = "north" | "east" | "south" | "west";

/** Grid sizes: cells run 0..max-1 per axis. */
export interface Bounds {
  maxX: number;
  maxY: number;
  maxZ: number;
}

/** Default 12x12x5 bounds (x 0-11, z 0-11, y 0-4). */
export const DEFAULT_BOUNDS: Bounds = { maxX: 12, maxY: 5, maxZ: 12 };

/** Hard cap: layouts never exceed 16x16x6. */
export const MAX_BOUNDS: Bounds = { maxX: 16, maxY: 6, maxZ: 16 };

export type EntityType =
  | "asteroid_cracked"
  | "asteroid_titanium"
  | "crystal"
  | "switch"
  | "gate"
  | "wormhole"
  | "drone";

export interface ShipStart {
  x: number;
  y: number;
  z: number;
  heading: Heading;
  /** Starting energy from `shipStart`. */
  energy: number;
}

interface EntityBase {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  z: number;
}

/** Declarative layout entity (ADR-0011 shape). */
export type EntityInput =
  | (EntityBase & { type: "asteroid_cracked"; present?: boolean })
  | (EntityBase & { type: "asteroid_titanium"; present?: boolean })
  | (EntityBase & { type: "crystal"; collected?: boolean })
  | (EntityBase & { type: "switch"; on?: boolean; linkId: string })
  | (EntityBase & { type: "gate"; open?: boolean; linkId: string })
  | (EntityBase & { type: "wormhole"; pairId: string })
  | (EntityBase & {
      type: "drone";
      heading: Heading;
      active?: boolean;
    });

export interface AuthoredLayout {
  shipStart: ShipStart;
  bounds: Bounds;
  entities: EntityInput[];
}

/** Live Ship position and meters (no step counter). */
export interface ShipState {
  x: number;
  y: number;
  z: number;
  heading: Heading;
  energy: number;
  shield: boolean;
  crystals: number;
}

/** Ship half of the grader-readable World State snapshot. */
export interface ShipSnapshot extends ShipState {
  stepsUsed: number;
}

export type EntitySnapshot = EntityBase & Record<string, unknown>;

/** Grader-readable World State snapshot (ADR-0012 §snapshot). */
export interface WorldSnapshot {
  ship: ShipSnapshot;
  entities: Record<string, EntitySnapshot>;
  bounds: Bounds;
}

/** Why a Ship action was blocked. */
export type BlockReason = "wall" | "gate" | "blocked" | "energy" | "nothing_here";

/** Per-action trace delta: full Ship state plus changed entity ids. */
export interface ShipDelta {
  action: string;
  blocked: boolean;
  reason?: BlockReason;
  ship: ShipState;
  changed: string[];
}

/** Learner code error frame; wording belongs to lib/kid-errors. */
export interface ErrorFrame {
  kind: "error";
  line: number;
  excType: string;
  message: string;
}

/** Python name -> Java name. Complete v1 table from ADR-0012. */
export const SHIP_NAME_TABLE: Record<string, string> = {
  move: "move",
  turn_left: "turnLeft",
  turn_right: "turnRight",
  ascend: "ascend",
  descend: "descend",
  laser: "laser",
  harvest: "harvest",
  shield: "shield",
  log: "log",
  scan_ahead: "scanAhead",
  distance_ahead: "distanceAhead",
  energy: "energy",
  get_x: "getX",
  get_y: "getY",
  get_z: "getZ",
  heading: "heading",
  crystals: "crystals",
  is_shield_on: "isShieldOn",
  on_crystal: "onCrystal",
};

export const PYTHON_NAMES: readonly string[] = Object.keys(SHIP_NAME_TABLE);
export const JAVA_NAMES: readonly string[] = Object.values(SHIP_NAME_TABLE);

const JAVA_TO_PYTHON: Record<string, string> = Object.fromEntries(
  Object.entries(SHIP_NAME_TABLE).map(([py, js]) => [js, py]),
);

/** Energy cost per paid Ship action, keyed by Python canonical name. */
export const ENERGY_COSTS: Record<string, number> = {
  move: 1,
  turn_left: 1,
  turn_right: 1,
  ascend: 1,
  descend: 1,
  harvest: 1,
  shield: 1,
  laser: 2,
};

const STEP_NAMES = new Set([
  "move",
  "turn_left",
  "turn_right",
  "ascend",
  "descend",
  "laser",
  "harvest",
  "shield",
]);

/** True for Ship step actions; sensors and log cost zero steps. */
export function isStepName(name: string): boolean {
  const canonical = JAVA_TO_PYTHON[name] ?? name;
  return STEP_NAMES.has(canonical);
}

export type ScanResult =
  | "empty"
  | "wall"
  | "asteroid_cracked"
  | "asteroid_titanium"
  | "gate_closed"
  | "gate_open"
  | "drone"
  | "crystal"
  | "switch"
  | "wormhole";

export type CallResult =
  | { ok: true; step: boolean; delta?: ShipDelta; value?: unknown }
  | { ok: false; error: ErrorFrame };

interface DroneState {
  axis: "x" | "z";
}

function assertBounds(bounds: Bounds): void {
  if (
    bounds.maxX < 1 ||
    bounds.maxY < 1 ||
    bounds.maxZ < 1 ||
    bounds.maxX > MAX_BOUNDS.maxX ||
    bounds.maxY > MAX_BOUNDS.maxY ||
    bounds.maxZ > MAX_BOUNDS.maxZ
  ) {
    throw new RangeError(
      `Bounds ${bounds.maxX}x${bounds.maxZ}x${bounds.maxY} outside 1..16x1..16x1..6`,
    );
  }
}

function inBounds(b: Bounds, x: number, y: number, z: number): boolean {
  return x >= 0 && x < b.maxX && y >= 0 && y < b.maxY && z >= 0 && z < b.maxZ;
}

function axisOf(heading: Heading): "x" | "z" {
  return heading === "east" || heading === "west" ? "x" : "z";
}

function reverseOf(heading: Heading): Heading {
  if (heading === "north") return "south";
  if (heading === "south") return "north";
  if (heading === "east") return "west";
  return "east";
}

function stepOf(heading: Heading): { dx: number; dz: number } {
  if (heading === "north") return { dx: 0, dz: 1 };
  if (heading === "south") return { dx: 0, dz: -1 };
  if (heading === "east") return { dx: 1, dz: 0 };
  return { dx: -1, dz: 0 };
}

function leftOf(heading: Heading): Heading {
  if (heading === "north") return "west";
  if (heading === "west") return "south";
  if (heading === "south") return "east";
  return "north";
}

function rightOf(heading: Heading): Heading {
  if (heading === "north") return "east";
  if (heading === "east") return "south";
  if (heading === "south") return "west";
  return "north";
}

function cellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/**
 * One deterministic Ship simulation. Synchronous JSON-shaped methods;
 * instantiable inside either language worker. Sensors and `log` cost
 * zero steps; every other Ship call counts one step and moves drones.
 */
export class ShipSim {
  private ship: ShipState;
  private stepsUsed = 0;
  private readonly bounds: Bounds;
  private readonly entities = new Map<string, EntitySnapshot>();
  private readonly drones = new Map<string, DroneState>();
  private readonly logs: Array<{ line: number; value: unknown }> = [];
  private line = 0;

  constructor(layout: AuthoredLayout) {
    assertBounds(layout.bounds);
    this.bounds = { ...layout.bounds };
    const { x, y, z, heading, energy } = layout.shipStart;
    if (!inBounds(this.bounds, x, y, z)) {
      throw new RangeError("shipStart outside bounds");
    }
    this.ship = { x, y, z, heading, energy, shield: false, crystals: 0 };
    for (const e of layout.entities) {
      if (!inBounds(this.bounds, e.x, e.y, e.z)) {
        throw new RangeError(`Entity ${e.id} outside bounds`);
      }
      this.entities.set(e.id, { ...e } as EntitySnapshot);
      if (e.type === "drone") {
        this.drones.set(e.id, { axis: axisOf(e.heading) });
        const snap = this.entities.get(e.id);
        if (snap && snap["active"] === undefined) snap["active"] = true;
      }
      if (e.type === "asteroid_cracked" || e.type === "asteroid_titanium") {
        const snap = this.entities.get(e.id);
        if (snap && snap["present"] === undefined) snap["present"] = true;
      }
      if (e.type === "crystal") {
        const snap = this.entities.get(e.id);
        if (snap && snap["collected"] === undefined) snap["collected"] = false;
      }
      if (e.type === "switch") {
        const snap = this.entities.get(e.id);
        if (snap && snap["on"] === undefined) snap["on"] = false;
      }
    }
    this.recomputeGates();
  }

  /** Grader-readable World State snapshot. */
  snapshot(): WorldSnapshot {
    const entities: Record<string, EntitySnapshot> = {};
    for (const [id, e] of this.entities) entities[id] = { ...e };
    return {
      ship: { ...this.ship, stepsUsed: this.stepsUsed },
      entities,
      bounds: { ...this.bounds },
    };
  }

  /** Logged `log()` values in call order. */
  getLogs(): Array<{ line: number; value: unknown }> {
    return this.logs.map((l) => ({ ...l }));
  }

  // -- Ship step actions (canonical Python names) --

  move(): ShipDelta {
    const { dx, dz } = stepOf(this.ship.heading);
    return this.step("move", () =>
      this.tryEnter(this.ship.x + dx, this.ship.y, this.ship.z + dz),
    );
  }

  turn_left(): ShipDelta {
    return this.step("turn_left", () => {
      this.ship.heading = leftOf(this.ship.heading);
      return { blocked: false as boolean, changed: [] as string[] };
    });
  }

  turn_right(): ShipDelta {
    return this.step("turn_right", () => {
      this.ship.heading = rightOf(this.ship.heading);
      return { blocked: false as boolean, changed: [] as string[] };
    });
  }

  ascend(): ShipDelta {
    return this.step("ascend", () =>
      this.tryEnter(this.ship.x, this.ship.y + 1, this.ship.z),
    );
  }

  descend(): ShipDelta {
    return this.step("descend", () =>
      this.tryEnter(this.ship.x, this.ship.y - 1, this.ship.z),
    );
  }

  laser(): ShipDelta {
    return this.step("laser", () => {
      const { dx, dz } = stepOf(this.ship.heading);
      const target = this.entityAt(this.ship.x + dx, this.ship.y, this.ship.z + dz);
      if (target?.type === "asteroid_cracked" && target["present"] === true) {
        target["present"] = false;
        return { blocked: false, changed: [target.id] };
      }
      return { blocked: false, changed: [] };
    });
  }

  harvest(): ShipDelta {
    return this.step("harvest", () => {
      const here = this.entityAt(this.ship.x, this.ship.y, this.ship.z);
      if (here?.type === "crystal" && here["collected"] !== true) {
        here["collected"] = true;
        this.ship.crystals += 1;
        return { blocked: false, changed: [here.id] };
      }
      return { blocked: true, reason: "nothing_here", changed: [] };
    });
  }

  shield(): ShipDelta {
    return this.step("shield", () => {
      this.ship.shield = !this.ship.shield;
      return { blocked: false, changed: [] };
    });
  }

  log(value: unknown): unknown {
    this.logs.push({ line: this.line, value });
    return value;
  }

  // -- Java camelCase aliases (same meaning, same argument order) --

  turnLeft(): ShipDelta {
    return this.turn_left();
  }

  turnRight(): ShipDelta {
    return this.turn_right();
  }

  // -- Sensors (free, zero steps, plain JSON scalars) --

  scan_ahead(): ScanResult {
    const { dx, dz } = stepOf(this.ship.heading);
    return this.describe(this.ship.x + dx, this.ship.y, this.ship.z + dz);
  }

  scanAhead(): ScanResult {
    return this.scan_ahead();
  }

  distance_ahead(): number {
    const { dx, dz } = stepOf(this.ship.heading);
    let x = this.ship.x;
    let z = this.ship.z;
    const y = this.ship.y;
    let count = 0;
    for (;;) {
      x += dx;
      z += dz;
      if (this.describe(x, y, z) !== "empty") return count;
      count += 1;
    }
  }

  distanceAhead(): number {
    return this.distance_ahead();
  }

  energy(): number {
    return this.ship.energy;
  }

  get_x(): number {
    return this.ship.x;
  }

  getX(): number {
    return this.ship.x;
  }

  get_y(): number {
    return this.ship.y;
  }

  getY(): number {
    return this.ship.y;
  }

  get_z(): number {
    return this.ship.z;
  }

  getZ(): number {
    return this.ship.z;
  }

  heading(): Heading {
    return this.ship.heading;
  }

  crystals(): number {
    return this.ship.crystals;
  }

  is_shield_on(): boolean {
    return this.ship.shield;
  }

  isShieldOn(): boolean {
    return this.ship.shield;
  }

  on_crystal(): boolean {
    const here = this.entityAt(this.ship.x, this.ship.y, this.ship.z);
    return here?.type === "crystal" && here["collected"] !== true;
  }

  onCrystal(): boolean {
    return this.on_crystal();
  }

  /**
   * Parity dispatch for language workers: validates the 20-name table
   * entry and argument count, then runs the canonical method. Unknown
   * names and wrong counts return a learner error frame; the World
   * State snapshot stays readable.
   */
  call(name: string, args: unknown[], line = 0): CallResult {
    this.line = line;
    const canonical = JAVA_TO_PYTHON[name] ?? name;
    if (!(canonical in SHIP_NAME_TABLE)) {
      return {
        ok: false,
        error: { kind: "error", line, excType: "UnknownShipName", message: `Unknown Ship name: ${name}.` },
      };
    }
    const expected = canonical === "log" ? 1 : 0;
    if (args.length !== expected) {
      return {
        ok: false,
        error: {
          kind: "error",
          line,
          excType: "ArgCount",
          message: `Wrong argument count for ${name}: expected ${expected}, got ${args.length}.`,
        },
      };
    }
    switch (canonical) {
      case "move":
        return { ok: true, step: true, delta: this.move() };
      case "turn_left":
        return { ok: true, step: true, delta: this.turn_left() };
      case "turn_right":
        return { ok: true, step: true, delta: this.turn_right() };
      case "ascend":
        return { ok: true, step: true, delta: this.ascend() };
      case "descend":
        return { ok: true, step: true, delta: this.descend() };
      case "laser":
        return { ok: true, step: true, delta: this.laser() };
      case "harvest":
        return { ok: true, step: true, delta: this.harvest() };
      case "shield":
        return { ok: true, step: true, delta: this.shield() };
      case "log":
        return { ok: true, step: false, value: this.log(args[0]) };
      case "scan_ahead":
        return { ok: true, step: false, value: this.scan_ahead() };
      case "distance_ahead":
        return { ok: true, step: false, value: this.distance_ahead() };
      case "energy":
        return { ok: true, step: false, value: this.energy() };
      case "get_x":
        return { ok: true, step: false, value: this.get_x() };
      case "get_y":
        return { ok: true, step: false, value: this.get_y() };
      case "get_z":
        return { ok: true, step: false, value: this.get_z() };
      case "heading":
        return { ok: true, step: false, value: this.heading() };
      case "crystals":
        return { ok: true, step: false, value: this.crystals() };
      case "is_shield_on":
        return { ok: true, step: false, value: this.is_shield_on() };
      case "on_crystal":
        return { ok: true, step: false, value: this.on_crystal() };
      default:
        return {
          ok: false,
          error: { kind: "error", line, excType: "UnknownShipName", message: `Unknown Ship name: ${name}.` },
        };
    }
  }

  // -- internals --

  private step(
    action: string,
    run: () => { blocked: boolean; reason?: BlockReason; changed: string[] },
  ): ShipDelta {
    const cost = ENERGY_COSTS[action] ?? 0;
    this.stepsUsed += 1;
    if (this.ship.energy < cost) {
      this.patrolDrones();
      return { action, blocked: true, reason: "energy", ship: { ...this.ship }, changed: [] };
    }
    this.ship.energy -= cost;
    const result = run();
    this.patrolDrones();
    return { action, blocked: result.blocked, reason: result.reason, ship: { ...this.ship }, changed: result.changed };
  }

  private entityAt(x: number, y: number, z: number): EntitySnapshot | undefined {
    for (const e of this.entities.values()) {
      if (e.x === x && e.y === y && e.z === z) {
        if (e.type === "asteroid_cracked" || e.type === "asteroid_titanium") {
          if (e["present"] !== true) continue;
        }
        if (e.type === "crystal" && e["collected"] === true) continue;
        if (e.type === "drone" && e["active"] !== true) continue;
        return e;
      }
    }
    return undefined;
  }

  private describe(x: number, y: number, z: number): ScanResult {
    if (!inBounds(this.bounds, x, y, z)) return "wall";
    const e = this.entityAt(x, y, z);
    if (!e) return "empty";
    if (e.type === "asteroid_cracked") return "asteroid_cracked";
    if (e.type === "asteroid_titanium") return "asteroid_titanium";
    if (e.type === "drone") return "drone";
    if (e.type === "crystal") return "crystal";
    if (e.type === "switch") return "switch";
    if (e.type === "wormhole") return "wormhole";
    if (e.type === "gate") return e["open"] === true ? "gate_open" : "gate_closed";
    return "empty";
  }

  private tryEnter(x: number, y: number, z: number): { blocked: boolean; reason?: BlockReason; changed: string[] } {
    if (!inBounds(this.bounds, x, y, z)) {
      return { blocked: true, reason: "wall", changed: [] };
    }
    const e = this.entityAt(x, y, z);
    if (e) {
      if (
        e.type === "asteroid_cracked" ||
        e.type === "asteroid_titanium" ||
        e.type === "drone"
      ) {
        return { blocked: true, reason: "blocked", changed: [] };
      }
      if (e.type === "gate" && e["open"] !== true) {
        return { blocked: true, reason: "gate", changed: [] };
      }
    }
    this.ship.x = x;
    this.ship.y = y;
    this.ship.z = z;
    const landed = this.entityAt(x, y, z);
    if (landed?.type === "wormhole" && typeof landed["pairId"] === "string") {
      const pairId = landed["pairId"] as string;
      for (const other of this.entities.values()) {
        if (other.type === "wormhole" && other.id !== landed.id && other["pairId"] === pairId) {
          this.ship.x = other.x;
          this.ship.y = other.y;
          this.ship.z = other.z;
          break;
        }
      }
    }
    return { blocked: false, changed: this.settleSwitches() };
  }

  private settleSwitches(): string[] {
    const here = this.entityAt(this.ship.x, this.ship.y, this.ship.z);
    if (here?.type !== "switch") return [];
    here["on"] = here["on"] !== true;
    const linkId = here["linkId"] as string;
    const changed = [here.id];
    for (const e of this.entities.values()) {
      if (e.type === "gate" && e["linkId"] === linkId) {
        const open = this.switchOpen(linkId);
        if (e["open"] !== open) {
          e["open"] = open;
          changed.push(e.id);
        }
      }
    }
    return changed;
  }

  private switchOpen(linkId: string): boolean {
    for (const e of this.entities.values()) {
      if (e.type === "switch" && e["linkId"] === linkId && e["on"] === true) return true;
    }
    return false;
  }

  private recomputeGates(): void {
    const linked = new Set<string>();
    for (const e of this.entities.values()) {
      if (e.type === "switch") linked.add(e["linkId"] as string);
    }
    for (const e of this.entities.values()) {
      if (e.type === "gate" && linked.has(e["linkId"] as string)) {
        e["open"] = this.switchOpen(e["linkId"] as string);
      } else if (e.type === "gate" && e["open"] === undefined) {
        e["open"] = false;
      }
    }
  }

  private patrolDrones(): void {
    for (const [id, drone] of this.drones) {
      const e = this.entities.get(id);
      if (!e || e["active"] !== true) continue;
      const heading = e["heading"] as Heading;
      const { dx, dz } = stepOf(heading);
      const nx = e.x + dx;
      const nz = e.z + dz;
      const blocked =
        !inBounds(this.bounds, nx, e.y, nz) ||
        this.droneBlocked(nx, e.y, nz, id);
      if (blocked) {
        e["heading"] = reverseOf(heading);
        drone.axis = axisOf(e["heading"] as Heading);
        continue;
      }
      if (drone.axis === "x") e.x = nx;
      else e.z = nz;
    }
  }

  private droneBlocked(x: number, y: number, z: number, selfId: string): boolean {
    if (this.ship.x === x && this.ship.y === y && this.ship.z === z) return true;
    for (const e of this.entities.values()) {
      if (e.id === selfId || e.x !== x || e.y !== y || e.z !== z) continue;
      if (e.type === "asteroid_cracked" && e["present"] === true) return true;
      if (e.type === "asteroid_titanium" && e["present"] === true) return true;
      if (e.type === "drone" && e["active"] === true) return true;
      if (e.type === "gate" && e["open"] !== true) return true;
    }
    return false;
  }
}

/** Read a `statePath` such as `ship.crystals` off a snapshot. */
export function readStatePath(snapshot: WorldSnapshot, path: string): unknown {
  const parts = path.split(".");
  if (parts[0] === "ship" && parts.length === 2) {
    return (snapshot.ship as unknown as Record<string, unknown>)[parts[1]];
  }
  if (parts[0] === "entities" && parts.length === 3) {
    return (snapshot.entities[parts[1]] as unknown as Record<string, unknown> | undefined)?.[parts[2]];
  }
  return undefined;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneLayout(layout: AuthoredLayout): AuthoredLayout {
  return {
    shipStart: { ...layout.shipStart },
    bounds: { ...layout.bounds },
    entities: layout.entities.map((e) => ({ ...e }) as EntityInput),
  };
}

function isMovable(e: EntityInput): boolean {
  return e.type === "crystal" || e.type === "asteroid_cracked" || e.type === "drone";
}

/**
 * Deterministic Seed generator. The practice Seed returns the authored
 * layout unchanged. Hidden Seeds relocate only crystals, cracked
 * asteroids, and drone starts (patrol axis kept) to random empty cells
 * in bounds. Guarantees: no spawn on the Ship start, no shared cells,
 * no crystal enclosed by titanium on all 6 sides. After 100 failed
 * resamples it falls back to the authored layout with `fellBack: true`
 * for the build test to flag.
 */
export function generateSeedLayout(
  authored: AuthoredLayout,
  seed: number,
  practiceSeed: number,
): { layout: AuthoredLayout; fellBack: boolean } {
  if (seed === practiceSeed) return { layout: cloneLayout(authored), fellBack: false };
  assertBounds(authored.bounds);

  const fixed = authored.entities.filter((e) => !isMovable(e));
  const movables = authored.entities.filter(isMovable);
  const fixedCells = new Set<string>();
  fixedCells.add(cellKey(authored.shipStart.x, authored.shipStart.y, authored.shipStart.z));
  for (const e of fixed) fixedCells.add(cellKey(e.x, e.y, e.z));

  const free: Array<{ x: number; y: number; z: number }> = [];
  for (let x = 0; x < authored.bounds.maxX; x += 1) {
    for (let y = 0; y < authored.bounds.maxY; y += 1) {
      for (let z = 0; z < authored.bounds.maxZ; z += 1) {
        if (!fixedCells.has(cellKey(x, y, z))) free.push({ x, y, z });
      }
    }
  }
  if (free.length < movables.length) {
    return { layout: cloneLayout(authored), fellBack: true };
  }

  const titanium = new Set(
    authored.entities
      .filter((e) => e.type === "asteroid_titanium")
      .map((e) => cellKey(e.x, e.y, e.z)),
  );
  const rng = mulberry32(seed);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const pool = [...free];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const placed = movables.map((e, i) => ({ ...e, ...pool[i] }) as EntityInput);
    let enclosed = false;
    for (const e of placed) {
      if (e.type !== "crystal") continue;
      const neighbours = [
        [e.x + 1, e.y, e.z],
        [e.x - 1, e.y, e.z],
        [e.x, e.y + 1, e.z],
        [e.x, e.y - 1, e.z],
        [e.x, e.y, e.z + 1],
        [e.x, e.y, e.z - 1],
      ].filter(([x, y, z]) => inBounds(authored.bounds, x, y, z));
      if (neighbours.length === 6 && neighbours.every(([x, y, z]) => titanium.has(cellKey(x, y, z)))) {
        enclosed = true;
        break;
      }
    }
    if (!enclosed) {
      return {
        layout: { shipStart: { ...authored.shipStart }, bounds: { ...authored.bounds }, entities: [...fixed.map((e) => ({ ...e }) as EntityInput), ...placed] },
        fellBack: false,
      };
    }
  }
  return { layout: cloneLayout(authored), fellBack: true };
}
