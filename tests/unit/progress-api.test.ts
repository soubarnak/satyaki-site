import { describe, expect, it } from "vitest";
import { createAuthHandlers } from "@/lib/server/auth-handler";
import { createStubMailer } from "@/lib/auth/mailer";
import { createMemoryAuthStore } from "@/lib/auth/store";
import {
  emptyProgressV2,
  recordBossAttemptV2,
  recordMissionPassV2,
} from "@/lib/progress";

function setup() {
  const store = createMemoryAuthStore();
  const { mailer, sent } = createStubMailer();
  let nowMs = 1_000_000_000;
  const handlers = createAuthHandlers({ store, mailer, now: () => nowMs });
  const advance = (ms: number) => {
    nowMs += ms;
  };
  return { store, sent, handlers, advance, now: () => nowMs };
}

function req(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`http://site.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.7", ...headers },
    body: JSON.stringify(body),
  });
}

function cookieFrom(res: Response): string | null {
  const set = res.headers.get("set-cookie");
  if (!set) return null;
  const match = /satyaki_session=([^;]+)/.exec(set);
  return match ? match[1] : null;
}

async function registerVerifyLogin(handlers: ReturnType<typeof createAuthHandlers>, sent: { code: string }[], username: string, email: string, password: string) {
  await handlers.register(
    req("/api/auth/register", { username, email, password, consent: true }),
  );
  await handlers.verify(req("/api/auth/verify", { email, code: sent[sent.length - 1].code }));
  const login = await handlers.login(req("/api/auth/login", { username, password }));
  return cookieFrom(login)!;
}

describe("progress sync API over the v2 record (spec §6)", () => {
  it("older device PUT never downgrades Stars, Passes, or Boss Gate clears", async () => {
    const { handlers, sent } = setup();
    const token = await registerVerifyLogin(handlers, sent, "Cadet_67", "p67@example.com", "strong pass 671");
    const authed = { cookie: `satyaki_session=${token}` };

    const newer = recordMissionPassV2(emptyProgressV2("acct-x"), {
      slug: "p1-m1",
      language: "python",
      stars: 3,
      code: "new-code",
      at: "2026-11-12T10:00:00.000Z",
      date: "2026-11-12",
    });
    const withBoss = recordBossAttemptV2(newer, "volta", true, "2026-11-12T11:00:00.000Z");
    const putNew = await handlers.putProgress(
      new Request("http://site.test/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authed },
        body: JSON.stringify({ progress: withBoss }),
      }),
    );
    expect(putNew.status).toBe(200);

    const older = recordMissionPassV2(emptyProgressV2("acct-x"), {
      slug: "p1-m1",
      language: "python",
      stars: 1,
      code: "old-code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    const putOld = await handlers.putProgress(
      new Request("http://site.test/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authed },
        body: JSON.stringify({ progress: older }),
      }),
    );
    expect(putOld.status).toBe(200);
    const merged = (await putOld.json()) as { progress: typeof newer };
    expect(merged.progress.missions["p1-m1"].python.bestStars).toBe(3);
    expect(merged.progress.missions["p1-m1"].python.passingCode).toBe("new-code");
    expect(merged.progress.missions["p1-m1"].passes).toBeGreaterThanOrEqual(1);
    expect(merged.progress.bosses["volta"].passed).toBe(true);

    const get = await handlers.getProgress(
      new Request("http://site.test/api/progress", { headers: { ...authed } }),
    );
    const body = (await get.json()) as { progress: typeof newer };
    expect(body.progress.missions["p1-m1"].python.bestStars).toBe(3);
    expect(body.progress.bosses["volta"].passed).toBe(true);
  });

  it("GET sanitizes a corrupt stored record instead of returning it raw", async () => {
    const { handlers, sent, store } = setup();
    const token = await registerVerifyLogin(handlers, sent, "Cadet_68", "p68@example.com", "strong pass 681");
    const accounts = await store.listAccounts();
    accounts[0].progressJson = JSON.stringify({
      version: 2,
      missions: { "p1-m1": 42, "not a slug!!": { runs: 1 } },
      bosses: { volta: { passed: true } },
      streakDates: ["2026-11-10", "bogus"],
      hangar: {},
      creations: [],
      arena: {},
    });
    await store.updateAccount(accounts[0]);
    const get = await handlers.getProgress(
      new Request("http://site.test/api/progress", { headers: { cookie: `satyaki_session=${token}` } }),
    );
    expect(get.status).toBe(200);
    const body = (await get.json()) as { progress: Record<string, unknown> };
    expect(body.progress).toMatchObject({ version: 2 });
    expect(Object.keys((body.progress as { missions: Record<string, unknown> }).missions)).toEqual([]);
  });

  it("PUT stores the record under the Account owner", async () => {
    const { handlers, sent } = setup();
    const token = await registerVerifyLogin(handlers, sent, "Cadet_69", "p69@example.com", "strong pass 691");
    const put = await handlers.putProgress(
      new Request("http://site.test/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: `satyaki_session=${token}` },
        body: JSON.stringify({ progress: emptyProgressV2("guest") }),
      }),
    );
    const body = (await put.json()) as { progress: { owner?: string } };
    expect(body.progress.owner).not.toBe("guest");
  });

  it("login merges a guest local record and returns the merged progress", async () => {
    const { handlers, sent, store } = setup();
    await handlers.register(
      req("/api/auth/register", { username: "Cadet_70", email: "p70@example.com", password: "strong pass 701", consent: true }),
    );
    await handlers.verify(req("/api/auth/verify", { email: "p70@example.com", code: sent[sent.length - 1].code }));
    const accounts = await store.listAccounts();
    const serverBefore = recordMissionPassV2(emptyProgressV2(accounts[0].id), {
      slug: "p2-m1",
      language: "java",
      stars: 2,
      code: "server-code",
      at: "2026-11-11T10:00:00.000Z",
      date: "2026-11-11",
    });
    accounts[0].progressJson = JSON.stringify({ ...serverBefore, owner: accounts[0].id });
    await store.updateAccount(accounts[0]);

    const local = recordMissionPassV2(emptyProgressV2("guest"), {
      slug: "p1-m1",
      language: "python",
      stars: 1,
      code: "local-code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    const login = await handlers.login(
      req("/api/auth/login", { username: "Cadet_70", password: "strong pass 701", progress: local }),
    );
    expect(login.status).toBe(200);
    const body = (await login.json()) as { username: string; progress: typeof local; replaced: boolean };
    expect(body.username).toBe("Cadet_70");
    expect(body.replaced).toBe(false);
    expect(body.progress.missions["p1-m1"]?.python.bestStars).toBe(1);
    expect(body.progress.missions["p2-m1"]?.java.bestStars).toBe(2);
  });

  it("login replaces a different-Account local record and reports replaced", async () => {
    const { handlers, sent } = setup();
    await handlers.register(
      req("/api/auth/register", { username: "Cadet_71", email: "p71@example.com", password: "strong pass 711", consent: true }),
    );
    await handlers.verify(req("/api/auth/verify", { email: "p71@example.com", code: sent[sent.length - 1].code }));
    const local = recordMissionPassV2(emptyProgressV2("acct-other"), {
      slug: "p1-m1",
      language: "python",
      stars: 3,
      code: "other-code",
      at: "2026-11-10T10:00:00.000Z",
      date: "2026-11-10",
    });
    const login = await handlers.login(
      req("/api/auth/login", { username: "Cadet_71", password: "strong pass 711", progress: local }),
    );
    const body = (await login.json()) as { progress: typeof local; replaced: boolean };
    expect(body.replaced).toBe(true);
    expect(body.progress.missions["p1-m1"]).toBeUndefined();
  });
});
