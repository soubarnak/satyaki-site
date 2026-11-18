// Planet pack validation suite (issue #82, spec #81). One registration
// line per Planet; the harness lives in tests/support/pack-suite.ts.

import { foundryPack } from "@/content/planets/planet-4-foundry";
import { voltaPack } from "@/content/planets/planet-1-volta";
import { CONTENT_PACKS } from "@/content/planets";
import { describe, expect, it } from "vitest";
import { foundryOracle } from "../support/foundry-oracle";
import { describePack } from "../support/pack-suite";
import { voltaOracle } from "../support/volta-oracle";

describePack(voltaPack, voltaOracle);
describePack(foundryPack, foundryOracle);

describe("content pack registry", () => {
  it("lists Planets in quest order", () => {
    expect(CONTENT_PACKS.map((p) => p.planet.slug)).toEqual(["volta", "foundry"]);
  });
});
