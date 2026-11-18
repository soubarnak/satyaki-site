// Planet packs in quest order: Volta, Cometa, Lumina, Foundry and Astral.
// The five Planets have landed; whole-pack checks are ticket #87. Not wired
// into the app.

import type { PlanetPack } from "@/lib/content";
import { astralPack } from "./planet-5-astral";
import { cometaPack } from "./planet-2-cometa";
import { foundryPack } from "./planet-4-foundry";
import { luminaPack } from "./planet-3-lumina";
import { voltaPack } from "./planet-1-volta";

export const CONTENT_PACKS: PlanetPack[] = [voltaPack, cometaPack, luminaPack, foundryPack, astralPack];
