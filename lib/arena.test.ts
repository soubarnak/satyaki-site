import { describe, expect, it } from "vitest";
import {
  ARENA_ATTACK_DAMAGE,
  ARENA_MAX_COMMANDS,
  ARENA_OPPONENT_HEALTH,
  ARENA_START_DISTANCE,
  parseArenaCommands,
  replayArena,
  runArenaBattle,
  type ArenaCommand,
} from "./arena";

// Arena engine seams (FR-011, AS-002): the reference win, the 100/101
// boundary, facing and distance rules, and unknown-line filtering.

function moves(n: number): ArenaCommand[] {
  return Array(n).fill("MOVE");
}

function attacks(n: number): ArenaCommand[] {
  return Array(n).fill("ATTACK");
}

function turns(n: number): ArenaCommand[] {
  return Array(n).fill("TURN");
}

describe("arena tuning constants (AS-002 proposal)", () => {
  it("names the playtest values the arena ticket can retune in one place", () => {
    expect(ARENA_OPPONENT_HEALTH).toBe(40);
    expect(ARENA_ATTACK_DAMAGE).toBe(2);
    expect(ARENA_START_DISTANCE).toBe(5);
    expect(ARENA_MAX_COMMANDS).toBe(100);
  });
});

describe("parseArenaCommands (FR-011 rule set)", () => {
  it("keeps MOVE, TURN, and ATTACK lines in submission order", () => {
    expect(parseArenaCommands("MOVE\nTURN\nATTACK\n")).toEqual([
      "MOVE",
      "TURN",
      "ATTACK",
    ]);
  });

  it("ignores unknown printed lines and never counts them", () => {
    expect(
      parseArenaCommands("Hello, Bolt!\nmove\n MOVE \nJUNK ATTACK\nATTACK\n"),
    ).toEqual(["MOVE", "ATTACK"]);
  });

  it("parses an empty program to no commands", () => {
    expect(parseArenaCommands("")).toEqual([]);
  });
});

describe("replayArena (FR-011 win rule)", () => {
  it("wins the 24-command reference (4 moves plus 20 attacks, AC-1)", () => {
    const result = replayArena([...moves(4), ...attacks(20)]);
    expect(result.won).toBe(true);
    expect(result.steps).toHaveLength(24);
    expect(result.finalOpponentHealth).toBe(0);
    expect(result.finalBoltPos).toBe(4);
    expect(result.steps[23].damageDealt).toBe(ARENA_ATTACK_DAMAGE);
  });

  it("wins when the kill lands on exactly command 100 (AC-1 boundary)", () => {
    const commands = [...moves(4), ...turns(76), ...attacks(20)];
    expect(commands).toHaveLength(100);
    const result = replayArena(commands);
    expect(result.won).toBe(true);
    expect(result.steps).toHaveLength(100);
    expect(result.finalOpponentHealth).toBe(0);
  });

  it("loses when the kill would need command 101 (AC-2)", () => {
    const commands = [...moves(4), ...turns(77), ...attacks(20)];
    expect(commands).toHaveLength(101);
    const result = replayArena(commands);
    expect(result.won).toBe(false);
    expect(result.steps).toHaveLength(100);
    expect(result.finalOpponentHealth).toBeGreaterThan(0);
  });

  it("deals no damage with ATTACK from non-adjacent cells", () => {
    const result = replayArena(attacks(20));
    expect(result.won).toBe(false);
    expect(result.finalOpponentHealth).toBe(ARENA_OPPONENT_HEALTH);
  });

  it("deals no damage with ATTACK while facing away at adjacent range", () => {
    const result = replayArena([...moves(4), "TURN", ...attacks(20)]);
    expect(result.won).toBe(false);
    expect(result.finalOpponentHealth).toBe(ARENA_OPPONENT_HEALTH);
  });

  it("damages again after turning back toward the opponent", () => {
    const result = replayArena([
      ...moves(4),
      "TURN",
      "TURN",
      ...attacks(20),
    ]);
    expect(result.won).toBe(true);
    expect(result.finalOpponentHealth).toBe(0);
  });

  it("stops the replay at the kill and ignores later commands", () => {
    const result = replayArena([...moves(4), ...attacks(25)]);
    expect(result.won).toBe(true);
    expect(result.steps).toHaveLength(24);
  });

  it("loses an empty battle with full opponent health", () => {
    const result = replayArena([]);
    expect(result.won).toBe(false);
    expect(result.finalOpponentHealth).toBe(ARENA_OPPONENT_HEALTH);
    expect(result.finalBoltPos).toBe(0);
  });
});

describe("runArenaBattle (stdout to verdict)", () => {
  it("ignores junk lines around the reference win", () => {
    const stdout = [
      "Bolt is awake!",
      ...moves(4),
      "go bolt go",
      ...attacks(20),
      "",
    ].join("\n");
    const result = runArenaBattle(stdout);
    expect(result.won).toBe(true);
    expect(result.steps).toHaveLength(24);
  });
});
