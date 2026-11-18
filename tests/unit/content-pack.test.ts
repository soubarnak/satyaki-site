// Planet pack validation suite (issue #82, spec #81). One registration
// line per Planet; the harness lives in tests/support/pack-suite.ts.

import { voltaPack } from "@/content/planets/planet-1-volta";
import { astralPack } from "@/content/planets/planet-5-astral";
import { CONTENT_PACKS } from "@/content/planets";
import { describe, expect, it } from "vitest";
import { describePack } from "../support/pack-suite";
import { astralOracle } from "../support/astral-oracle";
import { voltaOracle } from "../support/volta-oracle";

describePack(voltaPack, voltaOracle);
describePack(astralPack, astralOracle);

describe("content pack registry", () => {
  it("lists Planets in quest order", () => {
    expect(CONTENT_PACKS.map((p) => p.planet.slug)).toEqual(["volta", "astral"]);
  });
});
