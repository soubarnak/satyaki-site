// Planet packs in quest order. Cometa, Lumina, Foundry and Astral land in
// tickets #83-#86; whole-pack checks are #87. Not wired into the app.

import type { PlanetPack } from "@/lib/content";
import { luminaPack } from "./planet-3-lumina";
import { voltaPack } from "./planet-1-volta";

export const CONTENT_PACKS: PlanetPack[] = [voltaPack, luminaPack];
