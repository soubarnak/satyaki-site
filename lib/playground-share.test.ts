import { describe, expect, test } from "vitest";
import { deflateSync } from "fflate";
import {
  CHALLENGE_GOAL_KINDS,
  PLAYGROUND_TEMPLATES,
  copyTemplateWorld,
  createCollectGoal,
  createFlipSwitchGoal,
  createOpenGateGoal,
  createReachGoal,
  createSurviveGoal,
  decodeShareLink,
  deleteCreationV2,
  encodeShareLink,
  gradeChallengeGoals,
  isCreationCapFull,
  previewShareImport,
  renameCreationV2,
  resolveCreationTitle,
  startSharedChallenge,
  templateById,
  updateCreationDraftsV2,
  validateChallengeGoals,
  type ShareData,
} from "./playground";
import { CREATION_MAX_COUNT, emptyProgressV2, saveCreationV2 } from "./progress";
import { shareLinkBrokenLine } from "./kid-errors";
import { ShipSim, type AuthoredLayout } from "./ship-sim";

function mustEncode(input: ShareData): string {
  const encoded = encodeShareLink(input);
  if (!encoded.ok) throw new Error(`setup encode failed: ${encoded.reason}`);
  return encoded.fragment;
}

// Share seam (ADR-0014): #c= codec, preview-first landing, Start-copy,
// 20-Creation cap. Every rejection below must collapse to one banner line.

function fragmentOf(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = deflateSync(new TextEncoder().encode(json));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(binary, "binary").toString("base64")
      : btoa(binary);
  return `#c=${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

function shareInput(): ShareData {
  const t = templateById("switch-and-gate")!;
  return {
    title: "Gate run",
    world: copyTemplateWorld(t),
    goals: [...t.goals],
    starters: { python: t.pythonStarter, java: t.javaStarter },
  };
}

test("round-trip keeps title, world, goals, and starters", () => {
  const input = shareInput();
  const encoded = encodeShareLink(input);
  expect(encoded.ok).toBe(true);
  if (!encoded.ok) return;
  expect(encoded.fragment.startsWith("#c=")).toBe(true);
  expect(encoded.fragment.length).toBeLessThanOrEqual(2000);
  const decoded = decodeShareLink(encoded.fragment);
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  expect(decoded.data).toEqual(input);
});

test("rejection set fails whole-import with one banner and nothing half-loads", () => {
  const good = shareInput();
  const valid = (): Record<string, unknown> => ({
    v: 1,
    title: good.title,
    world: JSON.parse(JSON.stringify(good.world)) as unknown,
    goals: JSON.parse(JSON.stringify(good.goals)) as unknown,
    starters: { ...good.starters },
  });
  const world = (): AuthoredLayout => JSON.parse(JSON.stringify(good.world)) as AuthoredLayout;
  const cases: Array<[string, () => Record<string, unknown> | string]> = [
    ["unknown version", () => ({ ...valid(), v: 2 })],
    [
      "unknown entity",
      () => {
        const w = world();
        w.entities.push({ id: "x-1", type: "portal", x: 1, y: 0, z: 1 } as never);
        return { ...valid(), world: w };
      },
    ],
    [
      "out-of-bounds cell",
      () => {
        const w = world();
        w.entities.push({ id: "crystal-9", type: "crystal", x: 99, y: 0, z: 0 });
        return { ...valid(), world: w };
      },
    ],
    [
      "duplicate cell",
      () => {
        const w = world();
        const first = w.entities[0];
        w.entities.push({ ...first, id: "copy-1" });
        return { ...valid(), world: w };
      },
    ],
    [
      "over-cap world",
      () => {
        const w = world();
        for (let i = 0; i < 45; i += 1) {
          w.entities.push({ id: `c-${i}`, type: "crystal", x: i % 12, y: 1, z: Math.floor(i / 12) });
        }
        return { ...valid(), world: w };
      },
    ],
    ["empty title", () => ({ ...valid(), title: "" })],
    ["long title", () => ({ ...valid(), title: "t".repeat(41) })],
    ["long starter", () => ({ ...valid(), starters: { python: "x".repeat(4001), java: "" } })],
    ["truncated", () => fragmentOf(valid()).slice(0, 24)],
    ["wrong prefix", () => `#s=${fragmentOf(valid()).slice(3)}`],
  ];
  for (const [name, make] of cases) {
    const made = make();
    const decoded =
      typeof made === "string" ? decodeShareLink(made) : decodeShareLink(fragmentOf(made));
    expect(decoded.ok, name).toBe(false);
  }
  expect(shareLinkBrokenLine().length).toBeGreaterThan(0);
});

test("oversize link is rejected before anything imports", () => {
  let seed = 123456789;
  const rand = (): number => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789#()_: ";
  let starter = "";
  while (starter.length < 4000) starter += chars[Math.floor(rand() * chars.length)];
  const encoded = encodeShareLink({ ...shareInput(), starters: { python: starter, java: starter } });
  expect(encoded.ok).toBe(false);
  if (!encoded.ok) expect(encoded.reason).toBe("too-long");
});

test("preview names title, goals, world size, and languages without running", () => {
  const decoded = decodeShareLink(mustEncode(shareInput()));
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  const preview = previewShareImport(decoded.data);
  expect(preview.title).toBe("Gate run");
  expect(preview.goalLabels.length).toBeGreaterThan(0);
  expect(preview.entityCount).toBe(decoded.data.world.entities.length);
  expect(preview.languages).toEqual(["python", "java"]);
  const pyOnly = previewShareImport({ ...decoded.data, starters: { python: "x", java: "" } });
  expect(pyOnly.languages).toEqual(["python"]);
});

test("Start saves a copy; a title clash gains a copy suffix", () => {
  const decoded = decodeShareLink(mustEncode(shareInput()));
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  const first = startSharedChallenge(emptyProgressV2(), decoded.data);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(first.progress.creations).toHaveLength(1);
  expect(first.creation.title).toBe("Gate run");
  expect(first.creation.drafts.python).toBe(decoded.data.starters.python);
  const second = startSharedChallenge(first.progress, decoded.data);
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(second.creation.title).toBe("Gate run copy");
  expect(second.creation.id).not.toBe(first.creation.id);
  expect(resolveCreationTitle(["Gate run"], "Gate run")).toBe("Gate run copy");
});

test("Start at the 20-Creation cap blocks with a delete-first message", () => {
  const t = templateById("empty-world")!;
  let progress = emptyProgressV2();
  for (let i = 0; i < CREATION_MAX_COUNT; i += 1) {
    progress = saveCreationV2(progress, {
      title: `C${i}`,
      world: copyTemplateWorld(t),
      goals: [...t.goals],
      drafts: { python: "p", java: "j" },
    });
  }
  expect(isCreationCapFull(progress)).toBe(true);
  const decoded = decodeShareLink(mustEncode(shareInput()));
  expect(decoded.ok).toBe(true);
  if (!decoded.ok) return;
  const blocked = startSharedChallenge(progress, decoded.data);
  expect(blocked.ok).toBe(false);
  if (blocked.ok) return;
  expect(blocked.reason).toBe("cap-full");
  expect(blocked.message).toMatch(/Delete/i);
  expect(progress.creations).toHaveLength(CREATION_MAX_COUNT);
});

describe("Creations CRUD", () => {
  function one() {
    const t = templateById("empty-world")!;
    const started = startSharedChallenge(emptyProgressV2(), {
      title: "Mine",
      world: copyTemplateWorld(t),
      goals: [...t.goals],
      starters: { python: "p", java: "j" },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) throw new Error("setup failed");
    return started;
  }

  test("rename keeps the id and rejects empty or long titles", () => {
    const { progress, creation } = one();
    const renamed = renameCreationV2(progress, creation.id, "Yours");
    expect(renamed.creations[0].title).toBe("Yours");
    expect(renamed.creations[0].id).toBe(creation.id);
    expect(renameCreationV2(progress, creation.id, "").creations[0].title).toBe("Mine");
    expect(renameCreationV2(progress, creation.id, "t".repeat(41)).creations[0].title).toBe("Mine");
    expect(renameCreationV2(progress, "c_zzzzzzzzzzzz", "Yours").creations[0].title).toBe("Mine");
  });

  test("delete removes only the named Creation", () => {
    const { progress, creation } = one();
    expect(deleteCreationV2(progress, creation.id).creations).toHaveLength(0);
    expect(deleteCreationV2(progress, "c_zzzzzzzzzzzz").creations).toHaveLength(1);
  });

  test("draft update replaces both languages and bumps the stamp", () => {
    const { progress, creation } = one();
    const next = updateCreationDraftsV2(
      progress,
      creation.id,
      { python: "p2", java: "j2" },
      "2026-11-20T10:00:00.000Z",
    );
    expect(next.creations[0].drafts).toEqual({ python: "p2", java: "j2" });
    expect(next.creations[0].updatedAt).toBe("2026-11-20T10:00:00.000Z");
  });
});

describe("challenge goal menu", () => {
  test("five menu kinds with fixed timing: only survive is intermediate", () => {
    expect([...CHALLENGE_GOAL_KINDS]).toEqual([
      "reach-cell",
      "collect-crystals",
      "open-gate",
      "flip-switch",
      "survive-steps",
    ]);
    expect(createReachGoal(7, 0, 0).map((c) => c.timing)).toEqual(["final", "final", "final"]);
    expect(createCollectGoal(3).timing).toBe("final");
    expect(createOpenGateGoal("gate-1").timing).toBe("final");
    expect(createFlipSwitchGoal("switch-1").timing).toBe("final");
    expect(createSurviveGoal(5).timing).toBe("intermediate");
    expect(validateChallengeGoals([
      ...createReachGoal(7, 0, 0),
      createCollectGoal(3),
      createSurviveGoal(5),
    ])).toEqual([]);
    expect(validateChallengeGoals([]).length).toBeGreaterThan(0);
  });

  test("grading names each goal met or not on a real run", () => {
    const t = templateById("switch-and-gate")!;
    const sim = new ShipSim(copyTemplateWorld(t));
    const states = [sim.snapshot()];
    for (let i = 0; i < 7; i += 1) sim.move();
    states.push(sim.snapshot());
    sim.harvest();
    states.push(sim.snapshot());
    const goals = [createOpenGateGoal("gate-1"), createReachGoal(7, 0, 0), createCollectGoal(2)];
    const graded = gradeChallengeGoals(states, goals.flat());
    expect(graded.met).toBe(false);
    expect(graded.goals.find((g) => g.id === "open-gate-1")?.passed).toBe(true);
    expect(graded.goals.filter((g) => g.id.startsWith("reach-"))).not.toHaveLength(0);
    expect(graded.goals.every((g) => g.label.length > 0)).toBe(true);
  });
});

test("every template goal set validates", () => {
  for (const t of PLAYGROUND_TEMPLATES) {
    expect(validateChallengeGoals(t.goals), t.id).toEqual([]);
  }
});
