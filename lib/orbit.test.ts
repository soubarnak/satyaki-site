// Orbit home map derivation suites (issue #68, spec §§3,6,10).
// Seams: orbitView public derivation over PLANET_PACKS; state words and
// hrefs are the contract the prerendered map paints.

import { describe, expect, it } from "vitest";
import { PLANET_PACKS } from "./planet-packs";
import {
  missionHref,
  orbitBossState,
  orbitMissionState,
  orbitStarsLabel,
  orbitStateLabel,
  orbitView,
} from "./orbit";
import { emptyProgressV2, recordBossAttemptV2, recordMissionPassV2 } from "./progress";

const TODAY = "2026-11-18";

function passAllVolta(): ReturnType<typeof recordMissionPassV2> {
  let r = emptyProgressV2();
  for (const slug of ["p1-m1", "p1-m2", "p1-m3", "p1-m4", "p1-m5"]) {
    r = recordMissionPassV2(r, {
      slug,
      language: "python",
      stars: 2,
      code: `${slug} code`,
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
  }
  return r;
}

describe("orbit map states (spec §6 linear unlocks)", () => {
  it("empty record: Volta open, rest locked, p1-m1 the next Mission", () => {
    const view = orbitView(emptyProgressV2(), PLANET_PACKS, TODAY);
    expect(view.planets).toHaveLength(5);
    expect(view.planets[0].planet).toBe("volta");
    expect(view.planets[0].locked).toBe(false);
    expect(view.planets[1].locked).toBe(true);
    expect(view.planets[0].missions[0].state).toBe("open");
    expect(view.planets[0].missions[0].href).toBe(missionHref("p1-m1"));
    expect(view.planets[0].missions[1].state).toBe("locked");
    expect(view.planets[0].missions[1].href).toBeNull();
    expect(view.planets[0].boss.state).toBe("locked");
    expect(view.nextMission).toBe("p1-m1");
    expect(view.totalStars).toBe(0);
    expect(view.passedCount).toBe(0);
  });

  it("a Pass opens the next Mission and counts Stars", () => {
    const r = recordMissionPassV2(emptyProgressV2(), {
      slug: "p1-m1",
      language: "python",
      stars: 2,
      code: "move()",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    const view = orbitView(r, PLANET_PACKS, TODAY);
    expect(view.planets[0].missions[0].state).toBe("passed");
    expect(view.planets[0].missions[0].stars).toBe(2);
    expect(view.planets[0].missions[1].state).toBe("open");
    expect(view.totalStars).toBe(2);
    expect(view.passedCount).toBe(1);
    expect(view.nextMission).toBe("p1-m2");
  });

  it("five Volta Passes open the Boss Gate; the Gate opens Cometa", () => {
    const full = passAllVolta();
    expect(orbitBossState(full, PLANET_PACKS, "volta")).toBe("open");
    expect(orbitView(full, PLANET_PACKS, TODAY).planets[1].locked).toBe(true);
    const gated = recordBossAttemptV2(full, "volta", true, "2026-11-11T10:00:00.000Z");
    const view = orbitView(gated, PLANET_PACKS, TODAY);
    expect(orbitBossState(gated, PLANET_PACKS, "volta")).toBe("passed");
    expect(view.planets[1].locked).toBe(false);
    expect(view.planets[1].missions[0].state).toBe("open");
    expect(view.nextMission).toBe("p2-m1");
  });

  it("unknown Mission slugs stay locked with no link", () => {
    expect(orbitMissionState(emptyProgressV2(), PLANET_PACKS, "nope")).toBe("locked");
  });

  it("radar covers five Planets; locked Planets score 0 with the locked mark", () => {
    const view = orbitView(emptyProgressV2(), PLANET_PACKS, TODAY);
    expect(view.radar).toHaveLength(5);
    expect(view.radar[0]).toEqual({ planet: "volta", score: 0, locked: false });
    expect(view.radar[1].locked).toBe(true);
    expect(view.radar[1].score).toBe(0);
  });
});

describe("orbit state words (never colour alone)", () => {
  it("Mission and Boss Gate chips read Locked/Open/Passed", () => {
    expect(orbitStateLabel("locked")).toBe("Locked");
    expect(orbitStateLabel("open")).toBe("Open");
    expect(orbitStateLabel("passed")).toBe("Passed");
  });

  it("Stars read as text with the Star count", () => {
    expect(orbitStarsLabel(0)).toBe("0 of 3 Stars");
    expect(orbitStarsLabel(2)).toBe("2 of 3 Stars");
  });

  it("Mission links point at the spec Mission route", () => {
    expect(missionHref("p1-m1")).toBe("/missions/p1-m1");
  });
});
