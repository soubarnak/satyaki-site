// Planet pack validation suite (issue #82, spec #81). One registration
// line per Planet; the harness lives in tests/support/pack-suite.ts.

import { astralPack } from "@/content/planets/planet-5-astral";
import { cometaPack } from "@/content/planets/planet-2-cometa";
import { foundryPack } from "@/content/planets/planet-4-foundry";
import { luminaPack } from "@/content/planets/planet-3-lumina";
import { voltaPack } from "@/content/planets/planet-1-volta";
import { CONTENT_PACKS } from "@/content/planets";
import { describe, expect, it } from "vitest";
import { astralOracle } from "../support/astral-oracle";
import { cometaOracle } from "../support/cometa-oracle";
import { foundryOracle } from "../support/foundry-oracle";
import { describePack } from "../support/pack-suite";
import { luminaOracle } from "../support/lumina-oracle";
import { voltaOracle } from "../support/volta-oracle";

describePack(voltaPack, voltaOracle);
describePack(cometaPack, cometaOracle);
describePack(luminaPack, luminaOracle);
describePack(foundryPack, foundryOracle);
describePack(astralPack, astralOracle);

describe("content pack registry", () => {
  it("lists Planets in quest order", () => {
    expect(CONTENT_PACKS.map((p) => p.planet.slug)).toEqual(["volta", "cometa", "lumina", "foundry", "astral"]);
  });
});
