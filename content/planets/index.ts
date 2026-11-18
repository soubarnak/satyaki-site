// Planet packs in quest order. Cometa and Lumina land in tickets #83-#84,
// Astral in #86; whole-pack checks are #87. Not wired into the app.

import type { PlanetPack } from "@/lib/content";
import { cometaPack } from "./planet-2-cometa";
import { voltaPack } from "./planet-1-volta";
import { foundryPack } from "./planet-4-foundry";

export const CONTENT_PACKS: PlanetPack[] = [voltaPack, cometaPack, foundryPack];
