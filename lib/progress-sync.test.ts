// Progress sync engine tests (issue #67, spec §6).
// Seams: pure sync timing/offline/login/logout helpers in
// lib/progress-sync.ts plus the v2 storage adapter. Glossary: Mission,
// Pass, Star, Boss Gate, Account, Save Code stay in test names.

import { describe, expect, it } from "vitest";
import {
  emptyProgressV2,
  recordBossAttemptV2,
  recordMissionPassV2,
} from "./progress";
import {
  LOCAL_AUTOSAVE_IDLE_MS,
  SYNC_IDLE_MS,
  applyLogoutWipe,
  createProgressSync,
  isDraftDue,
  isSyncDue,
} from "./progress-sync";

function memoryBackend(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("v2 storage adapter", () => {
  it("round-trips the v2 record and starts empty when missing or corrupt", async () => {
    const { createProgressV2Storage: create } = await import("./progress-v2-storage");
    const backend = memoryBackend();
    const storage = create(backend);
    expect(storage.load()).toEqual(emptyProgressV2());
    const record = recordMissionPassV2(emptyProgressV2("guest"), {
      slug: "p1-m1",
      language: "python",
      stars: 2,
      code: "code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    storage.save(record);
    expect(storage.load()).toEqual({ ...record, owner: "guest" });
    backend.map.set("satyaki-progress-v2", "junk {");
    expect(storage.load()).toEqual(emptyProgressV2());
    storage.clear();
    expect(backend.map.has("satyaki-progress-v2")).toBe(false);
  });

  it("a denied backend behaves as empty progress instead of throwing", async () => {
    const { createProgressV2Storage: create } = await import("./progress-v2-storage");
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const storage = create(denied);
    expect(storage.load()).toEqual(emptyProgressV2());
    expect(() => storage.save(emptyProgressV2())).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
  });
});

describe("sync timing constants (spec §6)", () => {
  it("local autosave waits 800 ms idle; logged-in sync waits 3 s idle", () => {
    expect(LOCAL_AUTOSAVE_IDLE_MS).toBe(800);
    expect(SYNC_IDLE_MS).toBe(3000);
    expect(isDraftDue(0, 799)).toBe(false);
    expect(isDraftDue(0, 800)).toBe(true);
    expect(isSyncDue(0, 2999)).toBe(false);
    expect(isSyncDue(0, 3000)).toBe(true);
    expect(isSyncDue(null, 5000)).toBe(false);
  });
});

describe("shared-computer logout (spec §7)", () => {
  it("wipe clears the local cache; normal logout keeps the mirror", () => {
    const record = recordMissionPassV2(emptyProgressV2("acct-1"), {
      slug: "p1-m1",
      language: "python",
      stars: 2,
      code: "code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    expect(applyLogoutWipe(record, true)).toEqual(emptyProgressV2());
    expect(applyLogoutWipe(record, false)).toEqual(record);
  });
});

describe("offline queue and reconnect merge", () => {
  it("an offline flush keeps the queue; reconnect merges without downgrade", async () => {
    let local = recordMissionPassV2(emptyProgressV2("acct-1"), {
      slug: "p1-m1",
      language: "python",
      stars: 3,
      code: "new-code",
      at: "2026-11-12T10:00:00.000Z",
      date: "2026-11-12",
    });
    const server = recordMissionPassV2(emptyProgressV2("acct-1"), {
      slug: "p2-m1",
      language: "java",
      stars: 2,
      code: "server-code",
      at: "2026-11-11T10:00:00.000Z",
      date: "2026-11-11",
    });
    let online = false;
    const sync = createProgressSync({
      loadLocal: () => local,
      saveLocal: (next) => {
        local = next;
      },
      getRemote: async () => {
        if (!online) throw new Error("offline");
        return server;
      },
      putRemote: async (next) => {
        if (!online) throw new Error("offline");
        return next;
      },
    });
    sync.markLocalUpdated(local, 0);
    const offline = await sync.flush(true);
    expect(offline.pushed).toBe(false);
    expect(sync.isDirty()).toBe(true);

    online = true;
    const onReconnect = await sync.onReconnect(true);
    expect(onReconnect.pushed).toBe(true);
    expect(sync.isDirty()).toBe(false);
    expect(local.missions["p1-m1"]?.python.bestStars).toBe(3);
    expect(local.missions["p1-m1"]?.python.passingCode).toBe("new-code");
    expect(local.missions["p2-m1"]?.java.bestStars).toBe(2);
  });

  it("Run/Pass and page-leave flush immediately once logged in", async () => {
    let local = emptyProgressV2("acct-1");
    const sync = createProgressSync({
      loadLocal: () => local,
      saveLocal: (next) => {
        local = next;
      },
      getRemote: async () => null,
      putRemote: async (next) => next,
    });
    const next = recordBossAttemptV2(local, "volta", true, "2026-11-12T10:00:00.000Z");
    const ran = await sync.onRunPass(next, 1000, true);
    expect(ran.pushed).toBe(true);
    expect(sync.isDirty()).toBe(false);
    sync.markLocalUpdated(local, 2000);
    const left = await sync.onPageLeave(true);
    expect(left.pushed).toBe(true);
  });

  it("logged-out Run/Pass stays local and never pushes", async () => {
    let local = emptyProgressV2("guest");
    const sync = createProgressSync({
      loadLocal: () => local,
      saveLocal: (next) => {
        local = next;
      },
      getRemote: async () => null,
      putRemote: async (next) => next,
    });
    const next = recordMissionPassV2(local, {
      slug: "p1-m1",
      language: "python",
      stars: 1,
      code: "code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    const ran = await sync.onRunPass(next, 1000, false);
    expect(ran.pushed).toBe(false);
    expect(local.missions["p1-m1"]?.python.bestStars).toBe(1);
  });
});
