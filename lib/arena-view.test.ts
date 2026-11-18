// Arena view suites (ADR-0014, spec §9).
// Seam: the pure view helpers in lib/arena-view.ts. Expected lines come
// from the glossary (Arena, Account, Cadet) and the ADR, never the code.

import { describe, expect, test } from "vitest";
import { runArenaBattle } from "./arena";
import {
  ARENA_COMMANDS,
  ARENA_JAVA_STARTER,
  ARENA_PYTHON_STARTER,
  ARENA_SIGN_IN_LINE,
  arenaAccountOpen,
  arenaBattleLine,
  arenaShouldRecord,
  arenaTickErrorLine,
} from "./arena-view";

describe("arena account gate (ADR-0014)", () => {
  test("logged-out Cadets never open a guest battle", () => {
    expect(arenaAccountOpen({ loggedIn: false })).toBe(false);
    expect(arenaAccountOpen({ loggedIn: true })).toBe(true);
  });

  test("sign-in prompt names the Account, never a guest battle", () => {
    expect(ARENA_SIGN_IN_LINE).toMatch(/Account/);
    expect(ARENA_SIGN_IN_LINE).toMatch(/sign in/i);
  });
});

describe("arena starters (ADR-0014)", () => {
  test("Python starter defines on_tick with read-only comments", () => {
    expect(ARENA_PYTHON_STARTER).toContain("def on_tick(ship, radar):");
    expect(ARENA_PYTHON_STARTER).toContain("drone_distance");
    expect(ARENA_PYTHON_STARTER).toContain("read-only");
    expect(ARENA_PYTHON_STARTER).toContain('return "wait"');
  });

  test("Java starter is always full-scaffold with onTick", () => {
    expect(ARENA_JAVA_STARTER).toContain("public class Main");
    expect(ARENA_JAVA_STARTER).toContain("onTick(Ship ship, Radar radar)");
    expect(ARENA_JAVA_STARTER).toContain("droneDistance");
    expect(ARENA_JAVA_STARTER).toContain("read-only");
  });

  test("command help lists all 9 tick actions", () => {
    expect(ARENA_COMMANDS.map((entry) => entry.command)).toEqual([
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
    for (const entry of ARENA_COMMANDS) {
      expect(entry.meaning.length).toBeGreaterThan(0);
    }
  });
});

describe("arenaBattleLine (spec §9 verdicts)", () => {
  test("win names wave 5 and the tick count", () => {
    const battle = runArenaBattle(() => "wait");
    const line = arenaBattleLine({ ...battle, won: true, reason: "win", wave: 5, ticks: 156 });
    expect(line).toMatch(/Victory/);
    expect(line).toContain("wave 5");
    expect(line).toContain("156");
  });

  test("loss names the wave and tick", () => {
    const battle = runArenaBattle(() => "wait");
    const line = arenaBattleLine({ ...battle, won: false, reason: "loss", wave: 2, ticks: 40 });
    expect(line).toContain("wave 2");
    expect(line).toContain("tick 40");
  });

  test("cap names the 200-tick limit", () => {
    const battle = runArenaBattle(() => "wait");
    expect(arenaBattleLine(battle)).toContain("200");
  });

  test("error points at the tick program", () => {
    const battle = runArenaBattle(() => {
      throw { line: 3, excType: "NameError", message: "nope" };
    });
    expect(arenaBattleLine(battle)).toMatch(/tick program|stopped/);
  });
});

describe("arena tick errors (kid sentences)", () => {
  test("read-only writes stay kid-readable in both languages", () => {
    const frame = { line: 4, excType: "ReadOnly", message: "ship.x is read-only" };
    expect(arenaTickErrorLine(frame, "python")).toMatch(/read-only/);
    expect(arenaTickErrorLine(frame, "java")).toMatch(/read-only/);
  });

  test("missing on_tick names the starter frame", () => {
    const line = arenaTickErrorLine({ line: 0, excType: "NoOnTick", message: "missing" }, "python");
    expect(line.length).toBeGreaterThan(0);
  });
});

describe("arena record rule (ADR-0014)", () => {
  test("finished battles record; abandoned battles write nothing", () => {
    expect(arenaShouldRecord(true)).toBe(true);
    expect(arenaShouldRecord(false)).toBe(false);
  });
});
