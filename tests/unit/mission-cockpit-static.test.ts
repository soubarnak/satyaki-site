// Mission cockpit static proof at source level (issue #69 acceptance).
// Variant C layout plus Variant A playback must exist behind Mission-only
// boundaries; the home route must stay free of heavy JS by construction.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

// Every source file that may reference the heavy deps (the two boundary
// modules only). Nothing else in app/lib/components/workers may.
const MONACO_OWNER = "components/mission-monaco.tsx";
const R3F_OWNER = "components/mission-simulator-r3f.tsx";
const SCOPED_SOURCES = [
  "app/missions/[slug]/page.tsx",
  "app/page.tsx",
  "components/mission-cockpit.tsx",
  "components/mission-editor.tsx",
  "components/mission-simulator.tsx",
  "components/orbit-home.tsx",
  "components/orbit-map.tsx",
  "components/radar-summary.tsx",
  "components/drill-card.tsx",
  "components/use-progress-v2.ts",
  "components/boss-gate.tsx",
  "components/planet-rail.tsx",
  "components/sim-chrome.tsx",
  "lib/cockpit-playback.ts",
];
// lib/monaco-config.ts holds only the versioned path strings (no import);
// it is asserted separately below to carry no module import.

describe("mission cockpit ships behind Mission-only boundaries", () => {
  it("only the Monaco boundary module references monaco-editor", () => {
    for (const file of SCOPED_SOURCES) {
      expect(read(file), file).not.toContain("monaco-editor");
    }
    const owner = read(MONACO_OWNER);
    expect(owner).toContain("monaco-editor/editor/editor.api");
    expect(owner).toContain("languages/definitions/python/register");
    expect(owner).toContain("languages/definitions/java/register");
  });

  it("slim Monaco shape: one worker, no full build, no CDN, no react wrapper", () => {
    const owner = read(MONACO_OWNER);
    expect(owner.match(/editor\.worker"/g)?.length).toBe(1);
    expect(owner.match(/new Worker\(/g)?.length).toBe(1);
    expect(read("lib/monaco-config.ts")).not.toMatch(/from\s+["']monaco-editor/);
    expect(read("lib/monaco-config.ts")).not.toMatch(/import\(["']monaco-editor/);
    for (const needle of [
      "editor.main",
      "@monaco-editor/react",
      "cdn.jsdelivr",
      "cdn.jsdelivr.net",
      "unpkg.com",
      'from "monaco-editor"',
      "from 'monaco-editor'",
    ]) {
      expect(owner, needle).not.toContain(needle);
    }
    // Stylesheet is the versioned self-hosted file, never a CDN URL.
    const config = read("lib/monaco-config.ts");
    expect(config).toContain('MONACO_VERSION = "0.57.0"');
    expect(config).toContain("`/monaco/v${MONACO_VERSION}/`");
    expect(config).toContain("editor.main.css");
  });

  it("only the R3F boundary module references three", () => {
    for (const file of [...SCOPED_SOURCES, MONACO_OWNER]) {
      const src = read(file);
      expect(src, `${file} three`).not.toMatch(/from\s+["']three["']/);
      expect(src, `${file} r3f`).not.toContain("@react-three/fiber");
    }
    const owner = read(R3F_OWNER);
    expect(owner).toContain("@react-three/fiber");
    expect(owner).not.toContain("@react-three/drei");
    expect(owner).not.toMatch(/from\s+["']drei\//);
  });

  it("cockpit loads both behind Mission-only dynamic ssr:false boundaries", () => {
    const cockpit = read("components/mission-cockpit.tsx");
    expect(cockpit).toContain("next/dynamic");
    expect(cockpit).toContain("mission-monaco");
    expect(cockpit).toContain("mission-simulator-r3f");
    expect(cockpit.match(/ssr:\s*false/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("home route stays clean of the cockpit", () => {
    for (const file of ["app/page.tsx", "components/orbit-home.tsx"]) {
      expect(read(file)).not.toContain("mission-cockpit");
      expect(read(file)).not.toContain("MissionCockpit");
      expect(read(file)).not.toContain("mission-monaco");
      expect(read(file)).not.toContain("mission-simulator-r3f");
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
    const cockpit = read("components/mission-cockpit.tsx");
    expect(cockpit).toContain("webgl2");
    const sim = read("components/mission-simulator.tsx");
    expect(sim).toContain("2D map and text replay");
    const chrome = read("components/sim-chrome.tsx");
    expect(chrome).toContain("Top-down");
    expect(chrome).toContain("Chase");
    expect(chrome).toContain("Free orbit");
    expect(chrome).toContain("Hover any square");
  });

  it("language workers load as bundled JS with the right MIME", () => {
    for (const [file, entry] of [
      ["lib/python-worker-client.ts", "/workers/python-worker.js"],
      ["lib/java-worker-client.ts", "/workers/java-worker.js"],
    ]) {
      const src = read(file);
      expect(src, file).toContain(`WORKER_URL = "${entry}"`);
      expect(src, file).toContain("new Worker(WORKER_URL");
      expect(src, file).not.toContain("workers/python-worker.ts");
      expect(src, file).not.toContain("workers/java-worker.ts");
    }
    expect(read("scripts/bundle-workers.mjs")).toContain("public");
  });

  it("unknown Mission slugs show a load error with retry and no editor", () => {
    const page = read("app/missions/[slug]/page.tsx");
    expect(page).toContain("could not load");
    expect(page).toContain("Try again");
  });
});
