// Arena view core (ADR-0014, spec §9).
// Glossary: Arena, Account, Cadet, Ship, World State.
// Pure core: no framework imports. Tick replay math stays in
// lib/arena.ts; the component owns step animation and the single
// end-of-battle record write. Abandoned battles write nothing.

import { translateKidError, type KidErrorFrame, type KidLanguage } from "./kid-errors";
import type { ArenaBattleResult } from "./arena";

/** Sign-in prompt: logged-out Cadets never get a guest battle (ADR-0014). */
export const ARENA_SIGN_IN_LINE =
  "The Arena needs an Account, Cadet. Ask your grown-up to sign in, then fly.";

/** Starter: Python tick with the radar example in comments. */
export const ARENA_PYTHON_STARTER = `def on_tick(ship, radar):
    # ship: x, y, z, heading, energy, shield, crystals (read-only)
    # radar: drone_distance, drone_direction, wave, drones_left (read-only)
    # return exactly one action string per tick
    # example: if radar.drone_distance == 0: return "shield"
    return "wait"
`;

/** Starter: Java tick, always full-scaffold (ADR-0014). */
export const ARENA_JAVA_STARTER = `public class Main {
    public String onTick(Ship ship, Radar radar) {
        // ship: x, y, z, heading, energy, shield, crystals (read-only)
        // radar: droneDistance, droneDirection, wave, dronesLeft (read-only)
        // return exactly one action string per tick
        // example: if (radar.droneDistance == 0) { return "shield"; }
        return "wait";
    }
}
`;

/** Tick actions shown beside the editor. */
export const ARENA_COMMANDS: readonly { command: string; meaning: string }[] = [
  { command: "move", meaning: "Fly one cell along the facing." },
  { command: "turn_left", meaning: "Turn left in place." },
  { command: "turn_right", meaning: "Turn right in place." },
  { command: "ascend", meaning: "Climb one cell." },
  { command: "descend", meaning: "Dive one cell." },
  { command: "laser", meaning: "Break the drone one cell ahead (2 energy)." },
  { command: "harvest", meaning: "No crystals here; wastes energy." },
  { command: "shield", meaning: "Raise the shield; it stops one drone, then drops." },
  { command: "wait", meaning: "Hold position this tick." },
];

/** True when the Arena may run: the Cadet is signed in (Account gate). */
export function arenaAccountOpen(session: { loggedIn: boolean }): boolean {
  return session.loggedIn === true;
}

export type ArenaErrorKind = "code-error" | "runner-problem";

export interface ArenaErrorFeedback {
  kind: ArenaErrorKind;
  /** Child-readable line, always shown first. */
  boltLine: string;
  /** Raw runner text shown after the child line, never before it. */
  rawError: string;
}

/**
 * Child-first verdict line for a finished battle. Win names the tick
 * count; losses name the wave and tick; the cap names the 200 limit.
 */
export function arenaBattleLine(result: ArenaBattleResult): string {
  if (result.won) {
    return `Victory, Cadet. You cleared wave 5 in ${result.ticks} ticks!`;
  }
  if (result.reason === "cap") {
    return `The 200-tick cap held, Cadet. You reached wave ${result.wave}. Fly again.`;
  }
  if (result.reason === "error") {
    return "Your tick program stopped, Cadet. Read the line it names, then fly again.";
  }
  if (result.ticks <= 0 || result.frames.length === 0) {
    return "No ticks flew, Cadet. Return one action from on_tick, then fly again.";
  }
  return `Defeat at wave ${result.wave}, tick ${result.ticks}, Cadet. Shield once, laser ahead, fly again.`;
}

/** Kid sentence for a tick code failure (per-tick error frame). */
export function arenaTickErrorLine(
  frame: { line: number; excType: string; message: string },
  language: KidLanguage,
): string {
  const kidFrame: KidErrorFrame = { line: frame.line, excType: frame.excType, message: frame.message };
  return translateKidError(kidFrame, language);
}

/**
 * True only for a finished battle the record may keep: a win, loss, or
 * cap writes once; an abandoned battle (unmounted, navigated away,
 * never pressed Run) writes nothing (ADR-0014).
 */
export function arenaShouldRecord(finished: boolean): boolean {
  return finished === true;
}
