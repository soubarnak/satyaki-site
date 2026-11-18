// Mission cockpit static proof at source level (issue #69 acceptance).
// Variant C layout plus Variant A playback must exist behind Mission-only
// boundaries; the home route must stay free of heavy JS by construction.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

describe("mission cockpit ships behind Mission-only boundaries", () => {
  it("no static three/monaco imports on the cockpit path", () => {
    const files = [
      "app/missions/[slug]/page.tsx",
      "components/mission-cockpit.tsx",
      "components/mission-editor.tsx",
      "components/mission-simulator.tsx",
      "lib/cockpit-playback.ts",
    ];
    const heavy = [/from\s+["']three["']/, /require\(\s*["']three["']/, /@react-three/, /monaco-editor/];
    for (const file of files) {
      const src = read(file);
      for (const pattern of heavy) {
        expect(src, `${file} ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("home route stays clean of the cockpit", () => {
    for (const file of ["app/page.tsx", "components/orbit-home.tsx"]) {
      expect(read(file)).not.toContain("mission-cockpit");
      expect(read(file)).not.toContain("MissionCockpit");
    }
  });

  it("cockpit holds Variant C regions and Variant A transport", () => {
    const cockpit = read("components/mission-cockpit.tsx");
    for (const needle of [
      "Briefing",
      "Training Wheels",
      "Playback",
      "Step back",
      "Step forward",
      "Reset",
      "Speed",
      "Frame scrubber",
      "Console",
      "Python",
      "Java",
    ]) {
      expect(cockpit).toContain(needle);
    }
    const playback = read("lib/cockpit-playback.ts");
    expect(playback).toContain("650");
    expect(playback).toContain("top");
    expect(playback).toContain("chase");
    expect(playback).toContain("orbit");
  });

  it("simulator gates WebGL2 and falls back to 2D/text replay", () => {
    const sim = read("components/mission-simulator.tsx");
    expect(sim).toContain("webgl2");
    expect(sim).toContain("2D map and text replay");
    expect(sim).toContain("Top-down");
    expect(sim).toContain("Chase");
    expect(sim).toContain("Free orbit");
    expect(sim).toContain("Hover any square");
  });

  it("unknown Mission slugs show a load error with retry and no editor", () => {
    const page = read("app/missions/[slug]/page.tsx");
    expect(page).toContain("could not load");
    expect(page).toContain("Try again");
  });
});
