// Home route static proof at source level (issue #68 acceptance).
// The prerendered `/` holds the map with no loading gate and zero
// three/monaco JS; the build script asserts the same on build output.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const HOME_FILES = [
  "app/page.tsx",
  "components/orbit-home.tsx",
  "components/orbit-map.tsx",
  "components/radar-summary.tsx",
  "components/drill-card.tsx",
  "components/use-progress-v2.ts",
  "components/planet-rail.tsx",
];

describe("home route ships no heavy JS and no loading gate", () => {
  it("no three/monaco imports anywhere on the home path", () => {
    const heavy = [/from\s+["']three["']/, /require\(\s*["']three["']/, /@react-three/, /monaco-editor/, /editor\.api/];
    for (const file of HOME_FILES) {
      const src = read(file);
      for (const pattern of heavy) {
        expect(src, `${file} ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("no loading gate text on the home path", () => {
    for (const file of HOME_FILES) {
      expect(read(file), file).not.toContain("Loading your quest map");
    }
    expect(read("app/page.tsx")).not.toContain("Loading");
  });

  it("the prerendered map holds the orbit, radar, and drill card", () => {
    expect(read("components/orbit-map.tsx")).toContain("<svg");
    expect(read("components/orbit-map.tsx")).toContain("Orbit map");
    expect(read("components/radar-summary.tsx")).toContain("Skill Radar");
    expect(read("components/drill-card.tsx")).toContain("Daily Recall Drill");
    expect(read("app/page.tsx")).toContain("OrbitHome");
  });
});
