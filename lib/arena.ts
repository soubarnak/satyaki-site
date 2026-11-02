// Arena engine core (ADR-0007 pure core: no framework imports).
// Parses printed robot commands from program output and replays them on
// the straight lane per FR-011: win only when opponent health reaches 0
// within 100 commands. Tuning values are the AS-002 proposal (opponent
// health 40, damage 2, 5 cells apart, stationary opponent) as named
// constants, so the playtest ticket (#7) can retune them in one place.

/** Robot commands the arena understands, printed one per line. */
export type ArenaCommand = "MOVE" | "TURN" | "ATTACK";

/** Win cap from FR-011: the kill must land within this many commands. */
export const ARENA_MAX_COMMANDS = 100;

/** AS-002 tuning: opponent health at battle start. */
export const ARENA_OPPONENT_HEALTH = 40;

/** AS-002 tuning: damage per adjacent facing ATTACK. */
export const ARENA_ATTACK_DAMAGE = 2;

/** AS-002 tuning: cells between Bolt (0) and the stationary opponent. */
export const ARENA_START_DISTANCE = 5;

/** Bolt's lane cell at battle start; the opponent sits at START_DISTANCE. */
export const ARENA_BOLT_START = 0;

/** Absolute lane direction: 1 is east (toward the opponent's start). */
export type ArenaDirection = 1 | -1;

export interface ArenaStep {
  /** The executed command, in submission order. */
  command: ArenaCommand;
  /** 1-based index among executed commands. */
  index: number;
  /** Bolt's lane cell after this command. */
  boltPos: number;
  /** Bolt's absolute facing after this command. */
  boltDir: ArenaDirection;
  /** Damage this command dealt (ATTACK only, else 0). */
  damageDealt: number;
  /** Opponent health after this command, floored at 0. */
  opponentHealth: number;
}

export interface ArenaResult {
  /** True when the opponent reached 0 within the first 100 commands. */
  won: boolean;
  /** Executed recognized commands (capped at 100, stops at the kill). */
  steps: readonly ArenaStep[];
  /** Bolt's lane cell at the end of the replay. */
  finalBoltPos: number;
  /** Opponent health at the end of the replay, floored at 0. */
  finalOpponentHealth: number;
}

function isArenaCommand(line: string): line is ArenaCommand {
  return (
    line === "MOVE" || line === "TURN" || line === "ATTACK"
  );
}

/**
 * Parse printed robot commands from program stdout. One command per line,
 * exact uppercase match after trim; every other printed line is ignored
 * and never counts toward the 100-command cap (FR-011 rule set).
 */
export function parseArenaCommands(stdout: string): ArenaCommand[] {
  const commands: ArenaCommand[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (isArenaCommand(trimmed)) commands.push(trimmed);
  }
  return commands;
}

/**
 * Replay recognized commands in submission order on the lane. Bolt starts
 * at cell 0 facing east; the opponent is stationary at START_DISTANCE.
 * MOVE steps one cell along the facing, TURN reverses it, ATTACK deals
 * damage only when adjacent and facing the opponent. At most the first
 * 100 commands execute; a kill on command 101 or later is a loss.
 */
export function replayArena(commands: readonly ArenaCommand[]): ArenaResult {
  let boltPos = ARENA_BOLT_START;
  let boltDir: ArenaDirection = 1;
  let opponentHealth = ARENA_OPPONENT_HEALTH;
  const opponentPos = ARENA_START_DISTANCE;
  const steps: ArenaStep[] = [];

  const executable = commands.slice(0, ARENA_MAX_COMMANDS);
  for (let i = 0; i < executable.length; i++) {
    const command = executable[i];
    let damageDealt = 0;
    if (command === "MOVE") {
      boltPos += boltDir;
    } else if (command === "TURN") {
      boltDir = boltDir === 1 ? -1 : 1;
    } else {
      const adjacent = Math.abs(boltPos - opponentPos) === 1;
      const facing =
        Math.sign(opponentPos - boltPos) === boltDir;
      if (adjacent && facing) {
        damageDealt = ARENA_ATTACK_DAMAGE;
        opponentHealth = Math.max(0, opponentHealth - damageDealt);
      }
    }
    steps.push({
      command,
      index: i + 1,
      boltPos,
      boltDir,
      damageDealt,
      opponentHealth,
    });
    if (opponentHealth <= 0) break;
  }

  return {
    won: opponentHealth <= 0,
    steps,
    finalBoltPos: boltPos,
    finalOpponentHealth: opponentHealth,
  };
}

/** Parse stdout and replay it in one call (the view's battle path). */
export function runArenaBattle(stdout: string): ArenaResult {
  return replayArena(parseArenaCommands(stdout));
}

