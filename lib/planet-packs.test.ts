// Home-map Planet packs placeholder suites (issue #68, spec §8).
// Every pack must pass the content validator so the map paints 5 Planets
// with stable slugs until the transcribed packs (#74, #82-87) replace it.

import { describe, expect, it } from "vitest";
import { validatePlanetPack } from "./content";
import { PLANET_PACKS } from "./planet-packs";

describe("home-map Planet packs", () => {
  it("ships five Planets in Map order with the spec slugs", () => {
    expect(PLANET_PACKS.map((p) => p.planet.slug)).toEqual([
      "volta",
      "cometa",
      "lumina",
      "foundry",
      "astral",
    ]);
  });

  it("every pack validates with no errors", () => {
    for (const pack of PLANET_PACKS) {
      expect(validatePlanetPack(pack)).toEqual([]);
    }
  });

  it("Boss Gate titles match the Planet specs", () => {
    expect(PLANET_PACKS.map((p) => p.boss.title)).toEqual([
      "Volta Gate",
      "Cometa Gate",
      "Lumina Gate",
      "Foundry Gate",
      "Astral Gate",
    ]);
  });
});
