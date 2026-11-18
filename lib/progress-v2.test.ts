// Progress v2 suites (issue #61, ADR-0010 + ADR-0014 extensions, spec §6).
// Acceptance: never-downgrade merge, draft updatedAt, Creation newest-wins,
// different-Account replace; Save Code unknown-version and >2MiB rejected
// whole, malformed entries dropped, preview counts correct.

import { describe, expect, it } from "vitest";
import { gunzipSync, gzipSync } from "fflate";
import type { PlanetPack } from "./content";
import {
  applySaveCodeImportV2,
  decodeSaveCodeV2,
  encodeSaveCodeV2,
  emptyProgressV2,
  firstOpenMissionV2,
  isBossOpenV2,
  isMissionOpenV2,
  isPlanetOpenV2,
  loginMergeV2,
  mergeProgressV2,
  migrateV1StreakToV2,
  missionStarsV2,
  parseProgressV2,
  previewSaveCodeImportV2,
  recordArenaBattleV2,
  recordBossAttemptV2,
  recordMissionPassV2,
  recordMissionRunV2,
  saveDraftV2,
  streakCountV2,
  totalStarsV2,
  type ProgressV2,
} from "./progress";
import { EMPTY_PROGRESS } from "./progress";

function packs2(): PlanetPack[] {
  const planet = (id: string, slug: string, missionSlugs: string[]) =>
    ({
      planet: { id, slug, name: slug, themeId: `${slug}-t`, planetConceptId: "variable", missionSlugs },
      missions: [],
      boss: {},
    }) as unknown as PlanetPack;
  return [planet("planet-1", "volta", ["p1-m1", "p1-m2"]), planet("planet-2", "cometa", ["p2-m1"])];
}

function pass(
  record: ProgressV2,
  slug: string,
  language: "python" | "java",
  stars: 0 | 1 | 2 | 3,
  at: string,
  code = `${language}-code-${stars}`,
): ProgressV2 {
  return recordMissionPassV2(record, { slug, language, stars, code, at, date: at.slice(0, 10) });
}

describe("merge: never-downgrade union", () => {
  it("higher Stars win and passing code follows Stars, never downgrades", () => {
    const a = pass(emptyProgressV2(), "p1-m1", "python", 3, "2026-11-10T10:00:00.000Z", "a-code");
    const b = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-11T10:00:00.000Z", "b-code");
    const merged = mergeProgressV2(a, b);
    expect(missionStarsV2(merged, "p1-m1")).toBe(3);
    expect(merged.missions["p1-m1"].python.passingCode).toBe("a-code");
    expect(mergeProgressV2(b, a).missions["p1-m1"].python.passingCode).toBe("a-code");
  });

  it("equal Stars: newer Pass wins the passing code", () => {
    const a = pass(emptyProgressV2(), "p1-m1", "python", 2, "2026-11-10T10:00:00.000Z", "old");
    const b = pass(emptyProgressV2(), "p1-m1", "python", 2, "2026-11-12T10:00:00.000Z", "new");
    expect(mergeProgressV2(a, b).missions["p1-m1"].python.passingCode).toBe("new");
  });

  it("runs, passes, hints and Boss attempts take the max; streak dates union", () => {
    let a = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    a = recordMissionRunV2(a, "p1-m1", "python", "2026-11-11");
    let b = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    b = { ...b, missions: { ...b.missions } };
    const merged = mergeProgressV2(a, b);
    expect(merged.missions["p1-m1"].runs).toBeGreaterThanOrEqual(
      Math.max(a.missions["p1-m1"].runs, b.missions["p1-m1"].runs),
    );
    expect(merged.streakDates).toEqual([...new Set([...a.streakDates, ...b.streakDates])].sort());
  });

  it("drafts resolve per Mission+language by updatedAt", () => {
    const a = saveDraftV2(emptyProgressV2(), "p1-m1", "python", "old-draft", "2026-11-10T10:00:00.000Z");
    const b = saveDraftV2(emptyProgressV2(), "p1-m1", "python", "new-draft", "2026-11-12T10:00:00.000Z");
    expect(mergeProgressV2(a, b).missions["p1-m1"].python.draft).toBe("new-draft");
    expect(mergeProgressV2(b, a).missions["p1-m1"].python.draft).toBe("new-draft");
  });

  it("is idempotent: merge(a, a) deep-equals a", () => {
    const a = pass(saveDraftV2(emptyProgressV2(), "p1-m1", "java", "d", "2026-11-10T10:00:00.000Z"), "p1-m1", "python", 2, "2026-11-10T11:00:00.000Z");
    expect(mergeProgressV2(a, a)).toEqual(a);
  });
});

describe("merge: Creations newest whole-Creation wins", () => {
  const world = {
    shipStart: { x: 0, y: 0, z: 0, heading: "east" as const, energy: 50 },
    bounds: { maxX: 12, maxY: 5, maxZ: 12 },
    entities: [],
  };
  const base = {
    id: "c_aaaaaaaaaaaa",
    title: "Base",
    world,
    goals: [],
    drafts: { python: "py", java: "java" },
  };

  it("same id: newer updatedAt replaces the whole Creation", () => {
    const a: ProgressV2 = { ...emptyProgressV2(), creations: [{ ...base, title: "Old", drafts: { python: "old", java: "" }, updatedAt: "2026-11-10T10:00:00.000Z" }] };
    const b: ProgressV2 = { ...emptyProgressV2(), creations: [{ ...base, title: "New", drafts: { python: "new", java: "" }, updatedAt: "2026-11-12T10:00:00.000Z" }] };
    const merged = mergeProgressV2(a, b);
    expect(merged.creations).toHaveLength(1);
    expect(merged.creations[0].title).toBe("New");
    expect(merged.creations[0].drafts.python).toBe("new");
  });

  it("different ids both survive; cap keeps newest 20", () => {
    const mk = (i: number): ProgressV2 => ({
      ...emptyProgressV2(),
      creations: [
        {
          ...base,
          id: `c_${String(i).padStart(12, "0")}`,
          title: `T${i}`,
          updatedAt: `2026-11-${String((i % 27) + 1).padStart(2, "0")}T10:00:00.000Z`,
        },
      ],
    });
    let acc = emptyProgressV2();
    for (let i = 0; i < 22; i++) acc = mergeProgressV2(acc, mk(i));
    expect(acc.creations.length).toBeLessThanOrEqual(20);
  });
});

describe("login merge: guest and same-Account merge, different-Account replaces", () => {
  it("guest local merges with the server record", () => {
    const local = pass(emptyProgressV2("guest"), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    const server = pass(emptyProgressV2("acct-1"), "p2-m1", "java", 2, "2026-11-11T10:00:00.000Z");
    const out = loginMergeV2(local, server, "acct-1");
    expect(out.replaced).toBe(false);
    expect(out.progress.owner).toBe("acct-1");
    expect(missionStarsV2(out.progress, "p1-m1")).toBe(1);
    expect(missionStarsV2(out.progress, "p2-m1")).toBe(2);
  });

  it("different Account replaces the local record", () => {
    const local = pass(emptyProgressV2("acct-9"), "p1-m1", "python", 3, "2026-11-10T10:00:00.000Z");
    const server = pass(emptyProgressV2("acct-1"), "p2-m1", "java", 2, "2026-11-11T10:00:00.000Z");
    const out = loginMergeV2(local, server, "acct-1");
    expect(out.replaced).toBe(true);
    expect(out.progress.owner).toBe("acct-1");
    expect(missionStarsV2(out.progress, "p1-m1")).toBe(0);
    expect(missionStarsV2(out.progress, "p2-m1")).toBe(2);
  });
});

describe("derived: totals, unlocks, streak", () => {
  it("total Stars caps at 75 and Mission Stars take the best language", () => {
    let r = emptyProgressV2();
    r = pass(r, "p1-m1", "python", 2, "2026-11-10T10:00:00.000Z");
    r = pass(r, "p1-m1", "java", 3, "2026-11-11T10:00:00.000Z");
    expect(missionStarsV2(r, "p1-m1")).toBe(3);
    expect(totalStarsV2(r)).toBe(3);
  });

  it("linear unlocks: Mission needs previous Pass, Boss needs five, Planet needs Boss", () => {
    const packs = packs2();
    expect(isMissionOpenV2(emptyProgressV2(), packs, "p1-m1")).toBe(true);
    expect(isMissionOpenV2(emptyProgressV2(), packs, "p1-m2")).toBe(false);
    const r = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    expect(isMissionOpenV2(r, packs, "p1-m2")).toBe(true);
    expect(isBossOpenV2(r, packs, "volta")).toBe(false);
    expect(isPlanetOpenV2(r, packs, "cometa")).toBe(false);
    expect(firstOpenMissionV2(r, packs)).toBe("p1-m2");
  });

  it("strict streak breaks on a missed day", () => {
    const r: ProgressV2 = {
      ...emptyProgressV2(),
      streakDates: ["2026-11-01", "2026-11-02", "2026-11-04"],
    };
    expect(streakCountV2(r, "2026-11-04")).toBe(1);
    expect(streakCountV2(r, "2026-11-05")).toBe(1);
    expect(streakCountV2(r, "2026-11-06")).toBe(0);
  });

  it("v1 streak dates carry over; v1 passes do not convert", () => {
    const v2 = migrateV1StreakToV2({ ...EMPTY_PROGRESS, streakDates: ["2026-11-01"] });
    expect(v2.streakDates).toEqual(["2026-11-01"]);
    expect(totalStarsV2(v2)).toBe(0);
    expect(parseProgressV2(JSON.stringify({ version: 1, passedLevelIds: [1], badges: [], streakDates: ["2026-11-01"] })).streakDates).toEqual(["2026-11-01"]);
  });

  it("arena Best wave clamps and boss attempts never downgrade", () => {
    const r = recordArenaBattleV2(emptyProgressV2(), { won: true, wave: 9, language: "python" });
    expect(r.arena.bestWave).toBe(5);
    const b1 = recordBossAttemptV2(emptyProgressV2(), "volta", true, "2026-11-10T10:00:00.000Z");
    const b2 = recordBossAttemptV2(b1, "volta", false, "2026-11-11T10:00:00.000Z");
    expect(b2.bosses["volta"].passed).toBe(true);
    expect(b2.bosses["volta"].attempts).toBe(2);
  });
});

// --- Save Code corruption set: independent encoder oracle in-test ---

function fnv(hex: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < hex.length; i++) {
    h ^= hex.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function craftCode(json: unknown): string {
  const payload = b64url(gzipSync(new TextEncoder().encode(JSON.stringify(json))));
  return `SSC2.${payload}.${fnv(payload)}`;
}

describe("Save Code: round-trip, preview, corruption set", () => {
  it("round-trips a record with Missions and Creations", () => {
    let r = pass(emptyProgressV2(), "p1-m1", "python", 2, "2026-11-10T10:00:00.000Z", "code-2");
    r = saveDraftV2(r, "p1-m1", "java", "draft", "2026-11-11T10:00:00.000Z");
    const code = encodeSaveCodeV2(r);
    expect(code.startsWith("SSC2.")).toBe(true);
    const back = decodeSaveCodeV2(code);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(missionStarsV2(back.record, "p1-m1")).toBe(2);
      expect(back.record.streakDates).toEqual(r.streakDates);
    }
  });

  it("owner never exports: decode keeps no foreign owner", () => {
    const code = encodeSaveCodeV2(emptyProgressV2("acct-1"));
    const back = decodeSaveCodeV2(code);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.record.owner ?? "guest").not.toBe("acct-1");
  });

  it("rejects an unknown version whole", () => {
    const code = craftCode({ version: 99, missions: {}, bosses: {} });
    const back = decodeSaveCodeV2(code);
    expect(back).toEqual({ ok: false, reason: "unknown-version" });
  });

  it("rejects a decoded payload over 2MiB whole", () => {
    const big: Record<string, unknown> = { version: 2, missions: {}, bosses: {}, streakDates: [], hangar: {}, creations: [], arena: {} };
    (big as Record<string, unknown>).pad = "x".repeat(2 * 1024 * 1024 + 8);
    const back = decodeSaveCodeV2(craftCode(big));
    expect(back).toEqual({ ok: false, reason: "too-large" });
  });

  it("drops single malformed entries and keeps the good ones", () => {
    const good = {
      runs: 1,
      passes: 1,
      hintsUsed: 0,
      firstPassAt: "2026-11-10T10:00:00.000Z",
      lastPassAt: "2026-11-10T10:00:00.000Z",
      lastLanguage: "python",
      python: { draft: "", draftUpdatedAt: "2026-11-10T10:00:00.000Z", bestStars: 1, passingCode: "c", passingStars: 1, passingUpdatedAt: "2026-11-10T10:00:00.000Z" },
      java: { draft: "", draftUpdatedAt: "2026-11-10T10:00:00.000Z", bestStars: 0, passingCode: null, passingStars: 0, passingUpdatedAt: null },
    };
    const code = craftCode({
      version: 2,
      missions: { "p1-m1": good, "not a slug!!": good, "p1-m2": 42 },
      bosses: {},
      streakDates: ["2026-11-10", "bogus"],
      hangar: {},
      creations: [],
      arena: {},
    });
    const back = decodeSaveCodeV2(code);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(Object.keys(back.record.missions)).toEqual(["p1-m1"]);
      expect(back.record.streakDates).toEqual(["2026-11-10"]);
    }
  });

  it("rejects a bad checksum and a bad prefix", () => {
    const code = encodeSaveCodeV2(emptyProgressV2());
    expect(decodeSaveCodeV2(`XX.${code.slice(5)}`)).toEqual({ ok: false, reason: "bad-format" });
    expect(decodeSaveCodeV2(`${code.slice(0, -1)}0`)).toEqual({ ok: false, reason: "bad-checksum" });
  });

  it("preview counts Missions gained, Stars gained, and code replaced", () => {
    const cur = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z", "old-code");
    let inc = pass(emptyProgressV2(), "p1-m1", "python", 3, "2026-11-12T10:00:00.000Z", "new-code");
    inc = pass(inc, "p1-m2", "java", 2, "2026-11-12T10:00:00.000Z", "m2-code");
    const preview = previewSaveCodeImportV2(cur, inc);
    expect(preview.newMissions).toEqual(["p1-m2"]);
    expect(preview.starsGained).toBe(4);
    expect(preview.passingReplaced).toBeGreaterThanOrEqual(2);
    expect(preview.totalStarsAfter).toBe(totalStarsV2(applySaveCodeImportV2(cur, inc)));
  });

  it("gunzip stays standard: independent inflate reads our payload", () => {
    const r = pass(emptyProgressV2(), "p1-m1", "python", 1, "2026-11-10T10:00:00.000Z");
    const code = encodeSaveCodeV2(r);
    const payload = code.slice("SSC2.".length, code.lastIndexOf("."));
    const raw = gunzipSync(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64"));
    expect(JSON.parse(new TextDecoder().decode(raw)).version).toBe(2);
  });
});

describe("hangar storage (#73: equipped persists through sync and Save Code)", () => {
  it("empty record equips training in every slot", () => {
    expect(emptyProgressV2().hangar).toEqual({
      hull: "training",
      trim: "training",
      thruster: "training",
      laserColour: "training",
    });
  });

  it("sanitize falls back an unknown stored slot to training only", () => {
    const r = parseProgressV2(
      JSON.stringify({
        version: 2,
        missions: {},
        bosses: {},
        streakDates: [],
        hangar: { hull: "ultraviolet", trim: "bronze" },
        creations: [],
        arena: {},
      }),
    );
    expect(r.hangar.hull).toBe("training");
    expect(r.hangar.trim).toBe("bronze");
  });

  it("merge keeps an equipped cosmetic over the training default in both orders", () => {
    const equipped: ProgressV2 = {
      ...emptyProgressV2(),
      hangar: { hull: "bronze", trim: "training", thruster: "training", laserColour: "training" },
    };
    const fresh = emptyProgressV2();
    expect(mergeProgressV2(fresh, equipped).hangar.hull).toBe("bronze");
    expect(mergeProgressV2(equipped, fresh).hangar.hull).toBe("bronze");
  });

  it("Save Code round-trips the equipped set", () => {
    const equipped: ProgressV2 = {
      ...emptyProgressV2(),
      hangar: { hull: "steel", trim: "training", thruster: "training", laserColour: "training" },
    };
    const back = decodeSaveCodeV2(encodeSaveCodeV2(equipped));
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.record.hangar.hull).toBe("steel");
  });
});
