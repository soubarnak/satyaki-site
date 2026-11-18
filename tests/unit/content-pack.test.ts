// Planet pack validation suite (issue #82, spec #81). One `describePack`
// registration per Planet; the harness lives in tests/support/pack-suite.ts.

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

// The generic oracle checks structure, not prose. These guard the two
// transcription rules that are easy to break without a type error:
// shared quiz wording stays language-neutral (#81 story 39), and a Java
// starter comment mirrors its Python twin with only the sanctioned
// spelling swaps.
describe("Cometa transcription details", () => {
  it("keeps the Part A spot-bug code display language-neutral", () => {
    const item = cometaPack.boss.partA[1];
    expect(item.kind).toBe("spot-bug");
    expect(item.prompt).toContain("This code should raise the shield only when it is down. Tap the bug.");
    expect(item.prompt).not.toMatch(
      /is_shield_on|isShieldOn|distance_ahead|distanceAhead|False|false|True|true/,
    );
  });

  it("transcribes the p2-m4 Java starter comment from the spec", () => {
    const m4 = cometaPack.missions[3];
    expect(m4.slug).toBe("p2-m4");
    expect(m4.javaStarter).toContain(
      "// else if means else-if: the chain tests each answer in order and runs the first true block.",
    );
  });
});
