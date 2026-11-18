// Client login/logout wiring tests (issue #67, spec §§6–7).
// Seam: fetch-injected helpers in lib/auth-progress-client.ts.

import { describe, expect, it } from "vitest";
import { loginWithLocalProgress, logoutAndApplyWipe } from "./auth-progress-client";
import { emptyProgressV2, recordMissionPassV2 } from "./progress";

describe("login sends the device record and keeps the merged result", () => {
  it("posts progress and returns the server merge", async () => {
    const local = recordMissionPassV2(emptyProgressV2("guest"), {
      slug: "p1-m1",
      language: "python",
      stars: 1,
      code: "local",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    const merged = recordMissionPassV2(local, {
      slug: "p2-m1",
      language: "java",
      stars: 2,
      code: "server",
      at: "2026-11-11T10:00:00.000Z",
      date: "2026-11-11",
    });
    let seen: unknown = null;
    const fetchFn = (async (_input: string, init?: RequestInit) => {
      seen = JSON.parse(String(init?.body));
      return Response.json({ username: "Cadet_1", progress: merged, replaced: false });
    }) as typeof fetch;
    const out = await loginWithLocalProgress(fetchFn, local, {
      username: "Cadet_1",
      password: "pw",
    });
    expect((seen as { progress: { missions: Record<string, unknown> } }).progress.missions["p1-m1"]).toBeDefined();
    expect(out.username).toBe("Cadet_1");
    expect(out.replaced).toBe(false);
    expect(out.progress.missions["p2-m1"]).toBeDefined();
  });

  it(" surfaces a generic failure without a merged record", async () => {
    const fetchFn = (async () =>
      Response.json({ error: "Username or password is wrong." }, { status: 401 })) as typeof fetch;
    await expect(
      loginWithLocalProgress(fetchFn, emptyProgressV2(), { username: "x", password: "y" }),
    ).rejects.toThrow("Username or password is wrong.");
  });
});

describe("logout applies the server wipe flag", () => {
  it("wipes on shared computers and keeps the mirror otherwise", async () => {
    const record = recordMissionPassV2(emptyProgressV2("acct-1"), {
      slug: "p1-m1",
      language: "python",
      stars: 2,
      code: "code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    let saved = record;
    const wipeFetch = (async () => Response.json({ loggedOut: true, wipeLocal: true })) as typeof fetch;
    const wiped = await logoutAndApplyWipe(
      wipeFetch,
      () => record,
      (next) => {
        saved = next;
      },
    );
    expect(wiped.wipeLocal).toBe(true);
    expect(wiped.progress).toEqual(emptyProgressV2());
    expect(saved).toEqual(emptyProgressV2());

    const keepFetch = (async () => Response.json({ loggedOut: true, wipeLocal: false })) as typeof fetch;
    const kept = await logoutAndApplyWipe(
      keepFetch,
      () => record,
      (next) => {
        saved = next;
      },
    );
    expect(kept.wipeLocal).toBe(false);
    expect(kept.progress).toEqual(record);
  });
});
